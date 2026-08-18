import { beforeEach, describe, expect, it } from "vitest";
import { decryptText, encryptText } from "./crypto.mjs";

describe("server credential encryption", () => {
  beforeEach(() => { process.env.RESOURCE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64"); });

  it("encrypts a credential with a non-deterministic authenticated cipher", () => {
    const first = encryptText("RouterPassword!2026");
    const second = encryptText("RouterPassword!2026");
    expect(first).not.toBe(second);
    expect(first).not.toContain("RouterPassword!2026");
    expect(decryptText(first)).toBe("RouterPassword!2026");
  });

  it("rejects malformed encrypted values", () => {
    expect(() => decryptText("untrusted")).toThrow("Stored credential format is invalid");
  });
});
