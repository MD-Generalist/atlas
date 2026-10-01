/**
 * The one delivery step — every side effect of a notification happens here:
 * the in-app center, the toast (with its "Open" jump), the OS banner, the dock
 * badge and the sound. Input is a `NotificationDecision` from the pure
 * `decideNotification`; nothing here decides whether to speak, only how.
 *
 * Each dedupe key is delivered once (bounded memory), so a source that
 * re-emits the same occurrence cannot double-announce.
 */
import { toast } from "sonner";
import { jumpToSession } from "@/features/chat/lib/tab-project";
import { jumpToTerminal } from "@/features/terminal/lib/jump-to-terminal";
import { isWindowFocused } from "@/lib/window-focus";
import { setNativeResponseHandler, showNativeNotification } from "@/lib/native-notify";
import { playChime } from "@/lib/chime";
import { setDockBadge } from "@/lib/dock-badge";
import { useNotificationsStore } from "../stores/notifications-store";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { promptSignIn } from "@/features/chat/lib/agent-signin";
import { commsActions } from "@/features/comms/stores/comms-store";
import { catalogEntry, isTabTarget, type NotificationTarget } from "./catalog";
import type { NotificationDecision } from "./decide";
import { encodeBannerPayload, targetForResponse } from "./native-routing";

const announced = new Set<string>();
const ANNOUNCED_CAP = 500;

/** Bring a notification's target into view, across projects. */
export function openNotificationTarget(t: NotificationTarget): void {
  switch (t.type) {
    case "terminal":
      void jumpToTerminal({ tabId: t.tabId, terminalId: t.terminalId, projectId: t.projectId });
      return;
    case "session":
      void jumpToSession(t.tabId);
      return;
    case "atlas-sign-in":
      void useAuthStore.getState().actions.beginSignIn();
      return;
    case "agent-sign-in":
      promptSignIn(t.agentType);
      return;
    case "chat-conversation":
      commsActions().openConversation(t.convId);
      return;
  }
}

/** The toast id a decision's toast carries, so a source can dismiss it later. */
export const notificationToastId = (target: NotificationTarget, dedupeKey: string) =>
  `bg-${target.type}-${dedupeKey}`;

// A click on an OS banner opens its exact source (thread tab or terminal pane),
// across projects. Registered at module load so a click that launched the app
// is routed as soon as the notifier flushes it. Action buttons are routed by the
// features that offer them.
setNativeResponseHandler((response) => {
  const target = targetForResponse(response);
  if (target) openNotificationTarget(target);
});

/** Perform a decision. Returns false when it was a duplicate. */
export function deliverNotification(d: NotificationDecision): boolean {
  if (announced.has(d.dedupeKey)) return false;
  announced.add(d.dedupeKey);
  if (announced.size > ANNOUNCED_CAP) {
    const first = announced.values().next().value;
    if (first) announced.delete(first);
  }

  const t = d.target;
  if (d.channels.center) {
    useNotificationsStore.getState().actions.add({
      kind: d.kind,
      source: catalogEntry(d.kind).source,
      title: d.title,
      body: d.body,
      tabId: isTabTarget(t) ? t.tabId : undefined,
      terminalId: t.type === "terminal" ? t.terminalId : undefined,
      sessionId: t.type === "session" ? t.sessionId : undefined,
      projectId: isTabTarget(t) ? t.projectId : undefined,
      orgId: isTabTarget(t) || t.type === "chat-conversation" ? t.orgId : undefined,
      // App-level targets have no tab to jump to; the panel opens the target.
      target: isTabTarget(t) ? undefined : t,
    });
  }
  // Re-checked at delivery: the badge is for a window in the background now.
  if (d.channels.badge && !isWindowFocused()) {
    const unread = useNotificationsStore.getState().items.filter((i) => !i.read).length;
    setDockBadge(unread);
  }
  if (d.channels.toast) {
    const opts = {
      id: notificationToastId(t, d.dedupeKey),
      description: d.body,
      duration: d.toast.durationMs,
      action: { label: "Open", onClick: () => openNotificationTarget(t) },
    };
    if (d.toast.variant === "error") toast.error(d.title, opts);
    else if (d.toast.variant === "success") toast.success(d.title, opts);
    else toast(d.title, opts);
  }
  if (d.channels.native) {
    void showNativeNotification({
      // Re-delivering a dedupe key replaces its banner; one group per thread/terminal.
      tag: `${d.kind}:${d.dedupeKey}`,
      group: d.groupKey,
      title: d.native.title,
      subtitle: d.native.subtitle,
      body: d.native.body,
      sound: d.native.sound,
      urgency: d.tier === "needs-you" ? "high" : "normal",
      payload: encodeBannerPayload(d.target),
    });
  } else if (d.channels.sound) {
    playChime();
  }
  return true;
}
