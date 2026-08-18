export type AccessMode = "hotspot" | "user_manager";
export type RouterVersion = "6" | "7";
export type GeneratorMode = "username_only" | "same" | "different";
export type Alphabet = "numeric" | "letters" | "alphanumeric";
export type LetterCase = "lower" | "upper" | "mixed";

export type TokenSettings = { alphabet: Alphabet; letterCase: LetterCase; length: number; prefix: string; suffix: string };
export type GeneratorSettings = { mode: GeneratorMode; username: TokenSettings; password: TokenSettings };
export type Device = { id: string; name: string; host: string; apiPort: number; restPort: number; version: RouterVersion; username: string; password: string };
export type Plan = { id: string; name: string; accessMode: AccessMode; profileName: string; generator: GeneratorSettings };
export type TemplateElement = { key: "username" | "password" | "serial" | "productionDate"; xMm: number; yMm: number; fontSizePt: number; align: "left" | "center" | "right" };
export type PrintTemplate = { id: string; name: string; backgroundDataUrl?: string; rows: number; columns: number; margins: { top: number; right: number; bottom: number; left: number }; gaps: { x: number; y: number }; elements: TemplateElement[] };
export type Card = { serial: number; username: string; password: string };
export type Batch = { id: string; createdAt: string; planId: string; deviceId?: string; routerVersion: RouterVersion; cards: Card[]; script: string; templateId?: string; notes?: string; status: "local" | "sent" | "cancelled" };
export type AppData = { devices: Device[]; plans: Plan[]; templates: PrintTemplate[]; batches: Batch[]; nextSerial: number };

export const defaultGenerator: GeneratorSettings = {
  mode: "different",
  username: { alphabet: "numeric", letterCase: "mixed", length: 6, prefix: "", suffix: "" },
  password: { alphabet: "numeric", letterCase: "mixed", length: 6, prefix: "", suffix: "" }
};

export const defaultTemplate: PrintTemplate = { id: "default", name: "قالب A4 الافتراضي", rows: 4, columns: 2, margins: { top: 10, right: 10, bottom: 10, left: 10 }, gaps: { x: 4, y: 4 }, elements: [{ key: "username", xMm: 8, yMm: 18, fontSizePt: 14, align: "left" }, { key: "password", xMm: 8, yMm: 30, fontSizePt: 14, align: "left" }, { key: "serial", xMm: 8, yMm: 48, fontSizePt: 8, align: "left" }, { key: "productionDate", xMm: 8, yMm: 55, fontSizePt: 7, align: "left" }] };

export const initialData: AppData = { devices: [], plans: [], templates: [defaultTemplate], batches: [], nextSerial: 1 };
