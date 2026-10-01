// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { hasUnread, isErrorKind, useNotificationsStore, visibleItems } from "./notifications-store";

beforeEach(() => {
  localStorage.clear();
  useNotificationsStore.setState({ items: [], panelOpen: false });
});

const add = (
  orgId: string | undefined,
  kind: "terminal-done" | "terminal-failed" = "terminal-done",
) =>
  useNotificationsStore.getState().actions.add({
    kind,
    source: "terminal",
    title: "t",
    body: "b",
    tabId: "terminal",
    orgId,
  });

describe("org-scoped notifications", () => {
  it("shows only the active org's items plus untagged ones", () => {
    add("org-a");
    add("org-b");
    add(undefined);
    const items = useNotificationsStore.getState().items;
    expect(visibleItems(items, "org-a")).toHaveLength(2);
    expect(visibleItems(items, "org-b")).toHaveLength(2);
    expect(visibleItems(items, null)).toHaveLength(3);
  });

  it("unread and error flags are scoped too", () => {
    add("org-a", "terminal-failed");
    add("org-b");
    const items = useNotificationsStore.getState().items;
    expect(hasUnread(items, "org-a", isErrorKind)).toBe(true);
    expect(hasUnread(items, "org-b", isErrorKind)).toBe(false);
    expect(hasUnread(items, "org-b")).toBe(true);
  });

  it("opening the panel for one org leaves the other org's unread state alone", () => {
    add("org-a");
    add("org-b");
    useNotificationsStore.getState().actions.open("org-a");
    const items = useNotificationsStore.getState().items;
    expect(items.find((i) => i.orgId === "org-a")?.read).toBe(true);
    expect(items.find((i) => i.orgId === "org-b")?.read).toBe(false);
  });
});

describe("persistence", () => {
  const KEY = "atlas-notifications";
  const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "{}").state;

  it("persists items but not the panel's open state", () => {
    add("org-a");
    useNotificationsStore.getState().actions.open("org-a");
    expect(stored().items).toHaveLength(1);
    expect(stored().panelOpen).toBeUndefined();
  });

  it("restores items on rehydrate, capped at 200, dropping unknown kinds", async () => {
    const item = (i: number, kind = "terminal-done") => ({
      id: `n${i}`,
      kind,
      title: "t",
      body: "b",
      timestamp: new Date(0).toISOString(),
      source: "terminal",
      orgId: "org-a",
      read: false,
    });
    const items = [item(-1, "chat-done"), ...Array.from({ length: 250 }, (_, i) => item(i))];
    // After any setState — a write would overwrite the fixture.
    localStorage.setItem(KEY, JSON.stringify({ state: { items }, version: 1 }));
    await useNotificationsStore.persist.rehydrate();
    const restored = useNotificationsStore.getState().items;
    expect(restored).toHaveLength(200);
    expect(restored[0].id).toBe("n0");
    expect(useNotificationsStore.getState().panelOpen).toBe(false);
    expect(visibleItems(restored, "org-b")).toHaveLength(0);
  });
});
