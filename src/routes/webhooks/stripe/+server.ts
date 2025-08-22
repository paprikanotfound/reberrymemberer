import { createPrintOneOrder, type AddressDetails, type OrderRequestPayload } from "$lib/api.printone.server.js";
import { setOrderCancelledFraud, setOrderFailedPayment, setOrderProviderId, setOrderRefundedError, setOrderStatusPaid } from "$lib/db.server";
import { error } from "@sveltejs/kit";
import Stripe from "stripe"


const getCryptoProvider = () => {
  const encoder = new TextEncoder();
  return {
    computeHMACSignatureAsync: async (payload: string, secret: string) => {
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(payload)
      );

      // Convert ArrayBuffer to hex string
      return [...new Uint8Array(signature)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } as Stripe.CryptoProvider;
}

export async function POST({platform, request, url, fetch}) {
  const stripeSignSecret = platform!.env.STRIPE_API_SIGN_SECRET;
  const stripe = new Stripe(platform!.env.STRIPE_API_SECRET, { apiVersion: '2025-06-30.basil' })
  const sign = request.headers.get('stripe-signature') as string
  const body = await request.text()
  const event = await stripe.webhooks.constructEventAsync(body, sign, stripeSignSecret, undefined, getCryptoProvider())
  if (!event) return error(500, "Stripe signature is not valid")
  
  const db = platform!.env.DB

  const fulfillOrder = async (session: Stripe.Response<Stripe.Checkout.Session>)  => {
    try {
      // update order status
      const order = await setOrderStatusPaid(db, 
        session.customer_email, session.payment_intent!.toString(), session.client_reference_id!)
      if (!order) {
        console.error('Order already fullfilled or not found!', session.client_reference_id)
        return
      }
      // create print order
      let processedAddress: AddressDetails = JSON.parse(order.recipient_address)
      processedAddress.address = `${processedAddress.address} ${processedAddress.addressLine2}`
      processedAddress.addressLine2 = ''
  
      const apiKey = platform!.env.PRINT_ONE_API
      const apiUrl = platform!.env.PRINT_ONE_API_URL
      const payload: OrderRequestPayload = {
        templateId: platform!.env.PRINT_ONE_TEMPLATE_ID,
        sendDate: order.send_date ?? undefined,
        recipient: processedAddress,
        finish: "MATTE",
        mergeVariables: {
          artfront: `${platform!.env.R2_DELIVER_URL}/${order.front_image_url}`,
          artback: `${platform!.env.R2_DELIVER_URL}/${order.back_image_url}`,
        }
      }
      const orderPrint = await createPrintOneOrder(apiKey, apiUrl, payload);

      // update order details
      const result = await setOrderProviderId(db, orderPrint.id, order.id)
      if (result.meta.changes == 0) {
        console.error('Failed to update order with provider id!', order.id);
        return
      }
    } catch (error) {
      console.error('Fulfillment error:', error)
      
      const paymentIntentId = session.payment_intent as string;
      await stripe.refunds.create({ payment_intent: paymentIntentId!, reason: 'requested_by_customer' });
      await setOrderRefundedError(db, session.client_reference_id!);
      // TODO email customer
    }
  }

  switch (event.type) {
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
      await setOrderFailedPayment(db, session.client_reference_id!)
      // TODO Email costumer
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
        await setOrderCancelledFraud(db, efw.payment_intent!.toString())
        // TODO Email costumer
      }
      break
    }
  }

  return new Response(null, { status: 200 })
}