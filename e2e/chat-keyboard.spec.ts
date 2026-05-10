import { test, expect } from "./fixtures";

test.describe("Keyboard interactions", () => {
  test("Tab focuses interactive controls", async ({ chatPage }) => {
    await chatPage.keyboard.press("Tab");
    const focused = await chatPage.evaluate(() => document.activeElement?.tagName);
    expect(["BUTTON", "A", "INPUT", "TEXTAREA"]).toContain(focused);
  });

  test("Enter in input does not submit empty", async ({ chatPage }) => {
    const input = chatPage.getByPlaceholder(/Ask anything/i);
    await input.focus();
    await chatPage.keyboard.press("Enter");
    // No assistant message should appear
    await chatPage.waitForTimeout(500);
    await expect(chatPage.getByLabel("Stop generation")).toHaveCount(0);
  });

  test("Shift+Enter inserts a newline", async ({ chatPage }) => {
    const input = chatPage.getByPlaceholder(/Ask anything/i);
    await input.focus();
    await chatPage.keyboard.type("line1");
    await chatPage.keyboard.press("Shift+Enter");
    await chatPage.keyboard.type("line2");
    const value = await input.inputValue();
    expect(value).toContain("line1");
    expect(value).toContain("line2");
  });
});
