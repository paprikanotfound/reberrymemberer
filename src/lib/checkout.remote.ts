import { form, getRequestEvent } from "$app/server"
import { error, redirect } from "@sveltejs/kit";
import { Stripe } from "stripe"
import { getDBClient } from "$lib/server/db";
import { POSTCARD_DETAILS, ROUTES } from "$lib";
import { AddressDetailsSchema } from "./checkout.types";
import { isErrorRetryableD1, isErrorRetryableR2, tryWhile } from "./utils/retry";

// Constants
const BUCKET_PATHS = {
  // Delete objects after 30 day(s): "tmp/30/*" 
  uploadCheckoutAssetPath: (filename: string, isDevEnv: boolean) => `tmp/30/reberrymemberer/${isDevEnv ?"dev":"prod"}/${filename}`,
}


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
            name: 'Reberrymemberer Postcard',
            description: 'Postal services. A6 postcard.'
          },
          unit_amount: POSTCARD_DETAILS.cost_unit,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: new URL(ROUTES.return, origin).href,
    cancel_url: new URL(ROUTES.send, origin).href,
  });
  return session
}

export const createCheckout = form(AddressDetailsSchema, async (request) => {
  const { platform, url } = getRequestEvent();
  const devEnv = platform!.env.ENV == "development";
  const clientRefId = crypto.randomUUID();

  // Create a Stripe session
  const session = await createStripeCheckoutSession(
    platform!.env.STRIPE_API_SECRET,
    url.origin,
    clientRefId,
    60 * 60 * 1,
  );
  if (!session.url) error(404, 'No checkout url')

  // Upload postcard page images
  const keyFront = BUCKET_PATHS.uploadCheckoutAssetPath(`${clientRefId}_front.jpg`, devEnv);
  const keyBack = BUCKET_PATHS.uploadCheckoutAssetPath(`${clientRefId}_back.jpg`, devEnv);

  await tryWhile(
    async () => platform!.env.R2.put(keyFront, await request.frontImage.arrayBuffer()),
    isErrorRetryableR2,
  );
  await tryWhile(
    async () => platform!.env.R2.put(keyBack, await request.backImage.arrayBuffer()),
    isErrorRetryableR2,
  );

  // Create new order
  const db = getDBClient(platform!.env.DB);
  const resp = await tryWhile(
    () => db.createNewOrder({
      id: clientRefId,
      stripe_checkout_id: session.id,
      recipient_address: JSON.stringify(request),
      send_date: request.sendDate,
      front_image_url: keyFront,
      back_image_url: keyBack,
      status: 'draft',
    }),
    isErrorRetryableD1,
  );

  if (!resp) error(404, 'Failed to create order');

  redirect(301, session.url);
})