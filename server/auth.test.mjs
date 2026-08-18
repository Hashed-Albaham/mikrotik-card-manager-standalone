import { describe, expect, it } from "vitest";
import { activeUserOrError, initialPasswordHash } from "./auth.mjs";

describe("account activation protection", () => {
  it("denies missing, pending and expired accounts", () => {
    expect(activeUserOrError(null)).toContain("تسجيل الدخول");
    expect(activeUserOrError({ status: "pending" })).toContain("غير مفعل");
    expect(activeUserOrError({ status: "active", activation_expires_at: new Date(Date.now() - 1_000).toISOString() })).toContain("انتهت");
  });

  it("allows an active account with a future expiration", () => {
    expect(activeUserOrError({ status: "active", activation_expires_at: new Date(Date.now() + 60_000).toISOString() })).toBeNull();
  });

  it("prefers a supplied bcrypt hash for first-account provisioning", async () => {
    process.env.TEST_PASSWORD_HASH = "$2b$12$abcdefghijklmnopqrstuuWw6OnxlZO6ccKRrAIenJjzdvNnWD5rPS";
    process.env.TEST_PASSWORD_TEXT = "ThisValueIsNotUsed";
    await expect(initialPasswordHash("TEST_PASSWORD_HASH", "TEST_PASSWORD_TEXT")).resolves.toBe(process.env.TEST_PASSWORD_HASH);
  });
});
