/**
 * IPC wrapper for the Atlas-owned system notifier (`src-tauri/src/notifier`).
 * The only place that talks to it; the rest of the app goes through
 * `@/lib/native-notify`. Never throws on a missing backend (the browser mock
 * resolves unmocked commands to `null`).
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  NO_NATIVE_CAPABILITIES,
  parseNativeCapabilities,
  type NativeCapabilities,
} from "./native-capabilities";

export const NOTIFICATION_RESPONSE_EVENT = "atlas:notification-response";

export interface SystemNotificationAction {
  id: string;
  label: string;
  destructive?: boolean;
  /** The device must be unlocked before the action runs. */
  requiresUnlock?: boolean;
}

export interface SystemNotification {
  /** Stable identity: the same tag replaces the old banner; `remove` addresses it. */
  tag: string;
  /** Banners sharing a group stack together and can be removed together. */
  group: string;
  title: string;
  subtitle?: string;
  body: string;
  imagePath?: string;
  /** A system sound name (e.g. "Ping"); omit for silent. */
  sound?: string;
  urgency?: "low" | "normal" | "high";
  actions?: SystemNotificationAction[];
  /** Opaque string echoed back in the response — enough to rebuild the target
   *  even when the click launched the app. */
  payload?: string;
}

/** `actionId` is null for a plain click on the banner. */
export interface SystemNotificationResponse {
  tag: string;
  actionId: string | null;
  payload: string | null;
}

export interface NotifierInfo {
  backend: string;
  capabilities: NativeCapabilities;
}

export type NotifierAuthorization = "granted" | "denied";

export async function notifierInit(): Promise<NotifierInfo> {
  const raw = await invoke<{ backend?: string; capabilities?: unknown } | null>("notifier_init");
  return {
    backend: raw?.backend ?? "none",
    capabilities: raw ? parseNativeCapabilities(raw.capabilities) : NO_NATIVE_CAPABILITIES,
  };
}

export async function notifierRequestAuthorization(): Promise<NotifierAuthorization> {
  const raw = await invoke<string | null>("notifier_request_authorization");
  return raw === "granted" ? "granted" : "denied";
}

export function notifierShow(notification: SystemNotification): Promise<void> {
  return invoke<void>("notifier_show", { notification });
}

export function notifierRemove(tag: string): Promise<void> {
  return invoke<void>("notifier_remove", { tag });
}

export function notifierRemoveGroup(group: string): Promise<void> {
  return invoke<void>("notifier_remove_group", { group });
}

export function listenNotificationResponses(
  handler: (response: SystemNotificationResponse) => void,
): Promise<UnlistenFn> {
  return listen<SystemNotificationResponse>(NOTIFICATION_RESPONSE_EVENT, (e) => handler(e.payload));
}
