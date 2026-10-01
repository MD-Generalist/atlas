import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_NOTIFICATION_PREFS,
  agentKindPrefs,
  decideAgentNotification,
  isSupersededTurn,
  type AgentCtx,
  type AgentNotificationPrefs,
  type AgentNotifyEvent,
} from "./agent-notifier-rules";
import { AWAY_IDLE_MS, computeAway, type NotificationEnv } from "./decide";

const ctx: AgentCtx = {
  tabId: "chat-1",
  sessionId: "acp-1",
  sessionTitle: "Fix the build",
  projectId: "ws-a",
  projectName: "atlas",
  orgId: "org-1",
};
const prefs: AgentNotificationPrefs = DEFAULT_AGENT_NOTIFICATION_PREFS;

const away: NotificationEnv = {
  windowFocused: false,
  sinceInputMs: 999_999,
  targetVisible: false,
  projectActive: true,
  away: true,
};
const looking: NotificationEnv = {
  windowFocused: true,
  sinceInputMs: 1_000,
  targetVisible: true,
  projectActive: true,
  away: false,
};

const finished = (over: Partial<Extract<AgentNotifyEvent, { type: "turn_finished" }>> = {}) =>
  ({ type: "turn_finished", stopReason: "end_turn", nonce: 1, ...over }) as AgentNotifyEvent;
const failed: AgentNotifyEvent = { type: "turn_failed", error: "Rate limited", nonce: 2 };
const disconnected: AgentNotifyEvent = {
  type: "agent_disconnected",
  agentId: "a1",
  reason: "exit 1",
  nonce: 3,
};
const permission: AgentNotifyEvent = {
  type: "permission_requested",
  requestId: "r1",
  toolTitle: "rm -rf dist",
};

describe("decideAgentNotification", () => {
  it("announces a finished turn on every channel but sound", () => {
    const d = decideAgentNotification(finished(), ctx, away, prefs);
    expect(d?.kind).toBe("agent-done");
    expect(d?.title).toBe("Fix the build");
    expect(d?.channels).toEqual({
      center: true,
      toast: true,
      native: true,
      badge: true,
      sound: false,
    });
  });

  it("never notifies for a user-cancelled turn", () => {
    expect(decideAgentNotification(finished({ stopReason: "cancelled" }), ctx, away, prefs)).toBe(
      null,
    );
  });

  it("drops a finish while the user is looking at the session", () => {
    expect(decideAgentNotification(finished(), ctx, looking, prefs)).toBeNull();
  });

  it("failure reaches center, toast and the OS banner when away", () => {
    const d = decideAgentNotification(failed, ctx, away, prefs);
    expect(d?.kind).toBe("agent-failed");
    expect(d?.body).toBe("Rate limited");
    expect(d?.channels).toMatchObject({ center: true, toast: true, native: true, badge: true });
  });

  it("failure is still recorded while looking, with no banner", () => {
    const d = decideAgentNotification(failed, ctx, looking, prefs);
    expect(d?.channels).toMatchObject({ center: true, toast: false, native: false });
  });

  it("a disconnect produces center, toast and the OS banner when away", () => {
    const d = decideAgentNotification(disconnected, ctx, away, prefs);
    expect(d?.kind).toBe("agent-disconnected");
    expect(d?.title).toBe("Fix the build disconnected");
    expect(d?.channels).toMatchObject({ center: true, toast: true, native: true });
  });

  it("a permission request is the loud tier: banner with a sound", () => {
    const d = decideAgentNotification(permission, ctx, away, prefs);
    expect(d?.tier).toBe("needs-you");
    expect(d?.channels).toMatchObject({ center: true, toast: true, native: true, sound: true });
    expect(d?.native.sound).toBe("Ping");
    expect(d?.toast.durationMs).toBeGreaterThan(5_000);
  });

  it("a permission request chimes in-app when its session is off screen", () => {
    const d = decideAgentNotification(permission, ctx, { ...looking, targetVisible: false }, prefs);
    expect(d?.channels).toMatchObject({ native: false, sound: true });
  });

  it("a focused-but-idle user (≥ 2 min) gets the banner", () => {
    const idle: NotificationEnv = {
      ...looking,
      targetVisible: false,
      sinceInputMs: AWAY_IDLE_MS,
      away: computeAway(true, AWAY_IDLE_MS),
    };
    expect(decideAgentNotification(finished(), ctx, idle, prefs)?.channels.native).toBe(true);
  });

  it("names the project only when it is not the active one", () => {
    const d = decideAgentNotification(finished(), ctx, { ...away, projectActive: false }, prefs);
    expect(d?.title).toBe("Fix the build — atlas");
  });

  it("gives each occurrence its own dedupe key", () => {
    const a = decideAgentNotification(finished({ nonce: 1 }), ctx, away, prefs);
    const b = decideAgentNotification(finished({ nonce: 2 }), ctx, away, prefs);
    expect(a?.dedupeKey).not.toBe(b?.dedupeKey);
  });
});

describe("agent prefs", () => {
  it("master off silences every kind", () => {
    for (const e of [finished(), failed, disconnected, permission]) {
      expect(decideAgentNotification(e, ctx, away, { ...prefs, enabled: false })).toBeNull();
    }
  });

  it("OS banners off keeps center and toast", () => {
    const d = decideAgentNotification(failed, ctx, away, { ...prefs, native: false });
    expect(d?.channels).toMatchObject({ center: true, toast: true, native: false });
  });

  it("sound off removes the banner sound", () => {
    const d = decideAgentNotification(permission, ctx, away, { ...prefs, sound: false });
    expect(d?.channels).toMatchObject({ native: true, sound: false });
    expect(d?.native.sound).toBeUndefined();
  });

  it("minimum turn duration silences quick finishes only", () => {
    const p = { ...prefs, minDurationMs: 30_000 };
    expect(decideAgentNotification(finished({ durationMs: 5_000 }), ctx, away, p)).toBeNull();
    expect(decideAgentNotification(finished({ durationMs: 30_000 }), ctx, away, p)).not.toBeNull();
    // Unknown duration is not silenced; failures ignore the threshold.
    expect(decideAgentNotification(finished(), ctx, away, p)).not.toBeNull();
    expect(decideAgentNotification(failed, ctx, away, p)).not.toBeNull();
  });

  it("defaults the minimum to off", () => {
    expect(DEFAULT_AGENT_NOTIFICATION_PREFS.minDurationMs).toBe(0);
    expect(agentKindPrefs(prefs)["agent-done"]).toEqual({
      enabled: true,
      native: true,
      sound: true,
    });
  });
});

describe("isSupersededTurn", () => {
  it("is stale only for a turn older than the current one", () => {
    expect(isSupersededTurn(2, 3)).toBe(true);
    expect(isSupersededTurn(3, 3)).toBe(false);
    expect(isSupersededTurn(undefined, 3)).toBe(false);
    expect(isSupersededTurn(0, 3)).toBe(false);
    expect(isSupersededTurn(1, undefined)).toBe(false);
  });
});
