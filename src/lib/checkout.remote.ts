import { form, getRequestEvent } from "$app/server"
import { error, invalid } from "@sveltejs/kit";
import { Stripe } from "stripe"
import { initDB } from "$lib/server/db";
import { POSTCARD_CONFIG, ROUTES } from "$lib";
import { CheckoutSchema } from "./checkout.types";
import { isErrorRetryableD1, tryWhile } from "./utils/retry";
import { initPostalClient, type LobAddress, type PostalClient } from "./server/lob";
import { initS3 } from "./server/S3";

// Constants
const ADDRESS_VERIFICATION = false;
const BUCKET_PATHS = {
  // Delete objects after 90 day(s): "tmp/90/*"
  // To allow time for customer support issues.
  uploadCheckoutAssetPath: (filename: string, isDevEnv: boolean) => `tmp/90/reberrymemberer/${isDevEnv ? "dev":"prod"}/${filename}`,
}

async function createStripeCheckoutSession(
  secret: string, 
  origin: string, 
  client_reference_id: string, 
  expires_in: number,
  is_international: boolean
) {
  const stripe = new Stripe(secret, { apiVersion: "2025-06-30.basil" })
  const session = await stripe.checkout.sessions.create({
    client_reference_id,
    expires_at: Math.floor(Date.now() / 1000) + expires_in,
    line_items: [
      {
        price_data: is_international ? 
          POSTCARD_CONFIG.product_data.intl : 
          POSTCARD_CONFIG.product_data.us,
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: new URL(ROUTES.return, origin).href,
    cancel_url: new URL(ROUTES.send, origin).href,
    // customer_email: 'test+location_KR@example.com',
  });
  return session
}

async function mockVerifyAddress(postal: PostalClient, addressTo: LobAddress) {
  const isUS = addressTo.address_country === "US";

  // Use test addresses to trigger specific API responses
  // The primary_line field is used to determine the test response
  const testAddress: LobAddress = {
    ...addressTo,
    // Use the test address value as primary_line to trigger specific response
    // Available test values from postal.testAddresses
    address_line1: isUS ? 
      postal.testAddresses.us.deliverable : 
      postal.testAddresses.intl.deliverable,
  };

  console.log(`[DEV MODE] Testing address verification with: ${testAddress.address_line1}`);

  try {
    if (isUS) {
      const verificationResult = await postal.verifyUSAddress(testAddress);
      console.log("[DEV MODE] US address verification result:", verificationResult);

      // Check deliverability
      if (verificationResult.deliverability === "undeliverable") {
        console.error("Undeliverable US address:", verificationResult);
        error(422, 'Address could not be verified as deliverable. Please check your address details.');
      }

      console.log("US address verified:", verificationResult.deliverability);
    } else {
      const verificationResult = await postal.verifyInternationalAddress(testAddress);
      console.log("[DEV MODE] International address verification result:", verificationResult);

      // Check deliverability
      if (verificationResult.deliverability === "undeliverable" || verificationResult.deliverability === "no_match") {
        console.error("Undeliverable international address:", verificationResult);
        error(422, 'Address could not be verified as deliverable. Please check your address details.');
      }

      console.log("International address verified:", verificationResult.deliverability);
    }
  } catch (err) {
    console.error("[DEV MODE] Address verification error:", err);
    error(422, 'Address verification failed. Please ensure all fields are correct.');
  }
}

async function verifyAddress(postal: PostalClient, addressTo: LobAddress) {
  try {
    const isUS = addressTo.address_country === "US";
    if (isUS) {
      const verificationResult = await postal.verifyUSAddress(addressTo);

      // Check deliverability
      if (verificationResult.deliverability === "undeliverable") {
        console.error("Undeliverable US address:", verificationResult);
        error(422, 'Address could not be verified as deliverable. Please check your address details.');
      }

      console.log("US address verified:", verificationResult.deliverability);
    } else {
      const verificationResult = await postal.verifyInternationalAddress(addressTo);

      // Check deliverability
      if (verificationResult.deliverability === "undeliverable" || verificationResult.deliverability === "no_match") {
        console.error("Undeliverable international address:", verificationResult);
        error(422, 'Address could not be verified as deliverable. Please check your address details.');
      }

      console.log("International address verified:", verificationResult.deliverability);
    }
  } catch (err) {
    console.error("Address verification error:", err);
    error(422, 'Address verification failed. Please ensure all fields are correct.');
  }
}


export const createCheckout = form(CheckoutSchema, async (request, issue) => {
  const { platform, url } = getRequestEvent();
  const devEnv = platform!.env.ENV == "dev";
  const clientRefId = crypto.randomUUID();

  const addressTo = {
    name: request.name,
    address_line1: request.address,
    address_line2: request.addressLine2,
    address_city: request.city,
    address_state: request.state,
    address_zip: request.postalCode,
    address_country: request.country,
  } satisfies LobAddress;

  // Address verification: Requires a live key.
  try {
    if (ADDRESS_VERIFICATION) {
      const lob = initPostalClient({ apiKey: platform!.env.LOB_API_SECRET });
      if (devEnv) {
        await mockVerifyAddress(lob, addressTo);
      } else {
        await verifyAddress(lob, addressTo);
      }
    }
  } catch (err) {
    // Type-safely extract the error message
    const message = err && typeof err === 'object' && 'body' in err && typeof err.body === 'object' && err.body && 'message' in err.body
      ? String(err.body.message)
      : err instanceof Error
      ? err.message
      : String(err);
    invalid(message);
  }
  
  console.log("[createCheckout] Creating checkout session");

  // Create a Stripe session
  const session = await createStripeCheckoutSession(
    platform!.env.STRIPE_API_SECRET,
    url.origin,
    clientRefId,
    60 * 60 * 1,
    request.country !== "US"
  );

  if (!session.url) error(500, 'Unable to create checkout session. Please try again.')

  console.log("[createCheckout] Generating signed URLs");

  // Generate R2 keys for postcard page images
  const keyFront = BUCKET_PATHS.uploadCheckoutAssetPath(`${clientRefId}_front.jpg`, devEnv);
  const keyBack = BUCKET_PATHS.uploadCheckoutAssetPath(`${clientRefId}_back.jpg`, devEnv);

  // Generate presigned URLs that the client will use to upload images
  const s3 = initS3({
    endpoint: platform!.env.R2_ENDPOINT,
    accessKeyId: platform!.env.R2_ACCESS_KEY_ID,
    secretAccessKey: platform!.env.R2_SECRET_ACCESS_KEY,
    bucket: platform!.env.R2_BUCKET,
  });
  const frontUploadUrl = await s3.getSignedUrl(keyFront, "put", "image/jpeg", 60 * 10);
  const backUploadUrl = await s3.getSignedUrl(keyBack, "put", "image/jpeg", 60 * 10);

  console.log("[createCheckout] Creating draft order")

  // Create new order
  const db = initDB(platform!.env.DB);
  const resp = await tryWhile(
    () => db.order.createOrder({
      id: clientRefId,
      stripe_checkout_id: session.id,
      recipient_address: JSON.stringify(addressTo),
      front_image_url: keyFront,
      back_image_url: keyBack,
      send_date: null, // request.sendDate 
      status: 'draft',
    }),
    isErrorRetryableD1,
  );

  if (!resp) error(500, 'Unable to process your order. Please try again.');
  
  console.log(resp)

  // Return upload URLs and checkout URL for client-side handling
  // redirect(301, session.url);
  return {
    checkoutUrl: session.url,
    uploadUrls: {
      front: frontUploadUrl,
      back: backUploadUrl,
    },
  };
});