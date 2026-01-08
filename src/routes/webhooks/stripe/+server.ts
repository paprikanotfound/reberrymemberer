import { createPrintOneClient, type AddressDetails, type OrderRequestPayload } from "$lib/server/printone.js";
import { getDBClient } from "$lib/server/db";
import { error } from "@sveltejs/kit";
import Stripe from "stripe"

export async function POST({ platform, request }) {
  const stripeSignSecret = platform!.env.STRIPE_API_SIGN_SECRET;
  const stripe = new Stripe(platform!.env.STRIPE_API_SECRET, { apiVersion: '2025-06-30.basil' })
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  const event = await stripe.webhooks.constructEventAsync(rawBody, signature!, stripeSignSecret);

  if (!event) return error(500, "Stripe signature is not valid");
  
  const db = getDBClient(platform!.env.DB);
  
  const fulfillOrder = async (session: Stripe.Response<Stripe.Checkout.Session>)  => {
    const sessionOrderId = session.client_reference_id!;

    // Update order status
    const order = await db.setOrderStatusAsPaidOrSkip({
      orderId: sessionOrderId,
      email: session.customer_email, 
      paymentIntent: session.payment_intent!.toString(), 
    });

    if (!order) {
      console.error('Order already fullfilled or not found!', );
      return
    }
    
    if (!order.recipient_address || !order.sender_address) {
      console.error('Order missing address details', session.client_reference_id);
      await db.setOrderCancelled({ orderId: sessionOrderId, reason: "system_error" });
      // TODO dev email to notify support
      return
    }

    // Workaround for print.one API error ("address does not contain a house number").
    // Merge address lines before submitting.
    let senderAddress: AddressDetails = JSON.parse(order.sender_address)
    senderAddress.address = `${senderAddress.address} ${senderAddress.addressLine2}`
    senderAddress.addressLine2 = ''

    let recipientAddress: AddressDetails = JSON.parse(order.recipient_address)
    recipientAddress.address = `${recipientAddress.address} ${recipientAddress.addressLine2}`
    recipientAddress.addressLine2 = ''

    const payload: OrderRequestPayload = {
      templateId: platform!.env.PRINT_ONE_TEMPLATE_ID,
      sendDate: order.send_date ?? undefined,
      sender: senderAddress,
      recipient: recipientAddress,
      finish: "MATTE",
      mergeVariables: {
        artfront: `${platform!.env.R2_DELIVER_URL}/${order.front_image_url}`,
        artback: `${platform!.env.R2_DELIVER_URL}/${order.back_image_url}`,
      }
    }
    
    // Create new provider order (print.one)
    const printOne = createPrintOneClient({
      apiKey: platform!.env.PRINT_ONE_API, 
      apiUrl: platform!.env.PRINT_ONE_API_URL
    });
    const { response, data } = await printOne.createNewOrder(payload);

    if (!response.ok) {
      console.error('print.one error:', data, session.client_reference_id);
      await db.setOrderCancelled({ orderId: sessionOrderId, reason: "system_error" });
      return
    }

    // Update order details
    const result = await db.setOrderAsConfirmedWithProviderId({ 
      provider_order_id: data.id, 
      order_id: order.id
    });
    if (result.meta.changes == 0) {
      console.error('Failed to update order with provider id!', order.id);
      return
    }
  }

  switch (event.type) {
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session
      const sessionOrderId = session.client_reference_id!
      await db.setOrderAsExpired({ orderId: sessionOrderId });
      break
    }
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const sessionWithLineItems = await stripe.checkout.sessions.retrieve(
        session.id, { expand: ['line_items.data.price'], }
      )
      // Create a new order
      // await createOrder(platform!.env.DB, sessionWithLineItems)
      // Check if the order is paid (for example, from a card payment)
      //
      // A delayed notification payment will have an `unpaid` status, as
      // you're still waiting for funds to be transferred from the customer's
      // account.
      if (session.payment_status === 'paid') {
        await fulfillOrder(sessionWithLineItems)
      }
      break
    }
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session
      const sessionExpanded = await stripe.checkout.sessions.retrieve(
        session.id, { expand: ['line_items.data.price'], }
      );
      await fulfillOrder(sessionExpanded);
      break
    }
    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session
      const sessionOrderId = session.client_reference_id!;
      await db.setOrderFailedPayment({ orderId: sessionOrderId });
      break
    }
    case 'radar.early_fraud_warning.created': {
      const efw = event.data.object as Stripe.Radar.EarlyFraudWarning
      const efwWithPayIntent = await stripe.radar.earlyFraudWarnings.retrieve(efw.id, { expand: ['payment_intent'] })
      // An EFW is actionable if it has not 
      // received a dispute and has not been fully refunded. 
      // You may wish to proactively refund a charge that receives 
      // an EFW, in order to avoid receiving a dispute later.
      if (efwWithPayIntent.actionable) {
        await stripe.refunds.create({ charge: efw.charge.toString(), reason: 'fraudulent' })
        await db.setOrderCancelledFraud({ paymentIntent: efw.payment_intent!.toString() })
      }
      break
    }
  }

  return new Response(null, { status: 200 })
}