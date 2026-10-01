import { describe, expect, it } from "vitest";
import { sanitizeAgentPrefs } from "./agent-notify-prefs-store";

describe("sanitizeAgentPrefs", () => {
  it("falls back to defaults for junk", () => {
    expect(sanitizeAgentPrefs(null)).toEqual({
      enabled: true,
      native: true,
      sound: true,
      minDurationMs: 0,
    });
    expect(sanitizeAgentPrefs({ enabled: "no", minDurationMs: -5 }).enabled).toBe(true);
    expect(sanitizeAgentPrefs({ minDurationMs: -5 }).minDurationMs).toBe(0);
  });

  it("keeps valid values", () => {
    expect(
      sanitizeAgentPrefs({ enabled: false, native: false, sound: false, minDurationMs: 30_000 }),
    ).toEqual({ enabled: false, native: false, sound: false, minDurationMs: 30_000 });
  });
});
