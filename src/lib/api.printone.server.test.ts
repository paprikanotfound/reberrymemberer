import { describe, test, expect, vi } from "vitest";
import { createPrintOneOrder } from "./api.printone.server";

describe("createOrder", () => {
  test("returns order id from API", async () => {
    // mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "order_123" }),
    });
    
    // TODO implement test
    // const result = await createPrintOneOrder();
    // expect(result.id).toBe("order_123");
  });
});