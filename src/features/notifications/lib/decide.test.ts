import { describe, expect, it } from "vitest";
import { NOTIFICATION_CATALOG } from "./catalog";
import {
  DEFAULT_KIND_PREFS,
  LOOKING_WINDOW_MS,
  decideNotification,
  type NotificationEnv,
  type NotificationEvent,
  type NotificationPrefs,
} from "./decide";

const event = (kind: NotificationEvent["kind"]): NotificationEvent => ({
  kind,
  title: "Title",
  body: "Body",
  target: { type: "terminal", tabId: "t1", terminalId: "pty-1", projectName: "atlas" },
  dedupeKey: `k:${kind}`,
});

const away: NotificationEnv = {
  windowFocused: false,
  sinceInputMs: 999_999,
  targetVisible: false,
  projectActive: true,
};
const looking: NotificationEnv = {
  windowFocused: true,
  sinceInputMs: 1_000,
  targetVisible: true,
  projectActive: true,
};
/** In the app, looking somewhere else. */
const elsewhere: NotificationEnv = { ...looking, targetVisible: false };

const withSound: NotificationPrefs = {
  "terminal-done": { enabled: true, native: true, sound: true },
  "terminal-attention": { enabled: true, native: true, sound: true },
};

describe("decideNotification", () => {
  it("uses every channel when the user is away", () => {
    const d = decideNotification(event("terminal-done"), away, withSound);
    expect(d?.channels).toEqual({
      center: true,
      toast: true,
      native: true,
      badge: true,
      sound: true,
    });
    expect(d?.native).toEqual({ title: "Atlas: atlas", body: "Title — Body", sound: "Ping" });
  });

  it("returns null when the kind is disabled", () => {
    expect(
      decideNotification(event("terminal-done"), away, {
        "terminal-done": { ...DEFAULT_KIND_PREFS, enabled: false },
      }),
    ).toBeNull();
  });

  it("falls back to default prefs for a kind with none", () => {
    const d = decideNotification(event("terminal-failed"), away, {});
    expect(d?.channels.native).toBe(DEFAULT_KIND_PREFS.native);
    expect(d?.channels.sound).toBe(DEFAULT_KIND_PREFS.sound);
  });

  it("drops a 'drop' kind while looking, and records a 'record' kind", () => {
    expect(decideNotification(event("terminal-done"), looking, {})).toBeNull();
    const d = decideNotification(event("terminal-failed"), looking, {});
    expect(d?.channels).toEqual({
      center: true,
      toast: false,
      native: false,
      badge: false,
      sound: false,
    });
  });

  it("is not 'looking' once input is older than the window", () => {
    const idle = { ...looking, sinceInputMs: LOOKING_WINDOW_MS };
    expect(decideNotification(event("terminal-done"), idle, {})).not.toBeNull();
  });

  it("toasts, without a banner, when focused on something else", () => {
    const d = decideNotification(event("terminal-done"), elsewhere, withSound);
    expect(d?.channels).toEqual({
      center: true,
      toast: true,
      native: false,
      badge: false,
      sound: false,
    });
  });

  it("chimes in-app only for needs-you kinds whose target is off screen", () => {
    const d = decideNotification(event("terminal-attention"), elsewhere, withSound);
    expect(d?.tier).toBe("needs-you");
    expect(d?.channels.sound).toBe(true);
    expect(d?.native.sound).toBeUndefined();
  });

  it("respects the native pref (and so the banner sound)", () => {
    const d = decideNotification(event("terminal-done"), away, {
      "terminal-done": { enabled: true, native: false, sound: true },
    });
    expect(d?.channels.native).toBe(false);
    expect(d?.channels.sound).toBe(false);
    expect(d?.channels.badge).toBe(true);
  });

  it("carries catalog metadata onto the decision", () => {
    const d = decideNotification(event("terminal-attention"), away, {});
    expect(d?.toast).toEqual(NOTIFICATION_CATALOG["terminal-attention"].toast);
    expect(d?.groupKey).toBe("terminal:pty-1");
  });

  it("labels a target with no project by its type", () => {
    const e = {
      ...event("terminal-done"),
      target: { type: "terminal" as const, tabId: "t", terminalId: "p" },
    };
    expect(decideNotification(e, away, {})?.native.title).toBe("Atlas: Terminal");
  });
});
