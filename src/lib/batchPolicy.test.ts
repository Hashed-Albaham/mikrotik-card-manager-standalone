import { describe, expect, it } from "vitest";
import { updateBatchMetadata } from "./batchPolicy";
import type { Batch } from "./model";

const batch: Batch = { id: "b1", createdAt: "2026-08-18T00:00:00.000Z", planId: "p1", routerVersion: "6", cards: [{ serial: 1, username: "1001", password: "2002" }], script: "/tool user-manager user add; ", status: "local" };

describe("batch edit policy", () => {
  it("updates only safe metadata and preserves generated cards and RSC", () => {
    const updated = updateBatchMetadata(batch, { name: "دفعة الفرع", status: "cancelled", notes: "أوقف قبل الإرسال" }, { id: "d1", version: "6" });
    expect(updated.name).toBe("دفعة الفرع");
    expect(updated.status).toBe("cancelled");
    expect(updated.cards).toEqual(batch.cards);
    expect(updated.script).toBe(batch.script);
  });

  it("rejects binding a batch to a different RouterOS generation", () => {
    expect(() => updateBatchMetadata(batch, { name: "دفعة", status: "local" }, { id: "d2", version: "7" })).toThrow("إصدار مختلف");
  });
});
