import { FormEvent, useState } from "react";
import { Account, api } from "./lib/api";

export function AuthGate({ onAuthenticated, adminOnly = false }: { onAuthenticated: (account: Account) => void; adminOnly?: boolean }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      if (mode === "register") { const result = await api.register(username, password); setMessage(result.message); setMode("login"); return; }
      const result = await api.login(username, password);
      if (adminOnly && result.user.role !== "admin") { setMessage("هذا الحساب ليس مديراً."); await api.logout(); return; }
      onAuthenticated(result.user);
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر إتمام الطلب."); } finally { setBusy(false); }
  };
  return <main className="lock-screen"><form className="lock-card" onSubmit={submit}><span className="brand-mark">M</span><h1>{adminOnly ? "بوابة إدارة النظام" : "مدير كروت MikroTik"}</h1><p>{mode === "login" ? "سجّل الدخول للوصول إلى المساحة الخاصة بك. لا يمكن للحساب قيد المراجعة الدخول قبل اعتماد المدير." : "أنشئ حساباً جديداً. سيرسل الطلب للمدير لاعتماده قبل السماح بالدخول."}</p><label>اسم المستخدم<input dir="ltr" pattern="[a-zA-Z0-9_.-]{3,64}" required value={username} onChange={event => setUsername(event.target.value)} /></label><label>كلمة المرور<input dir="ltr" type="password" minLength={12} required value={password} onChange={event => setPassword(event.target.value)} /></label>{message && <p className="error">{message}</p>}<button disabled={busy}>{busy ? "جارٍ المعالجة…" : mode === "login" ? "دخول" : "إنشاء حساب"}</button>{!adminOnly && <button className="secondary" type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}>{mode === "login" ? "إنشاء حساب جديد" : "لدي حساب بالفعل"}</button>}<small>تُدار حسابات النسخة الذاتية الاستضافة من بوابة المدير فقط.</small></form></main>;
}
