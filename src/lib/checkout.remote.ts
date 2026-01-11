import { form, getRequestEvent } from "$app/server"
import { error, redirect } from "@sveltejs/kit";
import { Stripe } from "stripe"
import { getDBClient } from "$lib/server/db";
import { POSTCARD_DETAILS } from "$lib";
import { AddressDetailsSchema } from "./checkout.types";


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
          unit_amount: POSTCARD_DETAILS.cost_unit,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: new URL('/return', origin).href,
    cancel_url: new URL('/write', origin).href,
  });
  return session
}

export const createCheckout = form(AddressDetailsSchema, async (request) => {
  const { platform, url } = getRequestEvent();
  const clientRefId = crypto.randomUUID();
  const expiresIn = platform!.env.ENV == "development" ? 60 * 30 : 60 * 60 * 1

  // Create a Stripe session
  const session = await createStripeCheckoutSession(
    platform!.env.STRIPE_API_SECRET,
    url.origin,
    clientRefId,
    expiresIn,
  );
  if (!session.url) error(404, 'No checkout url')

  // Upload postcard page images
  const envPath = platform!.env.ENV == "development" ? 'dev' : 'prod'
  const keyFront = `tmp/30/reberrymemberer/${envPath}/${clientRefId}_front.jpg`;
  const keyBack = `tmp/30/reberrymemberer/${envPath}/${clientRefId}_back.jpg`;

  await platform!.env.R2.put(keyFront, await request.frontImage.arrayBuffer())
  await platform!.env.R2.put(keyBack, await request.backImage.arrayBuffer())

  // Create new order
  const db = getDBClient(platform!.env.DB);
  const resp = await db.createNewOrder({
    id: clientRefId,
    stripe_checkout_id: session.id,
    recipient_address: JSON.stringify(request),
    send_date: request.sendDate,
    front_image_url: keyFront,
    back_image_url: keyBack,
    status: 'draft',
  });

  if (!resp) error(404, 'Failed to create order');

  redirect(301, session.url);
})