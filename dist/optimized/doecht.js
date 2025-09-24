import { g } from "../chunks/event.js";
import { a } from "../chunks/command.js";
import { error } from "@sveltejs/kit";
import { C, d } from "../chunks/types.js";
import { Stripe } from "stripe";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { g as g$1 } from "../chunks/db.js";
import { P } from "../chunks/app.js";
import "../chunks/event-state.js";
import "../chunks/false.js";
import "../chunks/environment.js";
const R2 = {
  client: (endpoint, accessKeyId, secretAccessKey) => {
    return new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey }
    });
  },
  get: async (s3, key, bucket) => {
    const command2 = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    const data = await s3.send(command2);
    return streamToString(data.Body.transformToWebStream());
  },
  ls: async (s3, prefix, bucket) => {
    const command2 = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix
    });
    return s3.send(command2);
  },
  put: async (s3, key, bucket, content, contentType) => {
    const command2 = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      // Specify the file path in your R2 bucket
      Body: content,
      // The content to upload (can be a string, buffer, etc.)
      ContentType: contentType
    });
    return s3.send(command2);
  },
  del: async (s3, key, bucket) => {
    const command2 = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    });
    return s3.send(command2);
  },
  getSignedUrl: async (s3, bucket, key, action, contentType, ContentLength, expiresIn) => {
    let cmd;
    if (action == "put") {
      const params = {
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength
      };
      cmd = new PutObjectCommand(params);
    } else {
      const params = {
        Bucket: bucket,
        Key: key
      };
      cmd = new GetObjectCommand(params);
    }
    return getSignedUrl(s3, cmd, { expiresIn });
  }
};
function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = "";
    function read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          resolve(result);
          return;
        }
        result += decoder.decode(value, { stream: true });
        read();
      }).catch(reject);
    }
    read();
  });
}
async function createStripeCheckoutSession(secret, origin, client_reference_id, expires_in) {
  const stripe = new Stripe(secret, { apiVersion: "2025-06-30.basil" });
  const session = await stripe.checkout.sessions.create({
    client_reference_id,
    expires_at: Math.floor(Date.now() / 1e3) + expires_in,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: "Postcard"
          },
          unit_amount: P.cost_unit
        },
        quantity: 1
      }
    ],
    mode: "payment",
    success_url: new URL("/return", origin).href,
    cancel_url: new URL("/send", origin).href
  });
  return session;
}
const createCheckout = a(C, async (request) => {
  const { platform, url } = g();
  const clientRefId = crypto.randomUUID();
  const expiresIn = platform.env.ENV == "development" ? 60 * 30 : 60 * 60 * 1;
  const session = await createStripeCheckoutSession(
    platform.env.STRIPE_API_SECRET,
    url.origin,
    clientRefId,
    expiresIn
  );
  if (!session.url) error(404, "No checkout url");
  const s3 = R2.client(
    platform.env.R2_ENDPOINT,
    platform.env.R2_ACCESS_KEY_ID,
    platform.env.R2_SECRET_ACCESS_KEY
  );
  const envPath = platform.env.ENV == "development" ? "dev" : "prod";
  const keyFront = `tmp/30/reberrymemberer/${envPath}/${clientRefId}_front.jpg`;
  const keyBack = `tmp/30/reberrymemberer/${envPath}/${clientRefId}_back.jpg`;
  const urlFront = await R2.getSignedUrl(s3, platform.env.R2_BUCKET, keyFront, "put", request.frontType, request.frontSize, 60 * 30);
  const urlBack = await R2.getSignedUrl(s3, platform.env.R2_BUCKET, keyBack, "put", request.backType, request.backSize, 60 * 30);
  const db = g$1(platform.env.DB);
  const order = await db.createNewOrder({
    id: clientRefId,
    stripe_checkout_id: session.id,
    recipient_address: JSON.stringify(d(request.recipient)),
    sender_address: JSON.stringify(d(request.sender)),
    send_date: request.sendDate,
    front_image_url: keyFront,
    back_image_url: keyBack,
    status: "draft"
  });
  if (!order) error(404, "Failed to create order");
  return {
    url_checkout: session.url,
    url_front: urlFront,
    url_back: urlBack
  };
});
for (const [name, fn] of Object.entries({ createCheckout })) {
  fn.__.id = "doecht/" + name;
  fn.__.name = name;
}
export {
  createCheckout
};
