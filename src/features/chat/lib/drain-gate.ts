/**
 * When the chat panel may hand the next parked message to `handleSend`.
 *
 * The panel's drain effect fires on every status / binding change and used
 * to treat any `running → not running` edge as "the turn ended, send the
 * next queued message". A bind that FAILS produces that same edge: the first
 * message is held as `pendingSend` with the status `running` ("Starting …"),
 * and the failure branch parks it back in the queue and drops the status to
 * `idle`. The drain then shifted it straight back out, `handleSend` saw an
 * unbound tab and re-held it (recording a second user bubble), kicked the
 * bind again, which failed again in ~10 ms — 491 connect attempts, a bubble
 * and an error toast per cycle, until Stop (2026-09-14, engine start
 * refused while the machine had no DNS).
 *
 * The rule this encodes: a queue only drains INTO A BOUND SESSION. A turn
 * can only have finished on one, and a message dispatched into an unbound
 * tab is the loop. The bind's own success (`justBound`) and the resume
 * path's falling edge (`justResumed`) are the other two legitimate moments,
 * both of which carry a session id by definition.
 *
 * And nothing drains while the gate is closed (`curResuming`): a resume still
 * loading, or one that could not restore the user's mode. Its falling edge is
 * the release.
 *
 * The grant hold (`curGrantHold`) is the same shape for the native agent's
 * no-AI-grant answer (`grantLocksComposer`). That answer can land mid-turn,
 * and the lock waits for the turn to end so its Stop stays live — but a
 * message queued during that turn would then drain at the turn's end straight
 * into a gateway that refuses it. So the queue is held while the composer
 * would be locked, and released on the hold's falling edge (a Refresh that
 * finds a grant, an org switch to one that has it) on the SAME session. An
 * agent switch is not that edge: its own bind (`justBound`) drains the queue
 * into the new agent.
 */
export interface DrainEdgeInput {
  prevStatus: string | null;
  curStatus: string;
  prevAcp: string | undefined;
  curAcp: string | undefined;
  /** The send gate: resume pending, or a mode the resume could not restore. */
  prevResuming: boolean;
  curResuming: boolean;
  /** The no-AI-grant answer would lock this composer once idle. */
  prevGrantHold: boolean;
  curGrantHold: boolean;
}

export interface DrainEdge {
  /** The binding just landed: the held first message goes out ahead of the queue. */
  justBound: boolean;
  /** An optimistic resume just became sendable. */
  justResumed: boolean;
  /** A real turn ended on a bound session. */
  turnFinished: boolean;
  /** The grant hold lifted on an idle, bound session. */
  grantReleased: boolean;
  /** Whether the queue may shift its head into `handleSend` on this edge. */
  drainQueue: boolean;
}

export function drainEdge(input: DrainEdgeInput): DrainEdge {
  const {
    prevStatus,
    curStatus,
    prevAcp,
    curAcp,
    prevResuming,
    curResuming,
    prevGrantHold,
    curGrantHold,
  } = input;
  const justBound = !prevAcp && !!curAcp && !curResuming;
  const justResumed = prevResuming && !curResuming && !!curAcp;
  // `curAcp` is the gate: with no session there is nothing a turn could
  // have finished on, and nothing the next message could go to.
  const turnFinished =
    prevStatus === "running" && curStatus !== "running" && !!curAcp && !curResuming;
  const grantReleased =
    prevGrantHold &&
    !curGrantHold &&
    !!curAcp &&
    prevAcp === curAcp &&
    curStatus !== "running" &&
    !curResuming;
  return {
    justBound,
    justResumed,
    turnFinished,
    grantReleased,
    drainQueue: !curGrantHold && (turnFinished || justBound || justResumed || grantReleased),
  };
}
