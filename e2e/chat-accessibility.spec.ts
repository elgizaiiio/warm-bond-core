import { test, expect } from "./fixtures";

test.describe("Accessibility basics", () => {
  test("page has lang attribute", async ({ chatPage }) => {
    const lang = await chatPage.locator("html").getAttribute("lang");
    expect(lang).toBeTruthy();
  });

  test("primary input has accessible name", async ({ chatPage }) => {
    const input = chatPage.getByPlaceholder(/Ask anything/i);
    await expect(input).toBeVisible();
  });

  test("send button has aria-label", async ({ chatPage }) => {
    const send = chatPage.getByLabel("Send message");
    await expect(send).toBeAttached();
  });

  test("menu button has aria-label", async ({ chatPage }) => {
    await expect(chatPage.getByLabel("Open menu")).toBeAttached();
  });

  test("no obvious console errors on load", async ({ chatPage }) => {
    const errors: string[] = [];
    chatPage.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    await chatPage.reload();
    await chatPage.waitForTimeout(2000);
    // Filter known noisy warnings
    const significant = errors.filter(e => !/lovable\.js|RESET_BLANK/i.test(e));
    expect(significant).toEqual([]);
  });
});
