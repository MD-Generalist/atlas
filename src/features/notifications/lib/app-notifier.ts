/**
 * App notifications: Atlas's own session state onto the shared pipeline.
 * `App.tsx` forwards the auth events here — `notifyAtlasSignedOut` when Rust
 * reports the session expired or revoked, `noteAtlasSignedIn` when a snapshot
 * says signed-in again (which closes the episode, so the next sign-out speaks).
 */
import { toast } from "sonner";
import { setDockBadge } from "@/lib/dock-badge";
import { isWindowFocused, lastInteraction } from "@/lib/window-focus";
import { useNotificationsStore } from "../stores/notifications-store";
import {
  INITIAL_SIGN_IN_EPISODE,
  openSignInEpisode,
  resolveSignInEpisode,
  signedOutDedupeKey,
} from "./agent-signin-rules";
import { decideSignedOut } from "./app-notifier-rules";
import { computeAway } from "./decide";
import { deliverNotification, notificationToastId } from "./deliver";

let episode = INITIAL_SIGN_IN_EPISODE;

/** Atlas lost its session (expired or revoked). Never throws. */
export function notifyAtlasSignedOut(message: string): void {
  try {
    episode = openSignInEpisode(episode);
    const windowFocused = isWindowFocused();
    const sinceInputMs = Date.now() - lastInteraction();
    const decision = decideSignedOut(message, episode.episode, {
      windowFocused,
      sinceInputMs,
      // Nothing on screen is "the sign-in" — the toast always shows.
      targetVisible: false,
      projectActive: true,
      away: computeAway(windowFocused, sinceInputMs),
    });
    if (decision) deliverNotification(decision);
  } catch (err) {
    console.warn("signed-out notification failed:", err);
  }
}

/** Atlas is signed in: drop the stale toast and mark its center item read. */
export function noteAtlasSignedIn(): void {
  try {
    if (!episode.open) return;
    toast.dismiss(
      notificationToastId({ type: "atlas-sign-in" }, signedOutDedupeKey(episode.episode)),
    );
    episode = resolveSignInEpisode(episode);
    useNotificationsStore.getState().actions.markKindRead("atlas-signed-out");
    setDockBadge(useNotificationsStore.getState().items.filter((i) => !i.read).length);
  } catch (err) {
    console.warn("signed-in cleanup failed:", err);
  }
}
