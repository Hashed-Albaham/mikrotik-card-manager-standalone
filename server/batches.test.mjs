import { describe, expect, it } from "vitest";
import { applyBatchMetadata, batchMetadataSchema } from "./batches.mjs";

const batch = { name: "دفعة", routerVersion: "6", cards: [{ username: "1001", password: "2002" }], script: "/tool/user-manager/user/add; ", status: "local" };

describe("server batch update policy", () => {
  it("accepts only metadata and retains generated output", () => {
    const change = batchMetadataSchema.parse({ name: "دفعة معدلة", status: "cancelled", notes: "اختبار" });
    const updated = applyBatchMetadata(batch, change);
    expect(updated.cards).toEqual(batch.cards);
    expect(updated.script).toBe(batch.script);
    expect(updated.status).toBe("cancelled");
  });

  it("rejects attempts to mutate generated output fields", () => {
    expect(() => batchMetadataSchema.parse({ name: "دفعة", status: "local", cards: [] })).toThrow();
    expect(() => batchMetadataSchema.parse({ name: "دفعة", status: "local", script: "changed" })).toThrow();
  });

  it("rejects a different RouterOS version for the selected device", () => {
    const change = batchMetadataSchema.parse({ name: "دفعة", status: "local", deviceId: "550e8400-e29b-41d4-a716-446655440000" });
    expect(() => applyBatchMetadata(batch, change, { version: "7" })).toThrow("إصدار مختلف");
  });
});
