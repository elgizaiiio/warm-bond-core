import { test as base, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ltgampdtawuefwwayncx.supabase.co";
const SUPABASE_KEY = process.env.E2E_SUPABASE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0Z2FtcGR0YXd1ZWZ3d2F5bmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3Njk5ODAsImV4cCI6MjA4ODM0NTk4MH0.5ZOzuxCrm-TO4zzRDJ68LrCLH3f0itiznUxhbEupvGg";

export interface TestUser {
  email: string;
  password: string;
  id: string;
  accessToken: string;
  refreshToken: string;
}

/** Create a fresh anonymous-ish account via Supabase signUp. */
export async function createTestUser(): Promise<TestUser> {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const email = `e2e+${stamp}@example.test`;
  const password = `Test!${stamp}A1`;
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error || !data.session) {
    throw new Error(`signUp failed: ${error?.message ?? "no session (email confirmation likely required)"}`);
  }
  return {
    email,
    password,
    id: data.user!.id,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

/** Inject Supabase session into localStorage so the app boots logged-in. */
export async function injectSession(page: Page, user: TestUser) {
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1] ?? "";
  const storageKey = `sb-${projectRef}-auth-token`;
  const session = {
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: { id: user.id, email: user.email },
  };
  await page.addInitScript(
    ([key, value]) => {
      try { window.localStorage.setItem(key as string, value as string); } catch {}
    },
    [storageKey, JSON.stringify(session)],
  );
}

export const test = base.extend<{ user: TestUser; chatPage: Page }>({
  user: async ({}, use) => {
    const u = await createTestUser();
    await use(u);
  },
  chatPage: async ({ page, user }, use) => {
    await injectSession(page, user);
    await page.goto("/chat");
    await expect(page.getByPlaceholder(/Ask anything/i)).toBeVisible({ timeout: 20_000 });
    await use(page);
  },
});

export { expect };
