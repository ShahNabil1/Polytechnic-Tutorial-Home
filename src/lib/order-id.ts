// Sequential order ID generator: PTH001, PTH002, ...
// Persists counter in localStorage; unlimited (pad grows automatically past 999).
const KEY = "pth:order:seq";

export function nextOrderId(): string {
  let n = 0;
  try {
    const raw = localStorage.getItem(KEY);
    n = raw ? parseInt(raw, 10) || 0 : 0;
  } catch {}
  n += 1;
  try {
    localStorage.setItem(KEY, String(n));
  } catch {}
  return `PTH${String(n).padStart(3, "0")}`;
}

export function peekOrderSeq(): number {
  try {
    return parseInt(localStorage.getItem(KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}
