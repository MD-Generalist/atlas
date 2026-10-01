/**
 * The agent notifier's rules — pure, no store or Tauri imports. It classifies
 * an agent event (a turn ending, a permission request or question, the agent process
 * dying) into a notification-catalog kind (`classifyAgentEvent`) and maps the
 * agent prefs onto per-kind prefs; the shared `decideNotification` picks the
 * channels. `agent-notifier.ts` supplies the environment and delivers.
 *
 * Copy: title `<agent> · <thread>`, subtitle = the project when it is not the
 * active one, body says what happened (stop reason, first sentence of the
 * final message, duration, files edited). The OS already shows the app name,
 * so "Atlas" never appears in it.
 */
import type { NotificationTarget } from "./catalog";
import { firstSentence } from "./agent-summary";
import { formatFileCount, formatTurnDuration } from "./agent-turn-stats";
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
   *  permission requests, questions and disconnects ignore it. */
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
  /** The agent's display name, from the agent registry. */
  agentName?: string;
};

export type AgentErrorKind = "auth" | "transient" | "fatal" | "process_dead" | "unknown";

/** What the agent adapter hands the classifier. `nonce` makes the dedupe key
 *  unique per occurrence (a turn_seq, or a counter for agents without one). */
export type AgentNotifyEvent =
  | {
      type: "permission_requested";
      requestId: string;
      /** The raw ACP `tool_call` of the request; see `describePermission`. */
      toolCall?: unknown;
      toolTitle?: string;
    }
  | {
      type: "question_asked";
      requestId: string;
      /** The question, as the agent worded it. May be empty (url mode). */
      message: string;
    }
  | {
      type: "turn_finished";
      stopReason: string;
      nonce: string | number;
      /** Wall time of the turn, when known. */
      durationMs?: number;
      /** First sentence of the final assistant message, when there is one. */
      summary?: string | null;
      /** Files the turn edited. */
      filesEdited?: number;
    }
  | { type: "turn_failed"; error: string; errorKind?: AgentErrorKind; nonce: string | number }
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
    "agent-question": kind,
    "agent-done": kind,
    "agent-failed": kind,
    "agent-disconnected": kind,
  };
}

const BODY_BY_STOP_REASON: Record<string, string> = {
  max_tokens: "Hit the output limit",
  max_turn_requests: "Hit the turn limit",
  refusal: "Declined",
};

/** The one-line note a failed turn carries, by error kind. Kinds whose
 *  cause the user cannot read off the wording append the agent's own error. */
export function failureBody(kind: AgentErrorKind | undefined, error: string): string {
  const detail = firstSentence(error);
  switch (kind) {
    case "auth":
      return "Sign-in expired — sign in again to continue";
    case "transient":
      return "Temporary problem — try again in a moment";
    case "process_dead":
      return "The agent process stopped — restart it to continue";
    case "fatal":
      return detail ? `Failed — ${detail}` : "Failed — the run cannot continue";
    default:
      return detail ?? "Something went wrong";
  }
}

const VERB_BY_TOOL_KIND: Record<string, string> = {
  execute: "Run",
  edit: "Edit",
  delete: "Delete",
  move: "Move",
  read: "Read",
  fetch: "Fetch",
  search: "Search",
};
const TARGET_KEYS = ["command", "cmd", "file_path", "filePath", "path", "url", "pattern", "query"];
const DETAIL_MAX = 80;

const oneLine = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > DETAIL_MAX ? `${t.slice(0, DETAIL_MAX - 1).trimEnd()}…` : t;
};

/** "Run npm test" / "Edit src/auth.ts" — the tool and its command or target,
 *  on one line. Reads the ACP tool call generically (kind + raw input); no
 *  per-agent shapes. Falls back to the call's title, then "a tool". */
export function describePermission(toolCall: unknown, fallbackTitle?: string): string {
  const tc = (toolCall && typeof toolCall === "object" ? toolCall : {}) as Record<string, unknown>;
  const title = typeof tc.title === "string" ? tc.title : (fallbackTitle ?? "");
  const kind = typeof tc.kind === "string" ? tc.kind : "";
  const input = (tc.rawInput ?? tc.raw_input) as Record<string, unknown> | undefined;
  let target = "";
  if (input && typeof input === "object") {
    for (const k of TARGET_KEYS) {
      if (typeof input[k] === "string" && input[k]) {
        target = input[k] as string;
        break;
      }
    }
  }
  const verb = VERB_BY_TOOL_KIND[kind];
  // For shell calls the ACP title IS the command.
  if (!target && kind === "execute") target = title;
  if (verb && target) return oneLine(`${verb} ${target}`);
  if (title) return oneLine(title);
  return kind ? oneLine(kind) : "a tool";
}

const QUESTION_MAX = 120;

/** The agent's question on one line, capped at a word boundary where it can. */
export function describeQuestion(message: string): string {
  const t = message.replace(/\s+/g, " ").trim();
  if (!t) return "Has a question for you";
  if (t.length <= QUESTION_MAX) return t;
  const cut = t.slice(0, QUESTION_MAX - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > QUESTION_MAX / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The dedupe key a question's notification (and its toast) carries. */
export const questionDedupeKey = (sessionKey: string, requestId: string) =>
  `${sessionKey}:${requestId}:question`;

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
  const agent = ctx.agentName || "Agent";
  const title = ctx.sessionTitle ? `${agent} · ${ctx.sessionTitle}` : agent;
  // Name the project only when it is not the one on screen.
  const subtitle = !projectActive && ctx.projectName ? ctx.projectName : undefined;
  const base = { title, subtitle, target };

  switch (e.type) {
    case "permission_requested":
      return {
        ...base,
        kind: "permission",
        body: `Needs approval — ${describePermission(e.toolCall, e.toolTitle)}`,
        dedupeKey: `${sid}:${e.requestId}:permission`,
      };
    case "question_asked":
      return {
        ...base,
        kind: "agent-question",
        body: describeQuestion(e.message),
        dedupeKey: questionDedupeKey(sid, e.requestId),
      };
    case "turn_finished": {
      // A cancelled turn is a click the user just made.
      if (e.stopReason === "cancelled") return null;
      if (minDurationMs > 0 && e.durationMs !== undefined && e.durationMs < minDurationMs) {
        return null;
      }
      const stats = [formatTurnDuration(e.durationMs), formatFileCount(e.filesEdited ?? 0)];
      const lead =
        BODY_BY_STOP_REASON[e.stopReason] ??
        (e.summary ? e.summary : stats.some(Boolean) ? "" : "Done");
      const body = [lead, ...stats].filter(Boolean).join(" · ");
      return { ...base, kind: "agent-done", body, dedupeKey: `${sid}:${e.nonce}:done` };
    }
    case "turn_failed":
      return {
        ...base,
        kind: "agent-failed",
        body: failureBody(e.errorKind, e.error),
        dedupeKey: `${sid}:${e.nonce}:failed`,
      };
    case "agent_disconnected":
      return {
        ...base,
        kind: "agent-disconnected",
        body: failureBody("process_dead", ""),
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
