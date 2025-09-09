import { describe, test, expect } from "vitest";
import type { RequestHandler } from "@sveltejs/kit";
import { POST as webhookHandler } from "./+server";

// fake event payload
const mockEvent = {
  id: "evt_test_123",
  type: "payment_intent.succeeded",
  data: { object: { id: "pi_test_123" } },
};

describe("Stripe Webhook", () => {
  test("handles payment_intent.succeeded event", async () => {
    const body = JSON.stringify(mockEvent);

    const request = new Request("http://localhost/webhooks/stripe", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        // skip Stripe signature for now
      },
    });

    const response = await (webhookHandler as RequestHandler)({ request } as any);
    expect(response.status).toBe(200);
  });
});