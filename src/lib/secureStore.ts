import { initialData, type AppData } from "./model";

const DB_NAME = "mikrotik-card-manager";
const STORE = "vault";
const PAYLOAD_KEY = "payload";
const SALT_KEY = "salt";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getValue<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function setValue(key: string, value: unknown) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));

async function keyFromPin(pin: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: saltBuffer, iterations: 210_000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export class SecureStore {
  private key: CryptoKey | null = null;

  async hasVault() { return Boolean(await getValue<string>(SALT_KEY)); }

  async unlock(pin: string) {
    if (pin.length < 6) throw new Error("يجب أن تتكون كلمة القفل من 6 رموز على الأقل.");
    let saltBase64 = await getValue<string>(SALT_KEY);
    if (!saltBase64) { const salt = crypto.getRandomValues(new Uint8Array(16)); saltBase64 = bytesToBase64(salt); await setValue(SALT_KEY, saltBase64); }
    this.key = await keyFromPin(pin, base64ToBytes(saltBase64));
    const payload = await getValue<{ iv: string; data: string }>(PAYLOAD_KEY);
    if (!payload) { await this.save(initialData); return initialData; }
    try {
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(payload.iv) }, this.key, base64ToBytes(payload.data));
      return JSON.parse(new TextDecoder().decode(plain)) as AppData;
    } catch { this.key = null; throw new Error("رمز القفل غير صحيح أو تلفت البيانات المحلية."); }
  }

  async save(data: AppData) {
    if (!this.key) throw new Error("افتح قفل التطبيق أولاً.");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.key, plain);
    await setValue(PAYLOAD_KEY, { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(encrypted)) });
  }

  lock() { this.key = null; }
}
