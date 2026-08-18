import type { AccessMode, Card, GeneratorSettings, RouterVersion } from "./model";

const letters = "abcdefghijklmnopqrstuvwxyz";
function alphabet(kind: GeneratorSettings["username"]["alphabet"], letterCase: GeneratorSettings["username"]["letterCase"]) {
  const chosenLetters = letterCase === "upper" ? letters.toUpperCase() : letterCase === "mixed" ? letters + letters.toUpperCase() : letters;
  return kind === "numeric" ? "0123456789" : kind === "letters" ? chosenLetters : "0123456789" + chosenLetters;
}
function token(settings: GeneratorSettings["username"]) {
  const characters = alphabet(settings.alphabet, settings.letterCase);
  const random = crypto.getRandomValues(new Uint32Array(settings.length));
  return settings.prefix + Array.from(random, value => characters[value % characters.length]).join("") + settings.suffix;
}

export function generateCards(count: number, serialStart: number, settings: GeneratorSettings, reserved: Iterable<string> = []): Card[] {
  const used = new Set(Array.from(reserved, value => value.trim().toLowerCase()));
  const cards: Card[] = [];
  for (let index = 0; index < count; index += 1) {
    let username = "";
    for (let tries = 0; tries < 250; tries += 1) { const candidate = token(settings.username); if (!used.has(candidate.toLowerCase())) { username = candidate; used.add(candidate.toLowerCase()); break; } }
    if (!username) throw new Error("تعذر إنشاء اسم مستخدم فريد ضمن إعدادات التوليد الحالية.");
    cards.push({ serial: serialStart + index, username, password: settings.mode === "username_only" ? "" : settings.mode === "same" ? username : token(settings.password) });
  }
  return cards;
}

function quote(value: string) { return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\r\n]/g, " ")}"`; }
export function buildRsc(cards: Card[], accessMode: AccessMode, version: RouterVersion, profileName = "", legacyCustomer = "") {
  return cards.flatMap(card => {
    const profile = profileName ? ` profile=${quote(profileName)}` : "";
    const comment = ` comment=${quote(`Card ${card.serial}`)}`;
    if (accessMode === "hotspot") return [`/ip/hotspot/user/add name=${quote(card.username)} password=${quote(card.password)}${profile}${comment}`];
    if (version === "7") return [`/user-manager/user/add name=${quote(card.username)} password=${quote(card.password)}${comment}`, ...(profileName ? [`/user-manager/user-profile/add user=${quote(card.username)} profile=${quote(profileName)}`] : [])];
    const customer = ` customer=${quote(legacyCustomer || "admin")}`;
    return [`/tool/user-manager/user/add${customer} username=${quote(card.username)} password=${quote(card.password)} comment="" location=""`, ...(profileName ? [`/tool/user-manager/user/create-and-activate-profile${customer} profile=${quote(profileName)} numbers=[find username=${quote(card.username)}]`] : [])];
  }).map(command => `${command}; `).join("\n");
}
