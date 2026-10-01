/**
 * The notification catalog — every kind Atlas can raise, and how it behaves
 * by default. The pipeline is catalog → `decideNotification` (pure: event,
 * environment, prefs → channels + content) → `deliverNotification` (the one
 * place with side effects).
 *
 * Each entry names:
 *  - its urgency `tier` — `needs-you` (blocked on the user), `outcome` (work
 *    finished or failed), `warning` (something degraded), `team` (Chat);
 *  - the `channels` it may use (each still gated by environment and prefs);
 *  - its `sound` (a system sound for the OS banner; the in-app chime when the
 *    banner is not shown);
 *  - its `groupKey` (what collapses together — one terminal, one session);
 *  - the `setting` that governs it, so Settings and the catalog cannot drift.
 *
 * Pure — no store, Tauri or DOM imports.
 */
import type { AppSettings } from "@/features/settings/lib/app-settings";

export type NotificationTier = "needs-you" | "outcome" | "warning" | "team";

/** Which subsystem raised it — drives the center's icon and click routing. */
export type NotificationSource = "agent" | "terminal";

export type NotificationChannel = "center" | "toast" | "native" | "badge" | "sound";

export type ToastVariant = "default" | "success" | "error";

export interface CatalogEntry {
  tier: NotificationTier;
  source: NotificationSource;
  /** Channels this kind may use at all. */
  channels: Readonly<Record<NotificationChannel, boolean>>;
  /** While the user is looking at the target: `drop` says nothing at all,
   *  `record` still lands in the center (the other channels are already
   *  quiet because the target is visible and the window focused). */
  whenLooking: "drop" | "record";
  /** `native` is a system sound name for the OS banner; otherwise the
   *  synthesised in-app chime plays. `null` = silent kind. */
  sound: { native: string } | null;
  toast: { variant: ToastVariant; durationMs: number };
  /** Grouping key — notifications sharing one collapse together in the OS
   *  notification list (once a backend supports it). */
  groupKey: (target: NotificationTarget) => string;
  /** The setting toggle that turns this kind on and off, if any. */
  setting: Extract<keyof AppSettings, string> | null;
}

/** What a notification is about — where "Open" jumps, and the owner used to
 *  filter by organisation. */
export type NotificationTarget =
  | {
      type: "terminal";
      tabId: string;
      terminalId: string;
      projectId?: string;
      projectName?: string;
      orgId?: string;
    }
  | {
      type: "session";
      tabId: string;
      sessionId?: string;
      projectId?: string;
      projectName?: string;
      orgId?: string;
    };

const ALL_CHANNELS = { center: true, toast: true, native: true, badge: true, sound: true };
const DONE_TOAST_MS = 5_000;
const ATTENTION_TOAST_MS = 15_000;

const byTarget = (t: NotificationTarget) =>
  t.type === "terminal" ? `terminal:${t.terminalId}` : `session:${t.sessionId ?? t.tabId}`;

export const NOTIFICATION_CATALOG = {
  "terminal-attention": {
    tier: "needs-you",
    source: "terminal",
    channels: ALL_CHANNELS,
    whenLooking: "record",
    sound: { native: "Ping" },
    toast: { variant: "default", durationMs: ATTENTION_TOAST_MS },
    groupKey: byTarget,
    setting: "terminalNotifyOnAttention",
  },
  "terminal-done": {
    tier: "outcome",
    source: "terminal",
    channels: ALL_CHANNELS,
    whenLooking: "drop",
    sound: { native: "Ping" },
    toast: { variant: "success", durationMs: DONE_TOAST_MS },
    groupKey: byTarget,
    setting: "terminalNotifications",
  },
  "terminal-failed": {
    tier: "outcome",
    source: "terminal",
    channels: ALL_CHANNELS,
    whenLooking: "record",
    sound: { native: "Ping" },
    toast: { variant: "error", durationMs: DONE_TOAST_MS },
    groupKey: byTarget,
    setting: "terminalNotifyOnFailure",
  },
  // Agent kinds — raised by `agent-notifier.ts`; governed by the agent
  // notification prefs (`agent-notify-prefs-store`), not an AppSettings key.
  permission: {
    tier: "needs-you",
    source: "agent",
    channels: ALL_CHANNELS,
    whenLooking: "record",
    sound: { native: "Ping" },
    toast: { variant: "default", durationMs: ATTENTION_TOAST_MS },
    groupKey: byTarget,
    setting: null,
  },
  // A finish is quiet: the banner carries no sound (permission and failures do).
  "agent-done": {
    tier: "outcome",
    source: "agent",
    channels: ALL_CHANNELS,
    whenLooking: "drop",
    sound: null,
    toast: { variant: "success", durationMs: DONE_TOAST_MS },
    groupKey: byTarget,
    setting: null,
  },
  "agent-failed": {
    tier: "outcome",
    source: "agent",
    channels: ALL_CHANNELS,
    whenLooking: "record",
    sound: { native: "Ping" },
    toast: { variant: "error", durationMs: DONE_TOAST_MS },
    groupKey: byTarget,
    setting: null,
  },
  // The agent process died; the session shows Restart. Plain copy for now.
  "agent-disconnected": {
    tier: "warning",
    source: "agent",
    channels: ALL_CHANNELS,
    whenLooking: "record",
    sound: { native: "Ping" },
    toast: { variant: "error", durationMs: ATTENTION_TOAST_MS },
    groupKey: byTarget,
    setting: null,
  },
} as const satisfies Record<string, CatalogEntry>;

export type NotificationKind = keyof typeof NOTIFICATION_CATALOG;

export function catalogEntry(kind: NotificationKind): CatalogEntry {
  return NOTIFICATION_CATALOG[kind];
}

export function isNotificationKind(k: unknown): k is NotificationKind {
  return typeof k === "string" && Object.prototype.hasOwnProperty.call(NOTIFICATION_CATALOG, k);
}
