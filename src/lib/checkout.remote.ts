import { form, getRequestEvent } from "$app/server"
import { error, redirect } from "@sveltejs/kit";
import { Stripe } from "stripe"
import { initDB } from "$lib/server/db";
import { POSTCARD_DETAILS, ROUTES } from "$lib";
import { CheckoutSchema } from "./checkout.types";
import { isErrorRetryableD1, isErrorRetryableR2, tryWhile } from "./utils/retry";
import { initPostalClient, type AddressLob } from "./server/lob";

// Constants
const BUCKET_PATHS = {
  // Delete objects after 90 day(s): "tmp/90/*"
  // To allow time for customer support issues.
  uploadCheckoutAssetPath: (filename: string, isDevEnv: boolean) => `tmp/90/reberrymemberer/${isDevEnv ?"dev":"prod"}/${filename}`,
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
            name: 'A6 Postcard',
            description: 'Reberrymemberer Postal Services.'
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

export const createCheckout = form(CheckoutSchema, async (request) => {
  const { platform, url } = getRequestEvent();
  const devEnv = platform!.env.ENV == "development";
  const clientRefId = crypto.randomUUID();

  const addressTo = {
    name: request.name,
    address_line1: request.address,
    address_line2: request.addressLine2,
    address_city: request.city,
    address_state: request.state,
    address_zip: request.postalCode,
    address_country: request.country,
  } satisfies AddressLob;

  // Address verification: Requires a live key.
  const lob = initPostalClient({ apiKey: platform!.env.LOB_API_SECRET });
  const isUS = addressTo.address_country === "US";
  const respAdd = isUS
    ? await lob.verifyUSAddress(addressTo)
    : await lob.verifyInternationalAddress(addressTo);

  if (!respAdd.ok) {
    console.error(respAdd);
    error(422, 'Address could not be verified! Please ensure all fields are correct.');
  }

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
  const db = initDB(platform!.env.DB);
  const resp = await tryWhile(
    () => db.order.createOrder({
      id: clientRefId,
      stripe_checkout_id: session.id,
      recipient_address: JSON.stringify(addressTo),
      send_date: request.sendDate,
      front_image_url: keyFront,
      back_image_url: keyBack,
      status: 'draft',
    }),
    isErrorRetryableD1,
  );

  if (!resp) error(404, 'Failed to create order');

  redirect(301, session.url);
});