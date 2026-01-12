import { initDB } from "$lib/server/db";
import { error, json } from "@sveltejs/kit";
import Stripe from "stripe"
import { initPostalClient, type LobAddress, type PostcardPayload, type PostcardResponse } from "$lib/server/lob.js";
import { isErrorRetryableD1, tryWhile } from "$lib/utils/retry.js";
import { initLucia } from "$lib/server/lucia.js";


async function fulfillOrder(
  session: Stripe.Response<Stripe.Checkout.Session>,
  platform: Readonly<App.Platform>,
) {
  // TODO: handle different quantities & item types

  const db = initDB(platform!.env.DB);
  const sessionOrderId = session.client_reference_id;
  const email = session.customer_email;

  if (!sessionOrderId) throw new Error("Missing client_reference_id!");

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
    throw new Error("Order has been fullfilled or not found!" + sessionOrderId);
  }

  try {

    // Create new postcard order
    const recipientAddress: LobAddress = JSON.parse(order.recipient_address);
    const payload: PostcardPayload = {
      from: 'adr_d07414d6c6ff34b7', // Using Lob's address
      to: recipientAddress,
      front: `${platform!.env.R2_DELIVER_URL}/${order.front_image_url}`,
      back: `${platform!.env.R2_DELIVER_URL}/${order.back_image_url}`,
      metadata: {
        order_id: order.id,
      },
      size: "4x6",
      mail_type: 'usps_first_class',
      use_type: 'operational',
      // send_date: order.send_date ?? undefined, // Unsupported for now
    }
    const lob = initPostalClient({ apiKey: platform!.env.LOB_API_SECRET });

    const resp = await lob.createNewOrder(payload);
    if (!resp.ok) {
      console.error(resp)
      throw new Error(`Invalid postcard response!`);
    }

    const respContent: PostcardResponse = await resp.json()

    // Update client order status & id
    await tryWhile(
      () => db.order.setOrderAsConfirmedWithProviderId({
        provider_order_id: respContent.id,
        order_id: order.id
      }), 
      isErrorRetryableD1
    );
    
  } catch (error) {
    console.error(error);

    await tryWhile(
      () => db.order.setOrderCancelled({ orderId: sessionOrderId, reason: "system_error" }), 
      isErrorRetryableD1
    );
  }

  // Automatically register new users
  if (email) {
    const lucia = initLucia(platform.env.DB);
    await tryWhile(
      () => lucia.auth.registerUser(email), 
      isErrorRetryableD1
    );
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
      // TODO: notify user by email
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

  if (!event) return error(500, "Unauthorized request");

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
  } catch (err) {
    error(500, { message: JSON.stringify(err ?? 'Error handling stripe webhook') });
  }

  return json({ ok: true }, { status: 200 });
}