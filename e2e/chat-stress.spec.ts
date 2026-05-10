import { test, expect } from "./fixtures";

test.describe("Stress / edge cases", () => {
  test("rapid focus/blur 30x", async ({ chatPage }) => {
    const input = chatPage.getByPlaceholder(/Ask anything/i);
    for (let i = 0; i < 30; i++) {
      await input.focus();
      await chatPage.locator("body").click();
    }
    await expect(input).toBeVisible();
  });

  test("rapid sidebar open/close 20x", async ({ chatPage }) => {
    for (let i = 0; i < 20; i++) {
      await chatPage.getByLabel("Open menu").click();
      await chatPage.keyboard.press("Escape");
    }
    await expect(chatPage.getByPlaceholder(/Ask anything/i)).toBeVisible();
  });

  test("paste 10kb text", async ({ chatPage }) => {
    const big = "lorem ipsum ".repeat(900);
    const input = chatPage.getByPlaceholder(/Ask anything/i);
    await input.fill(big);
    expect((await input.inputValue()).length).toBeGreaterThan(9000);
  });

  test("typing burst then clear", async ({ chatPage }) => {
    const input = chatPage.getByPlaceholder(/Ask anything/i);
    for (let i = 0; i < 50; i++) await input.pressSequentially("a", { delay: 1 });
    await input.fill("");
    await expect(chatPage.getByLabel("Send message")).toBeDisabled();
  });

  test("viewport resize does not break layout", async ({ chatPage }) => {
    for (const [w, h] of [[320, 568], [768, 1024], [1280, 800], [1920, 1080]] as const) {
      await chatPage.setViewportSize({ width: w, height: h });
      await expect(chatPage.getByPlaceholder(/Ask anything/i)).toBeVisible();
    }
  });
});
