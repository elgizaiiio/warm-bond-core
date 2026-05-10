import { test, expect } from "./fixtures";

test.describe("Chat empty state UI", () => {
  test("input is visible and empty initially", async ({ chatPage }) => {
    const input = chatPage.getByPlaceholder(/Ask anything/i);
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("");
  });

  test("send button starts disabled", async ({ chatPage }) => {
    await expect(chatPage.getByLabel("Send message")).toBeDisabled();
  });

  test("typing toggles send button enable/disable", async ({ chatPage }) => {
    const input = chatPage.getByPlaceholder(/Ask anything/i);
    const send = chatPage.getByLabel("Send message");
    await input.fill("hi");
    await expect(send).toBeEnabled();
    await input.fill("");
    await expect(send).toBeDisabled();
  });

  test("whitespace-only input keeps send disabled", async ({ chatPage }) => {
    const input = chatPage.getByPlaceholder(/Ask anything/i);
    await input.fill("   \n  \t ");
    await expect(chatPage.getByLabel("Send message")).toBeDisabled();
  });

  test("very long input still enables send", async ({ chatPage }) => {
    const input = chatPage.getByPlaceholder(/Ask anything/i);
    await input.fill("x".repeat(5000));
    await expect(chatPage.getByLabel("Send message")).toBeEnabled();
  });

  test("emoji and unicode input is accepted", async ({ chatPage }) => {
    const input = chatPage.getByPlaceholder(/Ask anything/i);
    await input.fill("سلام 🌟 Привет 你好 שלום");
    await expect(input).toHaveValue("سلام 🌟 Привет 你好 שלום");
    await expect(chatPage.getByLabel("Send message")).toBeEnabled();
  });

  test("RTL Arabic content is preserved", async ({ chatPage }) => {
    const input = chatPage.getByPlaceholder(/Ask anything/i);
    await input.fill("اختبار باللغة العربية");
    await expect(input).toHaveValue("اختبار باللغة العربية");
  });

  test("input survives focus/blur", async ({ chatPage }) => {
    const input = chatPage.getByPlaceholder(/Ask anything/i);
    await input.fill("persist me");
    await chatPage.locator("body").click();
    await expect(input).toHaveValue("persist me");
  });

  test("header upgrade chip is visible", async ({ chatPage }) => {
    await expect(chatPage.getByLabel("Upgrade")).toBeVisible();
  });

  test("More options menu absent without conversation", async ({ chatPage }) => {
    await expect(chatPage.getByLabel("More options")).toHaveCount(0);
  });
});
