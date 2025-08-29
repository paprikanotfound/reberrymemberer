import { createPrintOneOrder, type AddressDetails, type OrderRequestPayload } from "$lib/api.printone.server.js";
import { createOrderQueries } from "$lib/db.server";
import { error } from "@sveltejs/kit";
import Stripe from "stripe"


export async function POST({ platform, request, url, fetch }) {
  /**
   * requires node:crypto w/ nodejs_compat flag in cf worker to be enabled.
   * https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/
   * 
   */
  const stripeSignSecret = platform!.env.STRIPE_API_SIGN_SECRET;
  const stripe = new Stripe(platform!.env.STRIPE_API_SECRET, { apiVersion: '2025-06-30.basil' })
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  const event = await stripe.webhooks.constructEventAsync(rawBody, signature!, stripeSignSecret)
  if (!event) return error(500, "Stripe signature is not valid")
  
  const queries = createOrderQueries(platform!.env.DB)

  const fulfillOrder = async (session: Stripe.Response<Stripe.Checkout.Session>)  => {
    
    // update order status if not marked as 'paid' already
    const order = await queries.setOrderStatusAsPaidOrSkip(
      session.customer_email, 
      session.payment_intent!.toString(), 
      session.client_reference_id!
    )
    if (!order) {
      console.error('Order already fullfilled or not found!', session.client_reference_id)
      return
    }
    
    // create print order
    if (!order.recipient_address || !order.sender_address) {
      console.error('Order error: missing address details', order.recipient_address, order.sender_address)
      await queries.setOrderCancelled(session.client_reference_id!, "system_error");
      // TODO email support
      return
    }

    let senderAddress: AddressDetails = JSON.parse(order.sender_address)
    senderAddress.address = `${senderAddress.address} ${senderAddress.addressLine2}`
    senderAddress.addressLine2 = ''

    let recipientAddress: AddressDetails = JSON.parse(order.recipient_address)
    recipientAddress.address = `${recipientAddress.address} ${recipientAddress.addressLine2}`
    recipientAddress.addressLine2 = ''

    const apiKey = platform!.env.PRINT_ONE_API
    const apiUrl = platform!.env.PRINT_ONE_API_URL
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
    
    const { response, data } = await createPrintOneOrder(apiKey, apiUrl, payload);
    if (!response.ok) {
      console.error('Print.one Error:', data, session.client_reference_id)
      await queries.setOrderCancelled(session.client_reference_id!, "system_error");
      // TODO email support
      return
    }

    // update order details
    const result = await queries.setOrderAsConfirmedAndProviderId(data.id, order.id)
    if (result.meta.changes == 0) {
      console.error('Failed to update order with provider id!', order.id);
      return
    }
  }

  switch (event.type) {
    case 'checkout.session.expired': {
      // TODO set order expired
      const session = event.data.object as Stripe.Checkout.Session
      const orderId = session.client_reference_id!
      await queries.setOrderAsExpired(orderId);
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
      const sessionWithLineItems = await stripe.checkout.sessions.retrieve(
        session.id, { expand: ['line_items.data.price'], }
      )
      await fulfillOrder(sessionWithLineItems);
      break
    }
    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session
      await queries.setOrderFailedPayment(session.client_reference_id!)
      // TODO Email customer
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
        await queries.setOrderCancelledFraud(efw.payment_intent!.toString())
        // TODO Email customer
      }
      break
    }
  }

  return new Response(null, { status: 200 })
}