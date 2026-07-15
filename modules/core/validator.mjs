export function requireObject(value, name = "payload") {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Object.assign(new Error(`${name} deve ser um objeto.`), { status: 400 });
  return value;
}
export function requireText(value, name = "campo", max = 500) {
  const text = String(value ?? "").trim();
  if (!text) throw Object.assign(new Error(`${name} é obrigatório.`), { status: 400 });
  return text.slice(0, max);
}
