import { command, getRequestEvent } from "$app/server"
import { error } from "@sveltejs/kit";
import { Stripe } from "stripe"
import { R2 } from "$lib/utils/r2";
import { getDBClient } from "$lib/server/db";
import { decodeAddressDetails, POSTCARD } from "$lib";
import z from "zod";


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


const AddressDetailsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional().or(z.literal('')),
  postalCode: z.string().min(1, "Postal code is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().length(2, "Country is required"),
});

const sendDateSchema = z
  .string()
  // ✅ Match YYYY-MM-DD format
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be in YYYY-MM-DD format" })
  // ✅ Must be today or later
  .refine((dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr >= today;
  }, {
    message: "Send date must be today or in the future",
  });

const CheckoutRequestSchema = z.object({
  sender: AddressDetailsSchema,
  recipient: AddressDetailsSchema,
  sendDate: sendDateSchema,
  frontSize: z.number().positive(),
  frontType: z.string().min(1),
  backSize: z.number().positive(),
  backType: z.string().min(1),
});

export type AddressDetails = z.infer<typeof AddressDetailsSchema>;


export const createCheckout = command(CheckoutRequestSchema, async (request) => {
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

  // Generate signed urls for assets upload
  const s3 = R2.client(
    platform!.env.R2_ENDPOINT,
    platform!.env.R2_ACCESS_KEY_ID,
    platform!.env.R2_SECRET_ACCESS_KEY
  );
  const envPath = platform!.env.ENV == "development" ? 'dev' : 'prod'
  const keyFront = `tmp/30/reberrymemberer/${envPath}/${clientRefId}_front.jpg`;
  const keyBack = `tmp/30/reberrymemberer/${envPath}/${clientRefId}_back.jpg`;
  const urlFront = await R2.getSignedUrl(s3, platform!.env.R2_BUCKET, keyFront, "put", request.frontType, request.frontSize, 60 * 30);
  const urlBack = await R2.getSignedUrl(s3, platform!.env.R2_BUCKET, keyBack, "put", request.backType, request.backSize, 60 * 30);

  // Create new order
  const db = getDBClient(platform!.env.DB);
  const order = await db.createNewOrder({
    id: clientRefId, 
    stripe_checkout_id: session.id, 
    recipient_address: JSON.stringify(decodeAddressDetails(request.recipient)), 
    sender_address: JSON.stringify(decodeAddressDetails(request.sender)), 
    send_date: request.sendDate, 
    front_image_url: keyFront, 
    back_image_url: keyBack, 
    status: 'draft',
  });
  
	if (!order) error(404, 'Failed to create order')
  
  return {
    url_checkout: session.url,
    url_front: urlFront,
    url_back: urlBack,
  }
})