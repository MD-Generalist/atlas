/**
 * The agent notifier's rules — pure, no store or Tauri imports. It classifies
 * an agent event (a turn ending, a permission request, the agent process
 * dying) into a notification-catalog kind (`classifyAgentEvent`) and maps the
 * agent prefs onto per-kind prefs; the shared `decideNotification` picks the
 * channels. `agent-notifier.ts` supplies the environment and delivers.
 *
 * Copy here is deliberately plain — ATL-375 rewrites it.
 */
import type { NotificationTarget } from "./catalog";
import {
  decideNotification,
  type NotificationDecision,
  type NotificationEnv,
  type NotificationEvent,
  type NotificationPrefs,
} from "./decide";

/** The user's agent notification settings. */
export interface AgentNotificationPrefs {
  /** Master switch — off silences every agent kind. */
  enabled: boolean;
  /** Allow the OS banner (still only when away). */
  native: boolean;
  /** Allow sound (banner sound or in-app chime). */
  sound: boolean;
  /** A turn that finished faster than this stays quiet. 0 = off. Failures,
   *  permission requests and disconnects ignore it. */
  minDurationMs: number;
}

export const DEFAULT_AGENT_NOTIFICATION_PREFS: AgentNotificationPrefs = {
  enabled: true,
  native: true,
  sound: true,
  minDurationMs: 0,
};

export type AgentCtx = Omit<Extract<NotificationTarget, { type: "session" }>, "type"> & {
  /** The session's title, when it has one. */
  sessionTitle?: string;
};

/** What the agent adapter hands the classifier. `nonce` makes the dedupe key
 *  unique per occurrence (a turn_seq, or a counter for agents without one). */
export type AgentNotifyEvent =
  | { type: "permission_requested"; requestId: string; toolTitle: string }
  | {
      type: "turn_finished";
      stopReason: string;
      nonce: string | number;
      /** Wall time of the turn, when known. */
      durationMs?: number;
    }
  | { type: "turn_failed"; error: string; nonce: string | number }
  | { type: "agent_disconnected"; agentId: string; reason: string; nonce: string | number };

/** A turn_seq below the session's current one belongs to a turn already
 *  superseded by a newer send. 0 / absent (the native agent) is current. */
export function isSupersededTurn(turnSeq: number | undefined, currentTurnSeq: number | undefined) {
  return !!turnSeq && turnSeq < (currentTurnSeq ?? 0);
}

/** The agent prefs as per-kind prefs (the master switch gates every kind). */
export function agentKindPrefs(p: AgentNotificationPrefs): NotificationPrefs {
  const kind = { enabled: p.enabled, native: p.native, sound: p.sound };
  return {
    permission: kind,
    "agent-done": kind,
    "agent-failed": kind,
    "agent-disconnected": kind,
  };
}

/** Agent event → catalog event, or null when it is not notification-worthy
 *  at all (independent of environment and channel prefs). */
export function classifyAgentEvent(
  e: AgentNotifyEvent,
  ctx: AgentCtx,
  projectActive: boolean,
  minDurationMs: number,
): NotificationEvent | null {
  const target: NotificationTarget = {
    type: "session",
    tabId: ctx.tabId,
    sessionId: ctx.sessionId,
    projectId: ctx.projectId,
    projectName: ctx.projectName,
    orgId: ctx.orgId,
  };
  const sid = ctx.sessionId ?? ctx.tabId;
  const name = ctx.sessionTitle;
  // Name the project only when it is not the one on screen.
  const label = (fallback: string) => {
    const t = name || fallback;
    return !projectActive && ctx.projectName ? `${t} — ${ctx.projectName}` : t;
  };

  switch (e.type) {
    case "permission_requested":
      return {
        kind: "permission",
        title: label("Permission needed"),
        body: name
          ? `${name} — approve "${e.toolTitle}" to continue.`
          : `Approve "${e.toolTitle}" to continue.`,
        target,
        dedupeKey: `${sid}:${e.requestId}:permission`,
      };
    case "turn_finished":
      // A cancelled turn is a click the user just made.
      if (e.stopReason === "cancelled") return null;
      if (minDurationMs > 0 && e.durationMs !== undefined && e.durationMs < minDurationMs) {
        return null;
      }
      return {
        kind: "agent-done",
        title: label("Agent"),
        body: "Task finished.",
        target,
        dedupeKey: `${sid}:${e.nonce}:done`,
      };
    case "turn_failed":
      return {
        kind: "agent-failed",
        title: label("Agent failed"),
        body: e.error || "The agent run failed.",
        target,
        dedupeKey: `${sid}:${e.nonce}:failed`,
      };
    case "agent_disconnected":
      return {
        kind: "agent-disconnected",
        title: label("Agent") + " disconnected",
        body: e.reason || "The agent process stopped. Restart it to continue.",
        target,
        dedupeKey: `${sid}:${e.agentId}:${e.nonce}:disconnected`,
      };
  }
}

/** Classify + decide — the whole agent rule set as one pure call. */
export function decideAgentNotification(
  e: AgentNotifyEvent,
  ctx: AgentCtx,
  env: NotificationEnv,
  prefs: AgentNotificationPrefs,
): NotificationDecision | null {
  if (!prefs.enabled) return null;
  const event = classifyAgentEvent(e, ctx, env.projectActive, prefs.minDurationMs);
  return event ? decideNotification(event, env, agentKindPrefs(prefs)) : null;
}
