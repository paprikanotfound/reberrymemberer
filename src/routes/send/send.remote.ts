import { command, getRequestEvent } from "$app/server"
import { error } from "@sveltejs/kit";
import { CheckoutRequestSchema } from "./types";
import { Stripe } from "stripe"
import { R2 } from "$lib/utils/utils.r2";
import type { Order } from "$lib/db.server";
import { POSTCARD } from "$lib/types";


async function createStripeCheckoutSession(secret: string, origin: string, client_reference_id: string) {
  const stripe = new Stripe(secret, { apiVersion: "2025-06-30.basil" })
  const session = await stripe.checkout.sessions.create({
    client_reference_id,
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Postcard',
          },
          unit_amount: POSTCARD.cost_unit,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: new URL('/return', origin).href,
    cancel_url: new URL('/send', origin).href,
  });
  return session
}

export const createCheckout = command(CheckoutRequestSchema, async (request) => {
  const { platform, url } = getRequestEvent();  
  const db = platform!.env.DB
  const id = crypto.randomUUID();

  // create stripe session
  const session = await createStripeCheckoutSession(platform!.env.STRIPE_API_SECRET, url.origin, id);
  if (!session.url) error(404, 'No checkout url')

  // generate signed urls
  const s3 = R2.client(
    platform!.env.R2_ENDPOINT,
    platform!.env.R2_ACCESS_KEY_ID,
    platform!.env.R2_SECRET_ACCESS_KEY
  )
  const envPath = platform!.env.ENV == "development" ? 'dev' : 'prod'
  const keyFront = `tmp/24/untogether/${envPath}/${id}_front.jpg`
  const keyBack = `tmp/24/untogether/${envPath}/${id}_back.jpg`
  const urlFront = await R2.getSignedUrl(s3, platform!.env.R2_BUCKET, keyFront, "put", request.frontType, request.frontSize, 60 * 30);
  const urlBack = await R2.getSignedUrl(s3, platform!.env.R2_BUCKET, keyBack, "put", request.backType, request.backSize, 60 * 30);

  // insert order
  const order = await db.prepare(`
      INSERT INTO orders (
        id, stripe_checkout_id, 
        recipient_address, sender_address, send_date, 
        front_image_url, back_image_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *;
    `)
    .bind(
      id, session.id, 
      JSON.stringify(request.recipient), 
      JSON.stringify(request.sender), 
      request.sendDate, 
      keyFront, keyBack, 'draft'
    )
    .first<Order>();
  
	if (!order) error(404, 'Failed to create order')
  
  return {
    url_checkout: session.url,
    url_front: urlFront,
    url_back: urlBack,
  }
})