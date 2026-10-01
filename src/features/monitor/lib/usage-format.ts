export function fmtTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

// A cost is USD whatever the reader's locale is, so it is formatted as USD
// rather than as a bare number behind a hand-written `$`. Formatting the digits
// in the system locale and prefixing `$` printed `$15,00` on a `tr-TR` machine —
// a dollar sign over a decimal comma — and put the sign after the symbol
// (`$-15.00`). `Intl` places both correctly and pins the digits, so the cost a
// reader sees is the same everywhere and matches the Usage pill's own coverage.
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** A USD amount: `fmtCost(15)` → "$15.00". */
export function fmtCost(n: number): string {
  return USD.format(n);
}

export function fmtDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** A 0..1 fraction as a percentage: `fmtPct(0.823)` → "82%". */
export function fmtPct(frac: number, digits = 0): string {
  return `${(frac * 100).toFixed(digits)}%`;
}

/** An integer with locale grouping: `fmtNum(12345)` → "12,345". */
export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
