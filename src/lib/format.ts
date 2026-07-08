const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBanglaNumber(input: number | string): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

export function formatBDT(amount: number, { bn = true }: { bn?: boolean } = {}): string {
  const rounded = Math.round(amount);
  const withCommas = rounded.toLocaleString("en-IN");
  return `৳ ${bn ? toBanglaNumber(withCommas) : withCommas}`;
}
