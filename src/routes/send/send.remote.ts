import { command, getRequestEvent } from "$app/server"
import { error } from "@sveltejs/kit";
import { CheckoutRequestSchema, decodeAddressDetails } from "./types";
import { Stripe } from "stripe"
import { R2 } from "$lib/utils/utils.r2";
import { createOrderQueries } from "$lib/db.server";
import { POSTCARD } from "$lib/app";


async function createStripeCheckoutSession(secret: string, origin: string, client_reference_id: string, expires_in: number) {
  const stripe = new Stripe(secret, { apiVersion: "2025-06-30.basil" })
  const session = await stripe.checkout.sessions.create({
    client_reference_id,
    expires_at: Math.floor(Date.now() / 1000) + expires_in,
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
  const env = platform!.env.ENV
  const clientRefId = crypto.randomUUID();
  const expiresIn = env == "development" ? 60 * 30 : 60 * 60 * 1

  // Create a Stripe session
  const session = await createStripeCheckoutSession(
    platform!.env.STRIPE_API_SECRET, 
    url.origin, 
    clientRefId,
    expiresIn,
  );
  if (!session.url) error(404, 'No checkout url')

  // Generate signed urls for assets upload
  const s3 = R2.client(
    platform!.env.R2_ENDPOINT,
    platform!.env.R2_ACCESS_KEY_ID,
    platform!.env.R2_SECRET_ACCESS_KEY
  )
  const envPath = platform!.env.ENV == "development" ? 'dev' : 'prod'
  const keyFront = `tmp/30/reberrymemberer/${envPath}/${clientRefId}_front.jpg`;
  const keyBack = `tmp/30/reberrymemberer/${envPath}/${clientRefId}_back.jpg`;
  const urlFront = await R2.getSignedUrl(s3, platform!.env.R2_BUCKET, keyFront, "put", request.frontType, request.frontSize, 60 * 30);
  const urlBack = await R2.getSignedUrl(s3, platform!.env.R2_BUCKET, keyBack, "put", request.backType, request.backSize, 60 * 30);

  // Create new order
  const query = createOrderQueries(db);
  const order = await query.createNewOrder(
    clientRefId, 
    session.id, 
    JSON.stringify(decodeAddressDetails(request.recipient)), 
    JSON.stringify(decodeAddressDetails(request.sender)), 
    request.sendDate, 
    keyFront, 
    keyBack, 
    'draft'
  );
  
	if (!order) error(404, 'Failed to create order')
  
  return {
    url_checkout: session.url,
    url_front: urlFront,
    url_back: urlBack,
  }
})