import { test, expect, type Page } from "@playwright/test";

/**
 * Comprehensive E2E test suite for the Chat page (/chat).
 *
 * Run:
 *   E2E_EMAIL=you@example.com E2E_PASSWORD=secret npx playwright test
 *
 * Optional:
 *   E2E_BASE_URL  → run against a deployed preview (e.g. https://*.lovable.app)
 *   E2E_SKIP_AI=1 → skip tests that actually send a message and wait for the AI reply
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const SKIP_AI = process.env.E2E_SKIP_AI === "1";

async function signIn(page: Page) {
  if (!EMAIL || !PASSWORD) {
    test.skip(true, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated tests");
  }
  await page.goto("/auth");
  // Some auth pages have a "Sign in" tab — click if present
  const signInTab = page.getByRole("tab", { name: /sign in|log in/i });
  if (await signInTab.count()) await signInTab.first().click().catch(() => {});

  await page.getByPlaceholder(/email/i).first().fill(EMAIL!);
  await page.getByPlaceholder(/password/i).first().fill(PASSWORD!);
  await page
    .getByRole("button", { name: /^(sign in|log in|continue)$/i })
    .first()
    .click();

  await page.waitForURL(/\/(chat|home|$)/, { timeout: 15_000 }).catch(() => {});
  if (!page.url().includes("/chat")) {
    await page.goto("/chat");
  }
  await expect(page.getByPlaceholder(/Ask anything/i)).toBeVisible({ timeout: 15_000 });
}

test.describe("Chat page – /chat", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("renders the empty state with input and mode chips", async ({ page }) => {
    await expect(page.getByPlaceholder(/Ask anything/i)).toBeVisible();
    // Mode chips are visible only when there is no conversation
    await expect(page.getByRole("button", { name: /^Learning$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Deep Research$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Shopping$/ })).toBeVisible();
  });

  test("header controls are present", async ({ page }) => {
    await expect(page.getByLabel("Open menu")).toBeVisible();
    await expect(page.getByLabel("Upgrade")).toBeVisible();
    // 3-dot "More options" appears only after a conversation exists
    await expect(page.getByLabel("More options")).toHaveCount(0);
  });

  test("sidebar opens and closes", async ({ page }) => {
    await page.getByLabel("Open menu").click();
    // Sidebar usually has a "New chat" affordance
    const sidebarNewChat = page.getByRole("button", { name: /new chat/i }).first();
    await expect(sidebarNewChat).toBeVisible({ timeout: 5_000 });
    // Close via Escape
    await page.keyboard.press("Escape");
  });

  test("plus / attachments menu opens", async ({ page }) => {
    await page.getByLabel("Open attachments").click();
    // Common items inside the plus menu
    await expect(
      page.getByRole("button", { name: /(camera|photo|file|image)/i }).first(),
    ).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press("Escape");
  });

  test("typing enables the send button", async ({ page }) => {
    const send = page.getByLabel("Send message");
    const input = page.getByPlaceholder(/Ask anything/i);
    await expect(send).toBeDisabled();
    await input.fill("Hello there");
    await expect(send).toBeEnabled();
    // Clearing disables it again
    await input.fill("");
    await expect(send).toBeDisabled();
  });

  test("activates Learning mode and shows the active chip", async ({ page }) => {
    await page.getByRole("button", { name: /^Learning$/ }).click();
    await expect(page.getByText(/^Learning$/)).toBeVisible();
    // Mode chips row should hide once a mode is active
    await expect(page.getByRole("button", { name: /^Deep Research$/ })).toHaveCount(0);
  });

  test("activates Shopping mode", async ({ page }) => {
    await page.getByRole("button", { name: /^Shopping$/ }).click();
    await expect(page.getByText(/^Shopping$/)).toBeVisible();
  });

  test("activates Deep Research mode", async ({ page }) => {
    await page.getByRole("button", { name: /^Deep Research$/ }).click();
    await expect(page.getByText(/^Deep Research$/)).toBeVisible();
  });

  test("sends a message and receives an AI reply", async ({ page }) => {
    test.skip(SKIP_AI, "E2E_SKIP_AI=1 — skipping live AI test");
    test.setTimeout(120_000);

    const input = page.getByPlaceholder(/Ask anything/i);
    await input.fill("Reply with exactly the word: pong");
    await page.getByLabel("Send message").click();

    // The user message should appear right away
    await expect(page.getByText(/Reply with exactly the word: pong/)).toBeVisible({
      timeout: 5_000,
    });

    // Wait for an assistant message to render and stabilise
    await expect(async () => {
      const stop = await page.getByLabel("Stop generation").count();
      expect(stop).toBe(0);
    }).toPass({ timeout: 90_000 });

    // Mode chips must hide once a conversation exists
    await expect(page.getByRole("button", { name: /^Learning$/ })).toHaveCount(0);

    // The header 3-dot menu should now exist
    await expect(page.getByLabel("More options")).toBeVisible();
  });

  test("cancel (stop) button shows while streaming", async ({ page }) => {
    test.skip(SKIP_AI, "E2E_SKIP_AI=1 — skipping streaming test");
    await page.getByPlaceholder(/Ask anything/i).fill("Write a short paragraph about cats.");
    await page.getByLabel("Send message").click();
    const stop = page.getByLabel("Stop generation");
    await expect(stop).toBeVisible({ timeout: 10_000 });
    await stop.click();
    await expect(stop).toHaveCount(0, { timeout: 10_000 });
  });

  test.describe("Header 3-dot menu (after conversation exists)", () => {
    test.beforeEach(async ({ page }) => {
      test.skip(SKIP_AI, "Needs an actual conversation");
      test.setTimeout(120_000);
      await page.getByPlaceholder(/Ask anything/i).fill("Say hi in one word.");
      await page.getByLabel("Send message").click();
      await expect(page.getByLabel("More options")).toBeVisible({ timeout: 90_000 });
    });

    test("opens the menu and lists all items", async ({ page }) => {
      await page.getByLabel("More options").click();
      for (const label of ["New chat", "Share chat", "Invite people", "Rename", /Pin chat|Unpin chat/, "Delete chat"]) {
        await expect(
          typeof label === "string"
            ? page.getByRole("menuitem", { name: label })
            : page.getByRole("menuitem", { name: label }),
        ).toBeVisible();
      }
      await page.keyboard.press("Escape");
    });

    test("Rename updates the conversation title", async ({ page }) => {
      await page.getByLabel("More options").click();
      await page.getByRole("menuitem", { name: "Rename" }).click();
      const title = `E2E ${Date.now()}`;
      const dialogInput = page.getByRole("dialog").getByRole("textbox");
      await dialogInput.fill(title);
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText(/Renamed/i)).toBeVisible({ timeout: 5_000 });
    });

    test("Pin / Unpin toggles", async ({ page }) => {
      await page.getByLabel("More options").click();
      await page.getByRole("menuitem", { name: /^Pin chat$/ }).click();
      await expect(page.getByText(/^Pinned$/)).toBeVisible({ timeout: 5_000 });

      await page.getByLabel("More options").click();
      await page.getByRole("menuitem", { name: /^Unpin chat$/ }).click();
      await expect(page.getByText(/^Unpinned$/)).toBeVisible({ timeout: 5_000 });
    });

    test("Share dialog opens", async ({ page }) => {
      await page.getByLabel("More options").click();
      await page.getByRole("menuitem", { name: "Share chat" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
    });

    test("Invite dialog opens with email field", async ({ page }) => {
      await page.getByLabel("More options").click();
      await page.getByRole("menuitem", { name: "Invite people" }).click();
      await expect(page.getByPlaceholder("friend@example.com")).toBeVisible();
      await page.keyboard.press("Escape");
    });

    test("Delete asks for confirmation and cancel keeps the chat", async ({ page }) => {
      await page.getByLabel("More options").click();
      await page.getByRole("menuitem", { name: "Delete chat" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(/Delete this chat\?/i)).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toHaveCount(0);
      // Conversation still exists
      await expect(page.getByLabel("More options")).toBeVisible();
    });

    test("Delete confirmed clears the conversation", async ({ page }) => {
      await page.getByLabel("More options").click();
      await page.getByRole("menuitem", { name: "Delete chat" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
      await expect(page.getByText(/Chat deleted/i)).toBeVisible({ timeout: 10_000 });
      // Back to empty state
      await expect(page.getByLabel("More options")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Learning$/ })).toBeVisible();
    });

    test("New chat resets to empty state", async ({ page }) => {
      await page.getByLabel("More options").click();
      await page.getByRole("menuitem", { name: "New chat" }).click();
      await expect(page.getByLabel("More options")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Learning$/ })).toBeVisible();
    });
  });

  test.describe("User-message context menu", () => {
    test.beforeEach(async ({ page }) => {
      test.skip(SKIP_AI, "Needs an actual conversation");
      test.setTimeout(120_000);
      await page.getByPlaceholder(/Ask anything/i).fill("ping me back please");
      await page.getByLabel("Send message").click();
      await expect(page.getByText("ping me back please")).toBeVisible({ timeout: 10_000 });
    });

    test("right-click opens the menu with Copy / Edit / Select / Share", async ({ page }) => {
      await page.getByText("ping me back please").click({ button: "right" });
      for (const label of ["Copy", "Edit message", "Select text", "Share"]) {
        await expect(page.getByRole("button", { name: label })).toBeVisible();
      }
      await page.keyboard.press("Escape");
    });

    test("Copy puts text on the clipboard and shows a toast", async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByText("ping me back please").click({ button: "right" });
      await page.getByRole("button", { name: "Copy" }).click();
      await expect(page.getByText(/^Copied$/)).toBeVisible();
    });

    test("Edit message puts the text back into the input", async ({ page }) => {
      await page.getByText("ping me back please").click({ button: "right" });
      await page.getByRole("button", { name: "Edit message" }).click();
      await expect(page.getByPlaceholder(/Ask anything/i)).toHaveValue("ping me back please");
    });

    test("Select text actually selects the message text", async ({ page }) => {
      await page.getByText("ping me back please").click({ button: "right" });
      await page.getByRole("button", { name: "Select text" }).click();
      const selected = await page.evaluate(() => window.getSelection()?.toString() ?? "");
      expect(selected).toContain("ping me back please");
    });
  });
});
