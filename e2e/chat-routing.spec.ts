import { test, expect } from "./fixtures";

test.describe("Routing & navigation", () => {
  test("/chat loads", async ({ chatPage }) => {
    await expect(chatPage).toHaveURL(/\/chat/);
  });

  test("Back/forward keeps user on chat", async ({ chatPage }) => {
    await chatPage.goto("/chat");
    await chatPage.goBack().catch(() => {});
    await chatPage.goForward().catch(() => {});
    await expect(chatPage.getByPlaceholder(/Ask anything/i)).toBeVisible();
  });

  test("Reload keeps session", async ({ chatPage }) => {
    await chatPage.reload();
    await expect(chatPage.getByPlaceholder(/Ask anything/i)).toBeVisible({ timeout: 15_000 });
  });
});
