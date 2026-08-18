import { describe, expect, it } from "vitest";
import { buildRsc } from "./cardEngine";

describe("standalone RSC output", () => {
  it("uses semicolon-delimited User Manager 6 profile binding without a hash comment", () => {
    const script = buildRsc([{ serial: 3, username: "576296", password: "" }], "user_manager", "6", "Unlimited30D", "admin");
    expect(script).toContain("comment=\"\" location=\"\"; ");
    expect(script).toContain("profile=\"Unlimited30D\" numbers=[find username=\"576296\"]; ");
    expect(script).toContain("customer=\"admin\"");
  });
});
