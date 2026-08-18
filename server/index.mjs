import cookieParser from "cookie-parser";
import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { database } from "./db.mjs";
import { applyBatchMetadata, batchMetadataSchema } from "./batches.mjs";
import { decryptText, encryptText } from "./crypto.mjs";
import { activeUserOrError, createSession, publicUser, sessionFromToken } from "./auth.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(directory, "..", "dist");
const app = express();
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? 3000);
const cookieName = "mcm_session";
const resourceKinds = ["device", "plan", "template", "batch"];

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(async (request, response, next) => { request.user = await sessionFromToken(request.cookies[cookieName]); next(); });

function sessionCookie(response, token) {
  response.cookie(cookieName, token, { httpOnly: true, sameSite: "lax", secure: isProduction, maxAge: 12 * 60 * 60 * 1000, path: "/" });
}
function requireActive(request, response, next) { const message = activeUserOrError(request.user); if (message) return response.status(401).json({ error: message }); return next(); }
function requireAdmin(request, response, next) { const message = activeUserOrError(request.user); if (message) return response.status(401).json({ error: message }); if (request.user.role !== "admin") return response.status(403).json({ error: "هذه العملية متاحة للمدير فقط." }); return next(); }
function resourceKind(request, response, next) { if (!resourceKinds.includes(request.params.kind)) return response.status(404).json({ error: "نوع السجل غير معروف." }); return next(); }
async function audit(actorId, action, subjectType, subjectId, metadata = null) { await database().execute("INSERT INTO audit_logs (id, actor_id, action, subject_type, subject_id, metadata) VALUES (?, ?, ?, ?, ?, ?)", [randomUUID(), actorId, action, subjectType, subjectId, metadata ? JSON.stringify(metadata) : null]); }
function storedPayload(kind, payload) { if (kind !== "device") return payload; const { password, ...safe } = payload; return typeof password === "string" && password.length ? { ...safe, passwordEncrypted: encryptText(password) } : safe; }
function presentedPayload(kind, payload) { if (kind !== "device") return payload; const { passwordEncrypted, ...safe } = payload; return passwordEncrypted ? { ...safe, password: decryptText(passwordEncrypted) } : safe; }
const batchReferenceField = { device: "deviceId", plan: "planId", template: "templateId" };
async function isReferencedByBatch(userId, kind, resourceId) { const field = batchReferenceField[kind]; if (!field) return false; const [rows] = await database().execute("SELECT id FROM resources WHERE user_id = ? AND kind = 'batch' AND JSON_UNQUOTE(JSON_EXTRACT(payload, ?)) = ? LIMIT 1", [userId, `$.${field}`, resourceId]); return rows.length > 0; }

const credentialsSchema = z.object({ username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{3,64}$/), password: z.string().min(12).max(128) });
const userUpdateSchema = z.object({ status: z.enum(["pending", "active", "suspended", "expired"]).optional(), role: z.enum(["admin", "user"]).optional(), activationExpiresAt: z.string().datetime().nullable().optional() });
const resourceSchema = z.object({ payload: z.record(z.string(), z.unknown()) });

app.post("/api/auth/register", async (request, response, next) => {
  try {
    const { username, password } = credentialsSchema.parse(request.body);
    const db = database();
    const [existing] = await db.execute("SELECT id FROM users WHERE username = ? LIMIT 1", [username]);
    if (existing.length) return response.status(409).json({ error: "اسم المستخدم مستخدم بالفعل." });
    const id = randomUUID();
    await db.execute("INSERT INTO users (id, username, password_hash, role, status) VALUES (?, ?, ?, 'user', 'pending')", [id, username, await bcrypt.hash(password, 12)]);
    await audit(id, "account.registered", "user", id);
    return response.status(201).json({ message: "تم إنشاء الحساب وهو بانتظار موافقة المدير." });
  } catch (error) { next(error); }
});

app.post("/api/auth/login", async (request, response, next) => {
  try {
    const { username, password } = credentialsSchema.parse(request.body);
    const [rows] = await database().execute("SELECT * FROM users WHERE username = ? LIMIT 1", [username]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return response.status(401).json({ error: "بيانات الدخول غير صحيحة." });
    const statusError = activeUserOrError(user);
    if (statusError) return response.status(403).json({ error: statusError });
    await database().execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
    sessionCookie(response, await createSession(user));
    return response.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

app.post("/api/auth/logout", (request, response) => { response.clearCookie(cookieName, { httpOnly: true, sameSite: "lax", secure: isProduction, path: "/" }); response.status(204).end(); });
app.get("/api/auth/me", requireActive, (request, response) => response.json({ user: publicUser(request.user) }));
app.get("/api/health", (request, response) => response.json({ mode: "self-hosted" }));

app.get("/api/resources/:kind", requireActive, resourceKind, async (request, response, next) => {
  try { const [rows] = await database().execute("SELECT id, payload, created_at, updated_at FROM resources WHERE user_id = ? AND kind = ? ORDER BY updated_at DESC", [request.user.id, request.params.kind]); return response.json({ records: rows.map(row => ({ id: row.id, ...presentedPayload(request.params.kind, JSON.parse(row.payload)), createdAt: row.created_at, updatedAt: row.updated_at })) }); } catch (error) { next(error); }
});
app.post("/api/resources/:kind", requireActive, resourceKind, async (request, response, next) => {
  try { const { payload } = resourceSchema.parse(request.body); const id = randomUUID(); const stored = storedPayload(request.params.kind, payload); await database().execute("INSERT INTO resources (id, user_id, kind, payload) VALUES (?, ?, ?, ?)", [id, request.user.id, request.params.kind, JSON.stringify(stored)]); await audit(request.user.id, "resource.created", request.params.kind, id); return response.status(201).json({ id, ...payload }); } catch (error) { next(error); }
});
app.put("/api/resources/:kind/:id", requireActive, resourceKind, async (request, response, next) => {
  try {
    const { payload } = resourceSchema.parse(request.body);
    if (request.params.kind === "batch") {
      const change = batchMetadataSchema.parse(payload); const [currentRows] = await database().execute("SELECT payload FROM resources WHERE id = ? AND user_id = ? AND kind = 'batch' LIMIT 1", [request.params.id, request.user.id]);
      if (!currentRows.length) return response.status(404).json({ error: "السجل غير موجود." }); const current = JSON.parse(currentRows[0].payload); let device;
      if (change.deviceId) { const [deviceRows] = await database().execute("SELECT payload FROM resources WHERE id = ? AND user_id = ? AND kind = 'device' LIMIT 1", [change.deviceId, request.user.id]); if (!deviceRows.length) return response.status(400).json({ error: "الجهاز المحدد غير موجود ضمن حسابك." }); device = JSON.parse(deviceRows[0].payload); }
      const nextPayload = applyBatchMetadata(current, change, device); await database().execute("UPDATE resources SET payload = ? WHERE id = ? AND user_id = ? AND kind = 'batch'", [JSON.stringify(nextPayload), request.params.id, request.user.id]); await audit(request.user.id, "batch.metadata_updated", "batch", request.params.id); return response.json({ id: request.params.id, ...nextPayload });
    }
    const stored = storedPayload(request.params.kind, payload); const [result] = await database().execute("UPDATE resources SET payload = ? WHERE id = ? AND user_id = ? AND kind = ?", [JSON.stringify(stored), request.params.id, request.user.id, request.params.kind]); if (!result.affectedRows) return response.status(404).json({ error: "السجل غير موجود." }); await audit(request.user.id, "resource.updated", request.params.kind, request.params.id); return response.json({ id: request.params.id, ...payload });
  } catch (error) { next(error); }
});
app.delete("/api/resources/:kind/:id", requireActive, resourceKind, async (request, response, next) => {
  try { if (await isReferencedByBatch(request.user.id, request.params.kind, request.params.id)) return response.status(409).json({ error: "لا يمكن الحذف لأن هذا السجل مرتبط بدفعة محفوظة. احذف أو عدّل الدفعات المرتبطة أولاً." }); const [result] = await database().execute("DELETE FROM resources WHERE id = ? AND user_id = ? AND kind = ?", [request.params.id, request.user.id, request.params.kind]); if (!result.affectedRows) return response.status(404).json({ error: "السجل غير موجود." }); await audit(request.user.id, "resource.deleted", request.params.kind, request.params.id); return response.status(204).end(); } catch (error) { next(error); }
});

app.get("/api/admin/users", requireAdmin, async (request, response, next) => { try { const [rows] = await database().execute("SELECT * FROM users ORDER BY created_at DESC"); return response.json({ users: rows.map(publicUser) }); } catch (error) { next(error); } });
app.patch("/api/admin/users/:id", requireAdmin, async (request, response, next) => {
  try {
    const update = userUpdateSchema.parse(request.body); const values = []; const fields = [];
    if (update.status) { fields.push("status = ?"); values.push(update.status); }
    if (update.role) { fields.push("role = ?"); values.push(update.role); }
    if ("activationExpiresAt" in update) { fields.push("activation_expires_at = ?"); values.push(update.activationExpiresAt ? new Date(update.activationExpiresAt) : null); }
    if (!fields.length) return response.status(400).json({ error: "لا توجد تغييرات." });
    values.push(request.params.id); const [result] = await database().execute(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values); if (!result.affectedRows) return response.status(404).json({ error: "المستخدم غير موجود." }); await audit(request.user.id, "user.updated", "user", request.params.id, update); const [rows] = await database().execute("SELECT * FROM users WHERE id = ?", [request.params.id]); return response.json({ user: publicUser(rows[0]) });
  } catch (error) { next(error); }
});

app.use(express.static(publicDir, { index: false, maxAge: isProduction ? "1h" : 0 }));
app.get(/.*/, (request, response) => response.sendFile(path.join(publicDir, "index.html")));
app.use((error, request, response, next) => { if (error instanceof z.ZodError) return response.status(400).json({ error: "البيانات المدخلة غير صالحة.", details: error.issues }); console.error(error); return response.status(500).json({ error: "حدث خطأ داخلي." }); });

app.listen(port, "0.0.0.0", () => console.log(`Self-hosted server listening on ${port}`));
