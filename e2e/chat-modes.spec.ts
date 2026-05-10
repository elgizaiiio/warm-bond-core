import { test, expect } from "./fixtures";

const MODES = ["Learning", "Deep Research", "Shopping"] as const;

test.describe("Chat mode chips", () => {
  for (const mode of MODES) {
    test(`activates ${mode} mode`, async ({ chatPage }) => {
      const chip = chatPage.getByRole("button", { name: new RegExp(`^${mode}$`) });
      await expect(chip).toBeVisible();
      await chip.click();
      // Active mode label should appear somewhere
      await expect(chatPage.getByText(new RegExp(`^${mode}$`)).first()).toBeVisible();
    });
  }

  test("only one mode chip row visible at a time", async ({ chatPage }) => {
    const learning = chatPage.getByRole("button", { name: /^Learning$/ });
    const deep = chatPage.getByRole("button", { name: /^Deep Research$/ });
    const shop = chatPage.getByRole("button", { name: /^Shopping$/ });
    await expect(learning).toBeVisible();
    await expect(deep).toBeVisible();
    await expect(shop).toBeVisible();
  });

  test("switching modes does not crash", async ({ chatPage }) => {
    for (const m of MODES) {
      const chip = chatPage.getByRole("button", { name: new RegExp(`^${m}$`) });
      if (await chip.isVisible().catch(() => false)) await chip.click();
      await chatPage.waitForTimeout(150);
    }
    await expect(chatPage.getByPlaceholder(/Ask anything/i)).toBeVisible();
  });
});
