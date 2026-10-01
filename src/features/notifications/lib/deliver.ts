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
import { sendNativeNotification } from "@/lib/native-notify";
import { playChime } from "@/lib/chime";
import { setDockBadge } from "@/lib/dock-badge";
import { useNotificationsStore } from "../stores/notifications-store";
import { catalogEntry, type NotificationTarget } from "./catalog";
import type { NotificationDecision } from "./decide";

const announced = new Set<string>();
const ANNOUNCED_CAP = 500;

/** Bring a notification's target into view, across projects. */
export function openNotificationTarget(t: NotificationTarget): void {
  if (t.type === "terminal") {
    void jumpToTerminal({ tabId: t.tabId, terminalId: t.terminalId, projectId: t.projectId });
  } else {
    void jumpToSession(t.tabId);
  }
}

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
      tabId: t.tabId,
      terminalId: t.type === "terminal" ? t.terminalId : undefined,
      sessionId: t.type === "session" ? t.sessionId : undefined,
      projectId: t.projectId,
      orgId: t.orgId,
    });
  }
  // Re-checked at delivery: the badge is for a window in the background now.
  if (d.channels.badge && !isWindowFocused()) {
    const unread = useNotificationsStore.getState().items.filter((i) => !i.read).length;
    setDockBadge(unread);
  }
  if (d.channels.toast) {
    const opts = {
      id: `bg-${t.type}-${d.dedupeKey}`,
      description: d.body,
      duration: d.toast.durationMs,
      action: { label: "Open", onClick: () => openNotificationTarget(t) },
    };
    if (d.toast.variant === "error") toast.error(d.title, opts);
    else if (d.toast.variant === "success") toast.success(d.title, opts);
    else toast(d.title, opts);
  }
  if (d.channels.native) {
    void sendNativeNotification(d.native);
  } else if (d.channels.sound) {
    playChime();
  }
  return true;
}
