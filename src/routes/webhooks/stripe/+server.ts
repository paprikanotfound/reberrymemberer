import { initDB } from "$lib/server/db";
import { error, json } from "@sveltejs/kit";
import Stripe from "stripe"
import { initPostalClient, type LobAddress, type PostcardPayload, type PostcardResponse } from "$lib/server/lob.js";
import { isErrorRetryableD1, isErrorRetryableResend, tryWhile } from "$lib/utils/retry.js";
import { initLucia } from "$lib/server/lucia.js";
import { initResend } from "$lib/server/resend.js";


async function fulfillOrder(
  session: Stripe.Response<Stripe.Checkout.Session>,
  platform: Readonly<App.Platform>,
) {

  // TODO: handle different quantities & item types

  const db = initDB(platform!.env.DB);
  const sessionOrderId = session.client_reference_id;
  const customerEmail = session.customer_details?.email;

  console.log('[fulfillOrder] Started', {
    orderId: sessionOrderId,
    sessionId: session.id,
    email: customerEmail,
    paymentStatus: session.payment_status
  });

  if (!sessionOrderId) {
    console.error('[fulfillOrder] Missing client_reference_id', { sessionId: session.id });
    error(401, "Missing client_reference_id!");
  }

  console.log('[fulfillOrder] Marking order as paid', { orderId: sessionOrderId })

  // Retrieve unpaid order and update status.
  const order = await tryWhile(
    () => db.order.setOrderStatusAsPaidOrSkip({
      orderId: sessionOrderId,
      email: session.customer_email,
      paymentIntent: session.payment_intent!.toString(),
    }),
    isErrorRetryableD1
  );

  if (!order) {
    console.error('[fulfillOrder] Order not found or already fulfilled', { orderId: sessionOrderId });
    error(401, "Order has been fullfilled or not found!" + sessionOrderId);
  }

  console.log('[fulfillOrder] Order marked as paid', { orderId: sessionOrderId });

  try {

    // Create new postcard order
    const recipientAddress: LobAddress = JSON.parse(order.recipient_address);
    const payload: PostcardPayload = {
      from: platform!.env.DEFAULT_SEND_ADR_ID, // Note: We're using a default US address for all orders
      to: recipientAddress,
      front: `${platform!.env.R2_DELIVER_URL}/${order.front_image_url}`,
      back: `${platform!.env.R2_DELIVER_URL}/${order.back_image_url}`,
      metadata: {
        order_id: order.id,
        customer_email: customerEmail ?? 'missing',
      },
      size: "4x6", // Note: This is the only size supported internationally.
      mail_type: 'usps_first_class',
      use_type: 'operational',
      // send_date: order.send_date ?? undefined, // Note: Requires Pro Plan
    }

    console.log('[fulfillOrder] Creating postcard with Lob', {
      orderId: order.id,
      recipient: recipientAddress.name,
      destination: recipientAddress.address_country
    });

    const lob = initPostalClient({ apiKey: platform!.env.LOB_API_SECRET });
    const resp = await lob.createNewOrder(payload);

    if (!resp.ok) {
      console.error('[fulfillOrder] Lob API error', {
        orderId: order.id,
        status: resp.status,
        statusText: resp.statusText
      });
      error(401, "Invalid postcard response!");
    }

    const respContent: PostcardResponse = await resp.json();

    console.log('[fulfillOrder] Postcard created successfully', {
      orderId: order.id,
      providerOrderId: respContent.id
    });

    // Update client order status & id
    await tryWhile(
      () => db.order.updateOrderAsConfirmed({
        customer_email: customerEmail ?? null,
        provider_order_id: respContent.id,
        order_id: order.id
      }),
      isErrorRetryableD1
    );

    console.log('[fulfillOrder] Order confirmed in database', { orderId: order.id });

    if (customerEmail) {
      console.log('[fulfillOrder] Processing user registration and email', { email: customerEmail, orderId: order.id });

      // Automatically sign-up new users
      const lucia = initLucia(platform.env.DB);
      await tryWhile(
        () => lucia.auth.registerUser(customerEmail),
        isErrorRetryableD1
      );

      // Send confirmation email
      const resend = initResend(platform.env.RESEND_API);
      await tryWhile(
        () => resend.sendConfirmationEmail(customerEmail, order.id.slice(0, 13)), // keeping order ids short
        isErrorRetryableResend
      );

      console.log('[fulfillOrder] Email sent successfully', { email: customerEmail, orderId: order.id });
    }

    console.log('[fulfillOrder] Completed successfully', { orderId: order.id });

  } catch (error) {
    console.error('[fulfillOrder] Error occurred, cancelling order', {
      orderId: sessionOrderId,
      error: error instanceof Error ? error.message : String(error)
    });

    await tryWhile(
      () => db.order.setOrderCancelled({ orderId: sessionOrderId, reason: "system_error" }),
      isErrorRetryableD1
    );
    return
  }
}

const stripeWebhookHandler = (stripe: Stripe, platform: Readonly<App.Platform>) => ({
  session: {
    sessionExpired: async (event: Stripe.Event) => { },
    sessionCompleted: async (event: Stripe.Event) => {
      const session = event.data.object as Stripe.Checkout.Session
      const sessionExpanded = await stripe.checkout.sessions.retrieve(
        session.id, { expand: ['line_items.data.price', 'line_items.data.price.product'], }
      )
      if (session.payment_status === 'paid') {
        await fulfillOrder(sessionExpanded, platform);
      }
    },
    asyncPaymentSucceeded: async (event: Stripe.Event) => {
      const session = event.data.object as Stripe.Checkout.Session
      const sessionExpanded = await stripe.checkout.sessions.retrieve(
        session.id, { expand: ['line_items.data.price', 'line_items.data.price.product'], }
      );
      await fulfillOrder(sessionExpanded, platform);
    },
    asyncPaymentFailed: async (event: Stripe.Event) => {
      // TODO: handle async payment failures
    },
  },
  charge: {
    refunded: async (event: Stripe.ChargeRefundedEvent) => {
      // TODO: handle refunds
      // const charge = event.data.object;
      // const isFullRefund = charge.amount_refunded === charge.amount;
      // const isPartialRefund = charge.amount_refunded > 0 && !isFullRefund;
      // const paymentIntent = charge.payment_intent!.toString();
      // const db = initDB(platform!.env.DB);
      // await db.payments.markRefunded(paymentIntent);
    }
  },
  radar: {
    earlyFraudWarning: async (event: Stripe.RadarEarlyFraudWarningCreatedEvent) => {
      const efw = event.data.object;
      const efwWithPayIntent = await stripe.radar.earlyFraudWarnings.retrieve(efw.id, { expand: ['payment_intent'] })
      // An EFW is actionable if it has not 
      // received a dispute and has not been fully refunded. 
      // You may wish to proactively refund a charge that receives 
      // an EFW, in order to avoid receiving a dispute later.
      if (efwWithPayIntent.actionable) {
        await stripe.refunds.create({ charge: efw.charge.toString(), reason: 'fraudulent' });
        // const db = initDB(platform!.env.DB);
        // await db.payments.markRefunded(efwWithPayIntent.payment_intent!.toString());
      }
    }
  }
});

export async function POST({ platform, request }) {
  const stripeSignSecret = platform!.env.STRIPE_API_SIGN_SECRET;
  const stripe = new Stripe(platform!.env.STRIPE_API_SECRET, { apiVersion: '2025-06-30.basil' })
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  const event = await stripe.webhooks.constructEventAsync(rawBody, signature!, stripeSignSecret);

  if (!event) {
    console.error('[webhook] Failed to construct event - unauthorized request');
    return error(500, "Unauthorized request");
  }

  console.log('[webhook] Received event', { type: event.type, id: event.id });

  const webhook = stripeWebhookHandler(stripe, platform!);
  try {
    switch (event.type) {
      case 'checkout.session.expired': {
        await webhook.session.sessionExpired(event);
        break
      }
      case 'checkout.session.completed': {
        await webhook.session.sessionCompleted(event);
        break
      }
      case 'checkout.session.async_payment_succeeded': {
        await webhook.session.asyncPaymentSucceeded(event);
        break
      }
      case 'charge.refunded': {
        await webhook.charge.refunded(event);
        break
      }
      case 'checkout.session.async_payment_failed': {
        await webhook.session.asyncPaymentFailed(event);
        break
      }
      case 'radar.early_fraud_warning.created': {
        await webhook.radar.earlyFraudWarning(event);
        break
      }
    }
    console.log('[webhook] Event processed successfully', { type: event.type, id: event.id });
  } catch (err) {
    console.error('[webhook] Error processing event', {
      type: event.type,
      id: event.id,
      error: err instanceof Error ? err.message : String(err)
    });
    error(500, { message: JSON.stringify(err ?? 'Error handling stripe webhook') });
  }

  return json({ ok: true }, { status: 200 });
}