/**
 * The terminal notifier's rules — a pure module with no store or Tauri
 * imports, so it is unit-testable in plain node and cannot drift into side
 * effects. It classifies a parser event into a notification-catalog kind
 * (`classifyTerminalEvent`) and maps the terminal settings onto per-kind
 * prefs; the shared `decideNotification` picks the channels.
 * `terminal-notifier.ts` supplies the environment and delivers.
 */
import type { NotificationTarget } from "@/features/notifications/lib/catalog";
import {
  decideNotification,
  type NotificationDecision,
  type NotificationEnv,
  type NotificationEvent,
  type NotificationPrefs,
} from "@/features/notifications/lib/decide";
import type { TerminalNotificationPrefs } from "@/features/settings/lib/app-settings";
import type { TerminalEvent } from "./block-parser";
import { formatDuration } from "./format-duration";

export type TerminalCtx = Omit<Extract<NotificationTarget, { type: "terminal" }>, "type">;

export type TerminalNotificationKind = "terminal-done" | "terminal-failed" | "terminal-attention";

/** Ctrl-C: the user ended it; nothing to announce. */
const EXIT_INTERRUPT = 130;

function basename(p: string): string {
  return p.split("/").filter(Boolean).pop() ?? p;
}

function where(ctx: TerminalCtx, cwd: string, projectActive: boolean): string {
  const dir = basename(cwd);
  // Name the project only when it is not the one on screen — mirrors the
  // chat's background toast.
  return !projectActive && ctx.projectName ? `${dir} — ${ctx.projectName}` : dir;
}

/** The terminal settings as per-kind prefs (the catalog names each kind's
 *  governing toggle; the master switch gates all three). */
export function terminalKindPrefs(p: TerminalNotificationPrefs): NotificationPrefs {
  const kind = (on: boolean) => ({ enabled: p.enabled && on, native: p.native, sound: p.sound });
  return {
    "terminal-done": kind(true),
    "terminal-failed": kind(p.onFailure),
    "terminal-attention": kind(p.onAttention),
  };
}

/** Parser event → catalog event, or null when it is not notification-worthy
 *  at all (independent of environment and channel prefs). */
export function classifyTerminalEvent(
  e: TerminalEvent,
  ctx: TerminalCtx,
  projectActive: boolean,
  minDurationMs: number,
): NotificationEvent | null {
  const target: NotificationTarget = { type: "terminal", ...ctx };

  if (e.type === "commandFinished") {
    if (e.exitCode === EXIT_INTERRUPT) return null;
    // A command that took the alternate screen (vim, htop) is a session.
    if (e.usedAltScreen) return null;
    const failed = e.exitCode != null && e.exitCode !== 0;
    if (failed) {
      return {
        kind: "terminal-failed",
        title: `${e.command} failed (exit ${e.exitCode})`,
        body: where(ctx, e.cwd, projectActive),
        target,
        dedupeKey: `${ctx.terminalId}:${e.blockId}:failed`,
      };
    }
    if (e.durationMs >= minDurationMs) {
      return {
        kind: "terminal-done",
        title: `${e.command} finished in ${formatDuration(e.durationMs)}`,
        body: where(ctx, e.cwd, projectActive),
        target,
        dedupeKey: `${ctx.terminalId}:${e.blockId}:done`,
      };
    }
    return null;
  }

  if (e.type === "attention") {
    const title =
      e.kind === "password"
        ? `${e.command} needs a password`
        : e.kind === "bell"
          ? `Terminal bell — ${e.command}`
          : e.kind === "notify"
            ? e.title || `${e.command} says`
            : `${e.command} needs input`;
    const body =
      e.kind === "notify" && e.body
        ? e.body
        : `${e.command} in ${where(ctx, "", projectActive) || "terminal"}`;
    return {
      kind: "terminal-attention",
      title,
      body,
      target,
      dedupeKey: `${ctx.terminalId}:${e.blockId ?? "x"}:${e.kind}:${e.body ?? ""}`,
    };
  }

  return null;
}

/** Classify + decide — the whole terminal rule set as one pure call. */
export function decideTerminalNotification(
  e: TerminalEvent,
  ctx: TerminalCtx,
  env: NotificationEnv,
  prefs: TerminalNotificationPrefs,
): NotificationDecision | null {
  if (!prefs.enabled) return null;
  const event = classifyTerminalEvent(e, ctx, env.projectActive, prefs.minDurationMs);
  return event ? decideNotification(event, env, terminalKindPrefs(prefs)) : null;
}
