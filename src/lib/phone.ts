/**
 * Phone numbers for WhatsApp links (wa.me needs the international number,
 * digits only). Accepted:
 *   - Israeli local numbers starting with 0 (mobile 05X…, 07X, landlines)
 *     → converted to 972…;
 *   - international numbers starting with + or 00.
 * Anything else (no prefix, too short/long, letters) is refused with a
 * reason — never guessed. Spaces, dashes, dots, slashes and brackets are ignored.
 */
export type PhoneCheck =
  | { ok: true; international: string; display: string }
  | { ok: false; reason: "empty" | "invalid"; message: string };

const ISRAELI_NATIONAL = /^(5\d{8}|7\d{8}|[23489]\d{7})$/;

export function normalizePhone(raw: string | null | undefined): PhoneCheck {
  const input = (raw ?? "").trim();
  if (!input) return { ok: false, reason: "empty", message: "אין מספר טלפון." };
  const compact = input.replace(/[\s\-().\/]/g, "");
  let digits: string;
  if (compact.startsWith("+")) digits = compact.slice(1);
  else if (compact.startsWith("00")) digits = compact.slice(2);
  else if (compact.startsWith("0")) digits = `972${compact.slice(1)}`;
  else {
    return { ok: false, reason: "invalid", message: `המספר ״${input}״ חסר קידומת: מספר ישראלי מתחיל ב־0, ומספר מחו״ל ב־+.` };
  }
  if (!/^\d+$/.test(digits)) return { ok: false, reason: "invalid", message: `המספר ״${input}״ מכיל תווים שאינם ספרות.` };

  if (digits.startsWith("972")) {
    const national = digits.slice(3);
    if (!ISRAELI_NATIONAL.test(national)) return { ok: false, reason: "invalid", message: `המספר ״${input}״ אינו מספר ישראלי תקין.` };
    const display = national.startsWith("5") || national.startsWith("7")
      ? `+972 ${national.slice(0, 2)}-${national.slice(2, 5)}-${national.slice(5)}`
      : `+972 ${national.slice(0, 1)}-${national.slice(1, 4)}-${national.slice(4)}`;
    return { ok: true, international: digits, display };
  }
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) {
    return { ok: false, reason: "invalid", message: `המספר ״${input}״ אינו מספר בינלאומי תקין.` };
  }
  return { ok: true, international: digits, display: `+${digits}` };
}

/** A non-blocking note for a saved number WhatsApp won't understand (null when fine or empty). */
export function phoneWarning(label: string, raw: string): string | null {
  const check = normalizePhone(raw);
  return !check.ok && check.reason === "invalid" ? `${label}: ${check.message} הפרטים נשמרו, אבל תזכורת בוואטסאפ לא תעבוד עם המספר הזה.` : null;
}
