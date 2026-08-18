const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const net = require("node:net");
const tls = require("node:tls");

function encodeLength(length) {
  if (length < 0x80) return Buffer.from([length]);
  if (length < 0x4000) return Buffer.from([(length >> 8) | 0x80, length & 0xff]);
  if (length < 0x200000) return Buffer.from([(length >> 16) | 0xc0, (length >> 8) & 0xff, length & 0xff]);
  if (length < 0x10000000) return Buffer.from([(length >> 24) | 0xe0, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff]);
  return Buffer.from([0xf0, (length >> 24) & 0xff, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff]);
}

function decodeLength(buffer) {
  if (!buffer.length) return undefined;
  const first = buffer[0];
  const bytes = first < 0x80 ? 1 : first < 0xc0 ? 2 : first < 0xe0 ? 3 : first < 0xf0 ? 4 : 5;
  if (buffer.length < bytes) return undefined;
  if (bytes === 1) return { length: first, bytes };
  let length = bytes === 2 ? first & 0x3f : bytes === 3 ? first & 0x1f : bytes === 4 ? first & 0x0f : 0;
  for (let index = 1; index < bytes; index += 1) length = (length << 8) | buffer[index];
  return { length, bytes };
}

class RouterApi {
  constructor({ host, port }) { this.host = host; this.port = port; this.buffer = Buffer.alloc(0); this.sentences = []; this.waiters = []; }
  async connect() {
    const options = { host: this.host, port: this.port, timeout: 15_000, rejectUnauthorized: false };
    this.socket = this.port === 8729 ? tls.connect(options) : net.createConnection(options);
    await new Promise((resolve, reject) => { this.socket.once("connect", resolve); this.socket.once("error", reject); this.socket.once("timeout", () => reject(new Error("انتهت مهلة الاتصال بالراوتر."))); });
    this.socket.on("data", chunk => this.consume(chunk));
    this.socket.on("error", error => this.rejectWaiters(error));
  }
  consume(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]); const words = [];
    while (true) { const header = decodeLength(this.buffer); if (!header || this.buffer.length < header.bytes + header.length) break; const start = header.bytes; const word = this.buffer.subarray(start, start + header.length).toString("utf8"); this.buffer = this.buffer.subarray(start + header.length); if (!header.length) { this.sentences.push(words.splice(0)); this.resolveWaiters(); } else words.push(word); }
  }
  resolveWaiters() { while (this.waiters.length && this.sentences.length) this.waiters.shift().resolve(this.sentences.shift()); }
  rejectWaiters(error) { while (this.waiters.length) this.waiters.shift().reject(error); }
  nextSentence() { if (this.sentences.length) return Promise.resolve(this.sentences.shift()); return new Promise((resolve, reject) => this.waiters.push({ resolve, reject })); }
  write(words) { const buffers = words.map(word => { const content = Buffer.from(word, "utf8"); return Buffer.concat([encodeLength(content.length), content]); }); buffers.push(Buffer.from([0])); this.socket.write(Buffer.concat(buffers)); }
  async command(...words) { this.write(words); while (true) { const sentence = await this.nextSentence(); if (!sentence.length) continue; if (sentence[0] === "!done") return; if (sentence[0] === "!trap" || sentence[0] === "!fatal") throw new Error(sentence.join(" ")); } }
  async login(username, password) { await this.command("/login", `=name=${username}`, `=password=${password}`); }
  close() { this.socket?.destroy(); }
}

async function sendBatch(input) {
  const { host, port, username, password, script, scriptName } = input;
  if (!host || !username || !script || !scriptName) throw new Error("بيانات اتصال أو سكربت الدفعة غير مكتملة.");
  const api = new RouterApi({ host, port });
  try { await api.connect(); await api.login(username, password); await api.command("/system/script/add", `=name=${scriptName}`, `=source=${script}`, "=comment=Card batch"); await api.command("/system/script/run", `=number=${scriptName}`); return { status: "sent", scriptName }; } finally { api.close(); }
}

function createWindow() {
  const window = new BrowserWindow({ width: 1360, height: 900, minWidth: 960, minHeight: 650, webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false } });
  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) window.loadURL(developmentUrl); else window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => { ipcMain.handle("runtime:capabilities", () => ({ platform: "desktop", tcp: true, rest: true })); ipcMain.handle("mikrotik:send-batch", (_, input) => sendBatch(input)); createWindow(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
