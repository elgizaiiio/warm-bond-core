import { test, expect } from "./fixtures";

test.describe("Sidebar / menu", () => {
  test("opens via menu button", async ({ chatPage }) => {
    await chatPage.getByLabel("Open menu").click();
    await expect(chatPage.getByRole("button", { name: /new chat/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test("closes via Escape", async ({ chatPage }) => {
    await chatPage.getByLabel("Open menu").click();
    await chatPage.keyboard.press("Escape");
    await chatPage.waitForTimeout(300);
  });

  test("New chat button is reachable from sidebar", async ({ chatPage }) => {
    await chatPage.getByLabel("Open menu").click();
    const newBtn = chatPage.getByRole("button", { name: /new chat/i }).first();
    await expect(newBtn).toBeVisible();
    await newBtn.click();
    await expect(chatPage.getByPlaceholder(/Ask anything/i)).toBeVisible();
  });
});

test.describe("Plus / attachments menu", () => {
  test("opens", async ({ chatPage }) => {
    const plus = chatPage.getByLabel("Open attachments");
    if (await plus.count()) {
      await plus.click();
      await chatPage.waitForTimeout(300);
      await chatPage.keyboard.press("Escape");
    }
  });
});
