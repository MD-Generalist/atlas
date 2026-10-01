// The user's agent notification settings. Persisted in localStorage for now:
// the app settings live in Rust's `config.toml` and a key Rust does not know is
// dropped, so these move there when the Settings slice adds the Rust fields.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSelectors } from "@/lib/create-selectors";
import {
  DEFAULT_AGENT_NOTIFICATION_PREFS,
  type AgentNotificationPrefs,
} from "../lib/agent-notifier-rules";

interface AgentNotifyPrefsState {
  prefs: AgentNotificationPrefs;
  actions: { update: (partial: Partial<AgentNotificationPrefs>) => void };
}

/** Keep only well-formed fields; anything else falls back to its default. */
export function sanitizeAgentPrefs(raw: unknown): AgentNotificationPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_AGENT_NOTIFICATION_PREFS;
  const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  const ms = r.minDurationMs;
  return {
    enabled: bool(r.enabled, d.enabled),
    native: bool(r.native, d.native),
    sound: bool(r.sound, d.sound),
    minDurationMs: typeof ms === "number" && Number.isFinite(ms) && ms >= 0 ? ms : d.minDurationMs,
  };
}

export const useAgentNotifyPrefsStore = createSelectors(
  create<AgentNotifyPrefsState>()(
    persist(
      (set) => ({
        prefs: DEFAULT_AGENT_NOTIFICATION_PREFS,
        actions: {
          update: (partial) =>
            set((s) => ({ prefs: sanitizeAgentPrefs({ ...s.prefs, ...partial }) })),
        },
      }),
      {
        name: "atlas-agent-notify-prefs",
        version: 1,
        partialize: (s) => ({ prefs: s.prefs }),
        merge: (persisted, current) => ({
          ...current,
          prefs: sanitizeAgentPrefs((persisted as { prefs?: unknown } | undefined)?.prefs),
        }),
      },
    ),
  ),
);
