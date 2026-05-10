import { test, expect } from "./fixtures";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ltgampdtawuefwwayncx.supabase.co";

test.describe("Chat edge function (backend)", () => {
  test("rejects unauthenticated request", async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/chat`, {
      data: { messages: [{ role: "user", content: "hi" }] },
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(res.status());
  });

  test("authenticated request returns 200/4xx (not 5xx) for trivial prompt", async ({ user, request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/chat`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
      data: {
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
        stream: false,
      },
      failOnStatusCode: false,
      timeout: 60_000,
    });
    expect(res.status(), `body: ${await res.text().catch(() => "")}`).toBeLessThan(500);
  });

  test("rejects empty messages array", async ({ user, request }) => {
    const res = await request.post(`${SUPABASE_URL}/functions/v1/chat`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
      data: { messages: [] },
      failOnStatusCode: false,
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("CORS preflight responds", async ({ request }) => {
    const res = await request.fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: "OPTIONS",
      failOnStatusCode: false,
    });
    expect([200, 204]).toContain(res.status());
  });
});
