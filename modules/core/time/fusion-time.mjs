// FUSION TIMEZONE OPERACIONAL 20260826
export const FUSION_TIMEZONE = String(
  process.env.FUSION_TIMEZONE || "America/Maceio"
).trim() || "America/Maceio";

export function dataLocalISO(valor = new Date(), timeZone = FUSION_TIMEZONE) {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return "";

  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(data);

  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return mapa.year && mapa.month && mapa.day
    ? `${mapa.year}-${mapa.month}-${mapa.day}`
    : "";
}

export function horaLocalHHMMSS(valor = new Date(), timeZone = FUSION_TIMEZONE) {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return "";

  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(data);

  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return mapa.hour && mapa.minute && mapa.second
    ? `${mapa.hour}:${mapa.minute}:${mapa.second}`
    : "";
}
