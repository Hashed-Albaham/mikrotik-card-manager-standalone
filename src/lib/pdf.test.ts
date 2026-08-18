import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildBatchPdf } from "./pdf";
import type { Batch, PrintTemplate } from "./model";

describe("A4 PDF layout", () => {
  it("splits a dense 18 by 4 template into matching A4 pages", async () => {
    const template: PrintTemplate = { id: "dense", name: "كثيف", rows: 18, columns: 4, margins: { top: 5, right: 5, bottom: 5, left: 5 }, gaps: { x: 1, y: 1 }, elements: [{ key: "username", xMm: 1, yMm: 3, fontSizePt: 4, align: "left" }, { key: "password", xMm: 1, yMm: 6, fontSizePt: 4, align: "left" }] };
    const batch: Batch = { id: "dense-batch", createdAt: "2026-08-18T00:00:00.000Z", planId: "p1", routerVersion: "6", status: "local", script: "", cards: Array.from({ length: 73 }, (_, index) => ({ serial: index + 1, username: `U${index + 1}`, password: `P${index + 1}` })) };
    const pdf = await PDFDocument.load(await buildBatchPdf(batch, template));
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(210 * (72 / 25.4), 4);
    expect(pdf.getPage(0).getSize().height).toBeCloseTo(297 * (72 / 25.4), 4);
  });
});
