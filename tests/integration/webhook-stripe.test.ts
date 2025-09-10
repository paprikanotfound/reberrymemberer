import { env } from "cloudflare:test";
import { describe, test, expect } from "vitest";
import type { RequestHandler } from "@sveltejs/kit";
import { POST as webhookHandler } from "../../src/routes/webhooks/stripe/+server";
import Stripe from "stripe";
const stripe = new Stripe("sk_test_dummy", { apiVersion: "2025-06-30.basil" });

// fake event payload
const mockEvent = {
  id: "evt_test_123",
  type: "payment_intent.succeeded",
  data: { object: { id: "pi_test_123" } },
};

describe("Stripe Webhook", () => {
  test("handles payment_intent.succeeded event", async () => {
    const payload = JSON.stringify(mockEvent);
    const header = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: env.STRIPE_API_SIGN_SECRET!,
    });

    const request = new Request("http://localhost/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "content-type": "application/json",
        "stripe-signature": header,
      },
    });
    const response = await (webhookHandler as RequestHandler)({ 
      request,
      platform: {
        env: { 
          STRIPE_API_SIGN_SECRET: env.STRIPE_API_SIGN_SECRET!,
          STRIPE_API_SECRET: env.STRIPE_API_SECRET!
        },
      }
    } as any);
    expect(response.status).toBe(200);
  });
});