/**
 * Agent notifications: the agent's source adapter onto the shared
 * notification pipeline.
 *
 * ENTRY POINT — `notifyAgentEvent(delta)`. App.tsx's session-delta listener
 * forwards `permission_request`, `turn_finished`, `turn_failed` and
 * `agent_disconnected` here and does nothing else notification-related.
 *
 * Flow: delta → `AgentNotifyEvent` → `decideAgentNotification` (pure, in
 * `agent-notifier-rules.ts`: classify into a catalog kind, then the shared
 * decision picks channels) → `deliverNotification`. Stale turns (superseded by
 * a newer send) and user-cancelled turns never notify.
 *
 * A finish reads the turn's final text, duration and edited files from the chat
 * store, which only has them once `turn_finished` is applied — App.tsx flushes
 * its delta buffer before calling in.
 *
 * Bursts: OS banners for `agent-done` are held for a short window and leave
 * as one "N agents finished" (`banner-coalescer.ts`); center, toast and badge
 * are not delayed.
 */
import { useChatStore } from "@/features/chat/stores/chat-store";
import { useLayoutStore } from "@/features/layout/stores/layout-store";
import { useProjectStore } from "@/features/projects/stores/project-store";
import { agentMeta } from "@/features/agents/lib/agent-meta";
import { projectIdForTab } from "@/features/chat/lib/tab-project";
import type { AgentDelta } from "@/types/agents";
import type { ChatSession } from "@/types/agent";
import { isWindowFocused, lastInteraction } from "@/lib/window-focus";
import { useAgentNotifyPrefsStore } from "../stores/agent-notify-prefs-store";
import {
  decideAgentNotification,
  isSupersededTurn,
  type AgentCtx,
  type AgentNotifyEvent,
} from "./agent-notifier-rules";
import { turnStats } from "./agent-turn-stats";
import { createBannerCoalescer } from "./banner-coalescer";
import { computeAway, type NotificationEnv } from "./decide";
import { deliverNotification } from "./deliver";

/** Banners of finishes within this window of the first merge into one. */
export const FINISH_BANNER_WINDOW_MS = 3_000;

const finishBanners = createBannerCoalescer({
  windowMs: FINISH_BANNER_WINDOW_MS,
  // Native-only: the other channels were delivered when each finish landed.
  emit: (d) =>
    deliverNotification({
      ...d,
      dedupeKey: `${d.dedupeKey}:banner`,
      channels: { center: false, toast: false, badge: false, sound: false, native: true },
    }),
});

function findSession(acpSessionId: string): { tabId: string; session: ChatSession } | null {
  for (const [tabId, session] of Object.entries(useChatStore.getState().sessions)) {
    if (session.acpSessionId === acpSessionId) return { tabId, session };
  }
  return null;
}

/** True when this turn was superseded by a newer send — the chat store ignores
 *  its terminal delta, so nothing downstream (notification, reindex) may act. */
export function isStaleAgentTurn(sessionId: string, turnSeq?: number): boolean {
  const found = findSession(sessionId);
  return !!found && isSupersededTurn(turnSeq, found.session.currentTurnSeq);
}

let counter = 0;
const nonceFor = (turnSeq?: number) => turnSeq || `n${++counter}`;

function toNotifyEvent(env: AgentDelta, session: ChatSession): AgentNotifyEvent | null {
  switch (env.kind) {
    case "permission_request": {
      const tc = env.tool_call as Record<string, unknown> | undefined;
      const toolTitle =
        (typeof tc?.title === "string" && tc.title) ||
        (typeof tc?.kind === "string" && tc.kind) ||
        "tool call";
      return {
        type: "permission_requested",
        requestId: String(env.request_id),
        toolCall: env.tool_call,
        toolTitle,
      };
    }
    case "turn_finished": {
      const stats = turnStats(session.messages, Date.now());
      return {
        type: "turn_finished",
        stopReason: env.stop_reason,
        nonce: nonceFor(env.turn_seq),
        durationMs: stats.durationMs,
        summary: stats.summary,
        filesEdited: stats.filesEdited,
      };
    }
    case "turn_failed":
      return {
        type: "turn_failed",
        error: env.error,
        errorKind: env.error_kind,
        nonce: nonceFor(env.turn_seq),
      };
    case "agent_disconnected":
      return {
        type: "agent_disconnected",
        agentId: env.agent_id,
        reason: env.reason,
        nonce: nonceFor(),
      };
    default:
      return null;
  }
}

/** Forward an agent session delta to the pipeline. Ignores kinds that do not
 *  notify; never throws. */
export function notifyAgentEvent(env: AgentDelta): void {
  try {
    if (
      env.kind !== "permission_request" &&
      env.kind !== "turn_finished" &&
      env.kind !== "turn_failed" &&
      env.kind !== "agent_disconnected"
    ) {
      return;
    }
    if (
      (env.kind === "turn_finished" || env.kind === "turn_failed") &&
      isStaleAgentTurn(env.session_id, env.turn_seq)
    ) {
      return;
    }
    const found = findSession(env.session_id);
    // No open session: nothing to jump to.
    if (!found) return;
    const event = toNotifyEvent(env, found.session);
    if (!event) return;

    const ws = useProjectStore.getState();
    const projectId = projectIdForTab(found.tabId) ?? undefined;
    const project = projectId ? ws.projects.find((w) => w.id === projectId) : undefined;
    const ctx: AgentCtx = {
      tabId: found.tabId,
      sessionId: env.session_id,
      sessionTitle: found.session.title || undefined,
      agentName: agentMeta(found.session.agentType).label,
      projectId,
      projectName: project?.name,
      orgId: project?.orgId,
    };
    const windowFocused = isWindowFocused();
    const sinceInputMs = Date.now() - lastInteraction();
    const nenv: NotificationEnv = {
      targetVisible: useLayoutStore.getState().activeTabId === found.tabId,
      windowFocused,
      sinceInputMs,
      projectActive: !projectId || projectId === ws.activeProjectId,
      away: computeAway(windowFocused, sinceInputMs),
    };
    const decision = decideAgentNotification(
      event,
      ctx,
      nenv,
      useAgentNotifyPrefsStore.getState().prefs,
    );
    if (!decision) return;

    if (decision.kind === "agent-done" && decision.channels.native) {
      const delivered = deliverNotification({
        ...decision,
        channels: { ...decision.channels, native: false, sound: false },
      });
      if (delivered) finishBanners.add(decision);
      return;
    }
    deliverNotification(decision);
  } catch (err) {
    console.warn("agent notifier failed:", err);
  }
}
