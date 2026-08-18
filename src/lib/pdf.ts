import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Batch, PrintTemplate } from "./model";

const MM_TO_PT = 72 / 25.4;
const PAGE_WIDTH = 210 * MM_TO_PT;
const PAGE_HEIGHT = 297 * MM_TO_PT;

function box(template: PrintTemplate, index: number) {
  const widthMm = (210 - template.margins.left - template.margins.right - template.gaps.x * (template.columns - 1)) / template.columns;
  const heightMm = (297 - template.margins.top - template.margins.bottom - template.gaps.y * (template.rows - 1)) / template.rows;
  const column = index % template.columns;
  const row = Math.floor(index / template.columns);
  return { xMm: template.margins.left + column * (widthMm + template.gaps.x), yMm: template.margins.top + row * (heightMm + template.gaps.y), widthMm, heightMm };
}

function dataUrlBytes(value?: string) {
  if (!value) return undefined;
  const encoded = value.split(",")[1];
  return Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
}

function download(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function buildBatchPdf(batch: Batch, template: PrintTemplate) {
  const document = await PDFDocument.create();
  document.setTitle(`MikroTik cards ${batch.id}`);
  const textFont = await document.embedFont(StandardFonts.Helvetica);
  const monoFont = await document.embedFont(StandardFonts.Courier);
  const backgroundBytes = dataUrlBytes(template.backgroundDataUrl);
  const background = backgroundBytes ? template.backgroundDataUrl?.startsWith("data:image/png") ? await document.embedPng(backgroundBytes) : await document.embedJpg(backgroundBytes) : undefined;
  const perPage = Math.max(1, template.rows * template.columns);

  for (let start = 0; start < batch.cards.length; start += perPage) {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    batch.cards.slice(start, start + perPage).forEach((card, index) => {
      const current = box(template, index);
      const x = current.xMm * MM_TO_PT;
      const y = PAGE_HEIGHT - (current.yMm + current.heightMm) * MM_TO_PT;
      const width = current.widthMm * MM_TO_PT;
      const height = current.heightMm * MM_TO_PT;
      if (background) page.drawImage(background, { x, y, width, height });
      const values = { username: card.username, password: card.password, serial: `# ${card.serial}`, productionDate: batch.createdAt.slice(0, 10) };
      template.elements.forEach(element => {
        const value = values[element.key];
        if (!value) return;
        const font = element.key === "username" || element.key === "password" ? monoFont : textFont;
        const size = element.fontSizePt;
        const textWidth = font.widthOfTextAtSize(value, size);
        const textX = element.align === "center" ? x + width / 2 + element.xMm * MM_TO_PT - textWidth / 2 : element.align === "right" ? x + width - element.xMm * MM_TO_PT - textWidth : x + element.xMm * MM_TO_PT;
        page.drawText(value, { x: textX, y: PAGE_HEIGHT - (current.yMm + element.yMm) * MM_TO_PT - size, font, size });
      });
    });
  }
  return document.save();
}

export async function exportBatchPdf(batch: Batch, template: PrintTemplate) {
  download(await buildBatchPdf(batch, template), `mikrotik-cards-${batch.id}.pdf`);
}
