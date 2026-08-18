import { describe, expect, it } from "vitest";
import { activeUserOrError } from "./auth.mjs";

describe("account activation protection", () => {
  it("denies missing, pending and expired accounts", () => {
    expect(activeUserOrError(null)).toContain("تسجيل الدخول");
    expect(activeUserOrError({ status: "pending" })).toContain("غير مفعل");
    expect(activeUserOrError({ status: "active", activation_expires_at: new Date(Date.now() - 1_000).toISOString() })).toContain("انتهت");
  });

  it("allows an active account with a future expiration", () => {
    expect(activeUserOrError({ status: "active", activation_expires_at: new Date(Date.now() + 60_000).toISOString() })).toBeNull();
  });
});
