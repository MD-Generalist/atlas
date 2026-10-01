import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fmtCost } from "./usage-format";

// A cost is USD wherever it is read. The bug this guards — issue 333 — was a
// cost formatted through the *system* locale behind a hand-written `$`, which
// printed `$15,00` on a `tr-TR` machine and put the sign after the symbol
// (`$-15.00`) anywhere.
//
// Node resolves its default locale once, at startup, from the environment — so
// a test cannot change it and re-run the same code to watch the digits move.
// What can be pinned is the decision itself: the formatter must ask for a
// named locale and never for the ambient default. If someone reverts to
// `n.toLocaleString(undefined, …)`, the recorded locale comes back `undefined`
// and this fails on every machine, whatever locale CI happens to run under.
describe("fmtCost", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never formats through the system locale", async () => {
    const locales: Intl.LocalesArgument[] = [];
    const realFormat = Intl.NumberFormat;
    // `Intl.LocalesArgument` is wider than what the constructors accept, and a
    // `Locale` never reaches this code path — narrow at the call instead.
    const narrow = (l: Intl.LocalesArgument) => l as string | string[] | undefined;

    vi.spyOn(Number.prototype, "toLocaleString").mockImplementation(function (
      this: number,
      requested?: string | string[] | Intl.LocalesArgument,
      options?: Intl.NumberFormatOptions,
    ) {
      locales.push(requested);
      return realFormat(narrow(requested), options).format(this);
    });

    const ctor = Intl.NumberFormat;
    Intl.NumberFormat = function NumberFormat(
      locale?: string | string[] | Intl.LocalesArgument,
      options?: Intl.NumberFormatOptions,
    ) {
      locales.push(locale);
      return new ctor(narrow(locale), options);
    } as unknown as typeof Intl.NumberFormat;

    try {
      // A fresh import, because the formatter is built once at module scope.
      const { fmtCost: fresh } = await import("./usage-format");
      fresh(1234.5);
    } finally {
      Intl.NumberFormat = ctor;
    }

    expect(locales).not.toContain(undefined);
    expect(locales).toContain("en-US");
  });

  it("reads as USD in a comma-decimal locale, with the sign before the symbol", () => {
    // What `$15.00` and `-$15.00` are on a `tr-TR` machine now that the digits
    // are pinned: the locale can no longer turn the fraction into `,00`, and
    // `Intl` places a negative sign ahead of `$` rather than behind it.
    expect(fmtCost(15)).toBe("$15.00");
    expect(fmtCost(-15)).toBe("-$15.00");
  });

  it("keeps two fraction digits and groups thousands", () => {
    expect(fmtCost(0)).toBe("$0.00");
    expect(fmtCost(0.005)).toBe("$0.01");
    expect(fmtCost(1234.5)).toBe("$1,234.50");
    expect(fmtCost(1234567.891)).toBe("$1,234,567.89");
  });

  it("rounds a cost too small to show to zero, as it always has", () => {
    expect(fmtCost(0.0001)).toBe("$0.00");
  });
});
