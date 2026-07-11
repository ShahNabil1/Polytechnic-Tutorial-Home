const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBanglaNumber(input: number | string): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

export function formatBDT(amount: number, { bn = true }: { bn?: boolean } = {}): string {
  const rounded = Math.round(amount);
  const withCommas = rounded.toLocaleString("en-IN");
  return `৳ ${bn ? toBanglaNumber(withCommas) : withCommas}`;
}

/** English-numeral BDT — used in internal workspace/admin UI. */
export function formatBDTEn(amount: number): string {
  return formatBDT(amount, { bn: false });
}

/** Build a wa.me link for a Bangladeshi phone in local (01XXXXXXXXX) format. */
export function waLinkBD(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!/^01[3-9]\d{8}$/.test(digits)) return null;
  return `https://wa.me/880${digits.slice(1)}`;
}
