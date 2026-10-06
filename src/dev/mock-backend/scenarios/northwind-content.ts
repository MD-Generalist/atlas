// The words of the `northwind` scenario: every Session, commit, comment, chat
// message, prompt draft and scripted agent run the Atlas Learn videos show.
// The shape is `northwind-content-types.ts`; the wiring is `northwind-world.ts`.
//
// ONE of each kind is written out in full, as the model for the rest:
//   - Session transcript ...... `s-discount` ("Add a discount code field to checkout")
//   - comment thread .......... `cm-email-1` / `cm-email-2` on `s-errors`
//   - chat thread ............. the #shop stock thread (`m-shop-01` … `m-shop-05`)
//   - prompt draft ............ `d-soldout` ("Sold out products")
//   - scripted run ............ `run-answer-comments` (video 7, beat 3: tool, then
//                               an approval card); video 1's own run replays
//                               `s-discount` step by step (`replay`)
//
// Everything marked `// TODO(content):` is a STUB: valid and rendering, but
// thin. Each carries a one-line brief (who, agent, what it did, which files).
// Fill a stub by giving it the same depth as the full example of its kind;
// keep the ids, the `commit` keys and the step ids comments point at.
//
// Paths are the real ones in `~/Developer/work/atlas-work/northwind-shop`.
// Times are relative to page load — see `When`.

import type { NorthwindContent, SessionContent } from "./northwind-content-types";

// ── The full example Session ──────────────────────────────────────────────

/**
 * Video 1 runs this on camera; videos 4 and 10 come back to it. The tool call
 * `e-checkout-ts` is the one Zuhayer comments on ("Should this validate the
 * code server-side?") — the code check lives in the browser, which is exactly
 * the gap: the server recomputes every total from the catalog.
 */
const DISCOUNT_SESSION: SessionContent = {
  id: "s-discount",
  title: "Add a discount code field to checkout",
  author: "uzayer",
  agent: "claude-code",
  model: "claude-opus-4",
  started: { daysAgo: 1, at: "10:32" },
  durationMin: 9,
  branch: "main",
  tokens: { input: 41_200, output: 6_850, cacheRead: 212_400, cacheWrite: 18_900 },
  costUsd: 1.94,
  createdOnCamera: "video1",
  steps: [
    { kind: "prompt", id: "p1", min: 0, text: "add a discount code field to checkout" },
    {
      kind: "thinking",
      id: "th1",
      min: 0,
      text: "Checkout is a plain form posted by src/client/checkout.ts, and the order summary is rendered from totalsHtml in summary.ts. I need the form, the summary, and a small table of valid codes. Look at how the server places the order first so the field goes where the rest of the details go.",
    },
    {
      kind: "tool",
      id: "r-checkout-html",
      min: 1,
      tool: "read",
      title: "Read src/client/checkout.html",
      path: "src/client/checkout.html",
      result:
        '<form id="checkout-form" novalidate>\n  <label>Full name <input name="name" autocomplete="name" required /></label>\n  <label>Email <input name="email" type="email" autocomplete="email" required /></label>\n  <label>Shipping address <textarea name="address" rows="3" …></textarea></label>\n  <p id="form-error" class="error" role="alert" hidden></p>\n  <button type="submit">Place order</button>\n</form>',
    },
    {
      kind: "tool",
      id: "r-checkout-ts",
      min: 1,
      tool: "read",
      title: "Read src/client/checkout.ts",
      path: "src/client/checkout.ts",
      result:
        'const summary = await api.cart();\nshowCartCount(summary);\n…\nform.addEventListener("submit", async (event) => {\n  const details = Object.fromEntries(new FormData(form)) as Record<string, string>;\n  …\n  const order = await api.placeOrder(details);',
    },
    {
      kind: "tool",
      id: "r-summary",
      min: 2,
      tool: "read",
      title: "Read src/client/summary.ts",
      path: "src/client/summary.ts",
      result:
        'export function totalsHtml(summary: CartSummary): string {\n  return `\n    <dl class="totals">\n      <dt>Subtotal</dt><dd>${formatCents(summary.subtotal)}</dd>\n      <dt>Shipping</dt>…',
    },
    {
      kind: "tool",
      id: "g-place-order",
      min: 2,
      tool: "grep",
      title: 'grep "placeOrder"',
      command: "placeOrder",
      result:
        "src/client/api.ts:37:  placeOrder: (details: Record<string, string>) =>\nsrc/client/checkout.ts:35:    const order = await api.placeOrder(details);",
    },
    {
      kind: "tool",
      id: "e-checkout-html",
      min: 3,
      tool: "edit",
      title: "Edit src/client/checkout.html",
      path: "src/client/checkout.html",
      diff: {
        before:
          '          <label>Shipping address <textarea name="address" rows="3" autocomplete="street-address" required></textarea></label>\n          <p id="form-error" class="error" role="alert" hidden></p>',
        after:
          '          <label>Shipping address <textarea name="address" rows="3" autocomplete="street-address" required></textarea></label>\n          <label>Discount code <input name="discountCode" autocomplete="off" spellcheck="false" placeholder="e.g. NORTHWIND10" /></label>\n          <p id="discount-note" class="note" hidden></p>\n          <p id="form-error" class="error" role="alert" hidden></p>',
      },
      result: "Applied 1 edit to src/client/checkout.html.",
    },
    {
      kind: "tool",
      id: "e-checkout-ts",
      min: 4,
      tool: "edit",
      title: "Edit src/client/checkout.ts",
      path: "src/client/checkout.ts",
      diff: {
        before:
          'const form = document.getElementById("checkout-form") as HTMLFormElement;\nconst summaryEl = document.getElementById("summary")!;',
        after:
          'const form = document.getElementById("checkout-form") as HTMLFormElement;\nconst summaryEl = document.getElementById("summary")!;\nconst discountNote = document.getElementById("discount-note")!;\n\n/** Percent off, by code. Codes are matched exactly as typed. */\nconst DISCOUNT_CODES: Record<string, number> = { NORTHWIND10: 10, WELCOME5: 5 };\n\nfunction applyDiscount(code: string, subtotal: number): number {\n  const percent = DISCOUNT_CODES[code.trim()];\n  if (!percent) return 0;\n  return Math.round((subtotal * percent) / 100);\n}\n\nform.discountCode.addEventListener("change", () => {\n  const off = applyDiscount(form.discountCode.value, summary.subtotal);\n  discountNote.hidden = !form.discountCode.value;\n  discountNote.textContent = off\n    ? `Code applied: −${formatCents(off)}`\n    : "That code isn\'t valid.";\n  summaryEl.querySelector(".totals")!.outerHTML = totalsHtml(summary, off);\n});',
      },
      result: "Applied 1 edit to src/client/checkout.ts.",
    },
    {
      kind: "tool",
      id: "e-summary",
      min: 5,
      tool: "edit",
      title: "Edit src/client/summary.ts",
      path: "src/client/summary.ts",
      diff: {
        before:
          'export function totalsHtml(summary: CartSummary): string {\n  return `\n    <dl class="totals">\n      <dt>Subtotal</dt><dd>${formatCents(summary.subtotal)}</dd>',
        after:
          'export function totalsHtml(summary: CartSummary, discount = 0): string {\n  return `\n    <dl class="totals">\n      <dt>Subtotal</dt><dd>${formatCents(summary.subtotal)}</dd>\n      ${discount ? `<dt>Discount</dt><dd>−${formatCents(discount)}</dd>` : ""}',
      },
      result: "Applied 1 edit to src/client/summary.ts.",
    },
    {
      kind: "tool",
      id: "b-test",
      min: 6,
      tool: "bash",
      title: "bun test",
      command: "bun test",
      result:
        "bun test v1.2.21\n\ntests/api.test.ts:\n✓ GET /api/products lists the catalog\n✓ POST /api/orders recomputes the total on the server\n…\n\n 21 pass\n 0 fail\n 48 expect() calls\nRan 21 tests across 4 files. [142.00ms]",
    },
    {
      kind: "tool",
      id: "b-typecheck",
      min: 7,
      tool: "bash",
      title: "bun run typecheck",
      command: "bun run typecheck",
      result: "$ tsc --noEmit",
    },
    {
      kind: "response",
      id: "resp1",
      min: 8,
      text: "Added a **Discount code** field to checkout.\n\n- `checkout.html`: the field sits under the shipping address, with a note line that says whether the code worked.\n- `checkout.ts`: `NORTHWIND10` takes 10% off and `WELCOME5` takes 5%. The summary updates as soon as you leave the field.\n- `summary.ts`: `totalsHtml` takes an optional discount and shows it as its own line.\n\nTests and typecheck pass. Try it with two Canvas Totes and `NORTHWIND10`: the summary drops from $55.99 to $50.99.",
    },
    { kind: "checkpoint", id: "cp1", min: 9, commit: "c-discount" },
  ],
};

export const CONTENT: NorthwindContent = {
  // ── Sessions, oldest first ──────────────────────────────────────────────
  sessions: [
    {
      // TODO(content): you · Claude Code (terminal, imported) · adds a 404 page for unknown non-API paths, styled like the others, linking back to products · server.ts, src/client/404.html, src/client/styles.css
      id: "s-404",
      title: "Add a friendly 404 page",
      author: "uzayer",
      agent: "claude-code",
      model: "claude-opus-4",
      started: { daysAgo: 6, at: "18:05" },
      durationMin: 3,
      branch: "main",
      tokens: { input: 18_200, output: 2_900, cacheRead: 88_000, cacheWrite: 9_100 },
      costUsd: 0.71,
      imported: true,
      brief:
        "you · Claude Code from a terminal before capture (imported) · friendly 404 page for unknown paths outside /api, link back to products · server.ts, src/client/404.html",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: "Add a friendly 404 page for unknown paths outside /api, styled like the other pages, with a link back to the products page.",
        },
        {
          kind: "tool",
          id: "w-404",
          min: 1,
          tool: "write",
          title: "Write src/client/404.html",
          path: "src/client/404.html",
          insertions: 19,
          result: "Created src/client/404.html.",
        },
        {
          kind: "response",
          id: "resp1",
          min: 2,
          text: "Added a 404 page and routed unknown paths to it.",
        },
        { kind: "checkpoint", id: "cp1", min: 3, commit: "c-404" },
      ],
    },
    {
      // TODO(content): you · Claude Code (terminal, imported) · adds `bun run check` (typecheck + tests) and documents it in the README · package.json, README.md
      id: "s-check",
      title: "Add a check script",
      author: "uzayer",
      agent: "claude-code",
      model: "claude-opus-4",
      started: { daysAgo: 6, at: "18:20" },
      durationMin: 2,
      branch: "main",
      tokens: { input: 9_400, output: 1_100, cacheRead: 52_000, cacheWrite: 4_200 },
      costUsd: 0.38,
      imported: true,
      brief:
        "you · Claude Code from a terminal before capture (imported) · `bun run check` script running typecheck and tests, noted in README · package.json, README.md",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: "Add a `bun run check` script that runs the typecheck and the tests, and mention it in the README.",
        },
        {
          kind: "tool",
          id: "e-package",
          min: 1,
          tool: "edit",
          title: "Edit package.json",
          path: "package.json",
          insertions: 1,
          result: "Applied 1 edit to package.json.",
        },
        {
          kind: "response",
          id: "resp1",
          min: 2,
          text: "`bun run check` now runs tsc and bun test.",
        },
        { kind: "checkpoint", id: "cp1", min: 2, commit: "c-check" },
      ],
    },
    {
      // TODO(content): you · Claude Code · "Sort by" dropdown (Featured / Price low→high / high→low), client-side only · src/client/index.html, src/client/products.ts, src/client/styles.css. Video 1 beat 1 hovers a line it wrote in products.ts.
      id: "s-sort",
      title: "Add a sort control to the product list",
      author: "uzayer",
      agent: "claude-code",
      model: "claude-opus-4",
      started: { daysAgo: 5, at: "10:05" },
      durationMin: 6,
      branch: "main",
      tokens: { input: 32_800, output: 5_200, cacheRead: 164_000, cacheWrite: 14_300 },
      costUsd: 1.52,
      brief:
        "you · Claude Code · Sort by dropdown above the product list (Featured, Price: low to high, Price: high to low), sorted on the client · src/client/index.html, src/client/products.ts",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: 'Add a "Sort by" dropdown above the product list with three options: Featured (the current order), Price: low to high, and Price: high to low. Sort on the client; don\'t change the API. Keep the styling consistent with the existing page.',
        },
        {
          kind: "tool",
          id: "r-products",
          min: 1,
          tool: "read",
          title: "Read src/client/products.ts",
          path: "src/client/products.ts",
        },
        {
          kind: "tool",
          id: "e-products",
          min: 3,
          tool: "edit",
          title: "Edit src/client/products.ts",
          path: "src/client/products.ts",
          insertions: 18,
          deletions: 4,
          result: "Applied 2 edits to src/client/products.ts.",
        },
        {
          kind: "response",
          id: "resp1",
          min: 5,
          text: "Added the Sort by control. Featured keeps the catalog order.",
        },
        { kind: "checkpoint", id: "cp1", min: 6, commit: "c-sort" },
      ],
    },
    {
      // TODO(content): Zuhayer · Codex · stock counts in the catalog (Hoodie 2, Pin Set 0, rest 25), stock in /api/products, server refuses to oversell, "Only N left" label, tests · src/server/catalog.ts, src/server/cart.ts, src/client/products.ts, tests/cart.test.ts. Its card is in #shop.
      id: "s-stock",
      title: "Track stock and refuse to oversell",
      author: "zuhayer",
      agent: "codex",
      model: "gpt-5",
      started: { daysAgo: 5, at: "11:40" },
      durationMin: 8,
      branch: "main",
      tokens: { input: 58_100, output: 9_400, cacheRead: 241_000, cacheWrite: 0 },
      costUsd: 0.92,
      brief:
        "Zuhayer · Codex · stock per product (Hoodie 2, Pin Set 0, rest 25), stock in /api/products, server refuses to oversell with a clear error, 'Only N left' at ≤3, tests · src/server/catalog.ts, src/server/cart.ts, src/client/products.ts, tests/cart.test.ts",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: 'Give every product a stock count in src/server/catalog.ts (set the Harbor Hoodie to 2 and the Enamel Pin Set to 0; everything else 25). Include stock in the /api/products response. On the server, refuse to put more of a product in the cart than is in stock, with a clear error message. On the product list, show "Only N left" when stock is 3 or fewer. Add tests for the server check.',
        },
        {
          kind: "tool",
          id: "e-catalog",
          min: 2,
          tool: "edit",
          title: "Edit src/server/catalog.ts",
          path: "src/server/catalog.ts",
          insertions: 7,
          deletions: 1,
        },
        {
          kind: "tool",
          id: "e-cart",
          min: 4,
          tool: "edit",
          title: "Edit src/server/cart.ts",
          path: "src/server/cart.ts",
          insertions: 9,
          deletions: 1,
        },
        {
          kind: "tool",
          id: "b-test",
          min: 6,
          tool: "bash",
          title: "bun test",
          command: "bun test",
          result: " 24 pass\n 0 fail",
        },
        {
          kind: "response",
          id: "resp1",
          min: 7,
          text: "Stock is tracked on the server and the cart refuses to oversell.",
        },
        { kind: "checkpoint", id: "cp1", min: 8, commit: "c-stock" },
      ],
    },
    {
      // TODO(content): you · Claude Code · search box filtering products by name/description as you type, case-insensitive, "No products match", works with Sort by · src/client/index.html, src/client/products.ts
      id: "s-search",
      title: "Filter products as you type",
      author: "uzayer",
      agent: "claude-code",
      model: "claude-opus-4",
      started: { daysAgo: 4, at: "09:40" },
      durationMin: 5,
      branch: "main",
      tokens: { input: 29_600, output: 4_400, cacheRead: 150_000, cacheWrite: 11_800 },
      costUsd: 1.31,
      brief:
        "you · Claude Code · search box above the list, filters by name and description as you type, case-insensitive, 'No products match', works with Sort by · src/client/index.html, src/client/products.ts",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: 'Add a search box above the product list that filters products by name and description as you type, case-insensitive, on the client. Show "No products match" when nothing matches. It should work together with the Sort by dropdown.',
        },
        {
          kind: "tool",
          id: "e-products",
          min: 2,
          tool: "edit",
          title: "Edit src/client/products.ts",
          path: "src/client/products.ts",
          insertions: 14,
          deletions: 3,
        },
        {
          kind: "response",
          id: "resp1",
          min: 4,
          text: "Search filters as you type and respects the sort.",
        },
        { kind: "checkpoint", id: "cp1", min: 5, commit: "c-search" },
      ],
    },
    {
      // TODO(content): Zuhayer · Atlas Agent · validateDetails collects every field error and returns them together (422, { error, fields }), checkout shows each under its field, tests updated · src/server/orders.ts, src/client/checkout.ts, tests/orders.test.ts. Step `e-orders` carries the resolved comment thread.
      id: "s-errors",
      title: "Show every checkout error at once",
      author: "zuhayer",
      agent: "atlas-agent",
      model: "claude-sonnet-4",
      started: { daysAgo: 4, at: "14:15" },
      durationMin: 7,
      branch: "main",
      tokens: { input: 46_300, output: 7_900, cacheRead: 198_000, cacheWrite: 21_400 },
      costUsd: 0.84,
      brief:
        "Zuhayer · Atlas Agent · validateDetails returns every field error at once (422, { error, fields: { name?, email?, address? } }), checkout marks each bad field, tests updated · src/server/orders.ts, src/client/checkout.ts, tests/orders.test.ts",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: "At checkout the server stops at the first invalid field, so a shopper fixes one error, submits, and finds the next. Change validateDetails in src/server/orders.ts to collect every field error and return them together (keep the 422 status; return { error, fields: { name?, email?, address? } }). Update the checkout page to show each message under its own field and mark every bad field. Update the tests.",
        },
        {
          kind: "tool",
          id: "r-orders",
          min: 1,
          tool: "read",
          title: "Read src/server/orders.ts",
          path: "src/server/orders.ts",
        },
        {
          kind: "tool",
          id: "e-orders",
          min: 3,
          tool: "edit",
          title: "Edit src/server/orders.ts",
          path: "src/server/orders.ts",
          diff: {
            before:
              '  const details = { name: read("name"), email: read("email"), address: read("address") };\n  if (!details.name) throw new CheckoutError("Enter your name", "name");\n  if (!EMAIL.test(details.email)) throw new CheckoutError("Enter a valid email address", "email");\n  if (details.address.length < 10) throw new CheckoutError("Enter your full shipping address", "address");\n  return details;',
            after:
              '  const details = { name: read("name"), email: read("email"), address: read("address") };\n  const fields: FieldErrors = {};\n  if (!details.name) fields.name = "Enter your name";\n  if (!EMAIL.test(details.email)) fields.email = "Enter a valid email address";\n  if (details.address.length < 10) fields.address = "Enter your full shipping address";\n  if (Object.keys(fields).length > 0) throw new CheckoutError("Check the highlighted fields", fields);\n  return details;',
          },
        },
        {
          kind: "tool",
          id: "e-checkout",
          min: 5,
          tool: "edit",
          title: "Edit src/client/checkout.ts",
          path: "src/client/checkout.ts",
          insertions: 12,
          deletions: 4,
        },
        {
          kind: "response",
          id: "resp1",
          min: 6,
          text: "Every invalid field is reported at once, and each shows its own message.",
        },
        { kind: "checkpoint", id: "cp1", min: 7, commit: "c-errors" },
      ],
    },
    {
      // TODO(content): you · Atlas Agent · reviews Zuhayer's "Show every checkout error at once" like a PR: what changed, risks, what tests miss; no commit. Uses org tools to read the teammate's session.
      id: "s-review",
      title: "Review Zuhayer's checkout errors session",
      author: "uzayer",
      agent: "atlas-agent",
      model: "claude-sonnet-4",
      started: { daysAgo: 4, at: "15:30" },
      durationMin: 3,
      branch: "main",
      tokens: { input: 22_400, output: 2_300, cacheRead: 61_000, cacheWrite: 8_800 },
      costUsd: 0.31,
      brief:
        "you · Atlas Agent · PR-style review of Zuhayer's latest session (what changed, anything risky, untested cases), no commit · reads the session via org tools",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: "Review Zuhayer's latest session on northwind-shop like a pull request: what changed, anything risky, and anything the tests don't cover. Keep it short.",
        },
        {
          kind: "tool",
          id: "o-session",
          min: 1,
          tool: "org",
          title: "Read session: Show every checkout error at once",
          command: "org_read_session",
        },
        {
          kind: "response",
          id: "resp1",
          min: 2,
          text: "The change is small and safe. One gap: no test sends all three fields invalid at once.",
        },
      ],
    },
    {
      // TODO(content): Zuhayer · Claude Code · sent from the "Sold out products" draft: "Sold out" badge, disabled Add to cart labelled "Sold out", sold-out items last in Featured, test that the API still lists them · src/client/products.ts, src/client/styles.css, tests/api.test.ts
      id: "s-soldout",
      title: "Mark sold-out products",
      author: "zuhayer",
      agent: "claude-code",
      model: "claude-opus-4",
      started: { daysAgo: 3, at: "10:20" },
      durationMin: 6,
      branch: "main",
      tokens: { input: 27_900, output: 4_100, cacheRead: 133_000, cacheWrite: 10_900 },
      costUsd: 1.18,
      brief:
        "Zuhayer · Claude Code (sent from the #shop draft) · 'Sold out' badge, disabled 'Sold out' button, sold-out last in Featured, API test · src/client/products.ts, src/client/styles.css, tests/api.test.ts",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: 'Products with a stock of 0 should show a "Sold out" badge on the product list, and their Add to cart button should be disabled with the label "Sold out". Don\'t hide them. Add a test that the API still lists sold-out products.\nPut sold-out products at the end of the Featured order.',
        },
        {
          kind: "tool",
          id: "e-products",
          min: 2,
          tool: "edit",
          title: "Edit src/client/products.ts",
          path: "src/client/products.ts",
          insertions: 11,
          deletions: 2,
        },
        {
          kind: "response",
          id: "resp1",
          min: 5,
          text: "Sold-out products show a badge and sit at the end of Featured.",
        },
        { kind: "checkpoint", id: "cp1", min: 6, commit: "c-soldout" },
      ],
    },
    {
      // TODO(content): you · Claude Code · moves the catalog into data/products.json, loaded once at startup, PRODUCTS and findProduct unchanged, tests + typecheck green · src/server/catalog.ts, data/products.json
      id: "s-catalog",
      title: "Load the catalog from data/products.json",
      author: "uzayer",
      agent: "claude-code",
      model: "claude-opus-4",
      started: { daysAgo: 3, at: "13:45" },
      durationMin: 7,
      branch: "main",
      tokens: { input: 36_700, output: 5_800, cacheRead: 171_000, cacheWrite: 13_600 },
      costUsd: 1.63,
      brief:
        "you · Claude Code · catalog moved out of src/server/catalog.ts into data/products.json, loaded once at startup, PRODUCTS/findProduct unchanged · src/server/catalog.ts, data/products.json",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: "Move the product catalog out of src/server/catalog.ts into data/products.json and load it once at startup. Keep the PRODUCTS export and findProduct working exactly as they do now, and make sure bun test and bun run typecheck still pass.",
        },
        {
          kind: "tool",
          id: "w-json",
          min: 2,
          tool: "write",
          title: "Write data/products.json",
          path: "data/products.json",
          insertions: 50,
        },
        {
          kind: "tool",
          id: "e-catalog",
          min: 3,
          tool: "edit",
          title: "Edit src/server/catalog.ts",
          path: "src/server/catalog.ts",
          insertions: 4,
          deletions: 45,
        },
        {
          kind: "response",
          id: "resp1",
          min: 6,
          text: "The catalog loads from data/products.json at startup.",
        },
        { kind: "checkpoint", id: "cp1", min: 7, commit: "c-catalog" },
      ],
    },
    {
      // TODO(content): Zuhayer · Codex · order details page at /orders/:id (number, date, lines, totals) via GET /api/orders/:id, linked from the thank-you message, "Order not found" · src/client/order.html, src/client/order.ts, server.ts, src/client/checkout.ts
      id: "s-order-page",
      title: "Add an order details page",
      author: "zuhayer",
      agent: "codex",
      model: "gpt-5",
      started: { daysAgo: 2, at: "11:05" },
      durationMin: 6,
      branch: "main",
      tokens: { input: 44_900, output: 7_200, cacheRead: 188_000, cacheWrite: 0 },
      costUsd: 0.71,
      brief:
        "Zuhayer · Codex · /orders/:id page showing number, date, lines, totals from GET /api/orders/:id, linked from checkout's thank-you, 'Order not found' · src/client/order.html, src/client/order.ts, server.ts",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: 'Add an order details page at /orders/:id that shows a placed order\'s number, date, lines and totals, using the existing GET /api/orders/:id endpoint. Link to it from the thank-you message on the checkout page. Show "Order not found" for an unknown id.',
        },
        {
          kind: "tool",
          id: "w-order",
          min: 2,
          tool: "write",
          title: "Write src/client/order.ts",
          path: "src/client/order.ts",
          insertions: 38,
        },
        {
          kind: "response",
          id: "resp1",
          min: 5,
          text: "Added /orders/:id and linked it from the thank-you message.",
        },
        { kind: "checkpoint", id: "cp1", min: 6, commit: "c-order-page" },
      ],
    },
    {
      // TODO(content): you · Atlas Agent · caps checkout fields on the server (name 100, email 254, address 300) with the same 422 field errors, plus tests · src/server/orders.ts, tests/orders.test.ts
      id: "s-lengths",
      title: "Limit checkout field lengths",
      author: "uzayer",
      agent: "atlas-agent",
      model: "claude-sonnet-4",
      started: { daysAgo: 2, at: "16:10" },
      durationMin: 5,
      branch: "main",
      tokens: { input: 30_100, output: 4_600, cacheRead: 120_000, cacheWrite: 12_200 },
      costUsd: 0.52,
      brief:
        "you · Atlas Agent · server-side caps (name 100, email 254, address 300) returning the same 422 field errors, tests · src/server/orders.ts, tests/orders.test.ts",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: "On the server, cap checkout fields at sensible lengths: name 100 characters, email 254, address 300. Return the same 422 field errors as the other checks, and add tests.",
        },
        {
          kind: "tool",
          id: "e-orders",
          min: 2,
          tool: "edit",
          title: "Edit src/server/orders.ts",
          path: "src/server/orders.ts",
          insertions: 8,
          deletions: 1,
        },
        {
          kind: "response",
          id: "resp1",
          min: 4,
          text: "Each field is capped on the server with its own error.",
        },
        { kind: "checkpoint", id: "cp1", min: 5, commit: "c-lengths" },
      ],
    },
    {
      // TODO(content): Priya · Codex · caps a cart line at 10 of one product and makes the quantity input respect it, with a test · src/server/cart.ts, src/client/cart.ts, tests/cart.test.ts. Exists so "three of us ran agents yesterday" (video 3) is true.
      id: "s-priya-qty",
      title: "Cap cart quantities at 10 per product",
      author: "priya",
      agent: "codex",
      model: "gpt-5",
      started: { daysAgo: 1, at: "15:05" },
      durationMin: 5,
      branch: "main",
      tokens: { input: 21_700, output: 3_300, cacheRead: 96_000, cacheWrite: 0 },
      costUsd: 0.38,
      brief:
        "Priya · Codex · max 10 of one product per cart line, server error + quantity input max, test · src/server/cart.ts, src/client/cart.ts, tests/cart.test.ts",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: "Cap a cart line at 10 of one product. The server should refuse more with a clear message, and the quantity input on the cart page should not go above 10. Add a test.",
        },
        {
          kind: "tool",
          id: "e-cart",
          min: 2,
          tool: "edit",
          title: "Edit src/server/cart.ts",
          path: "src/server/cart.ts",
          insertions: 5,
          deletions: 1,
        },
        {
          kind: "response",
          id: "resp1",
          min: 4,
          text: "Cart lines are capped at 10 on both sides.",
        },
        { kind: "checkpoint", id: "cp1", min: 5, commit: "c-priya-qty" },
      ],
    },
    DISCOUNT_SESSION,
    {
      // TODO(content): Zuhayer · Codex · read-only walkthrough of how an order total is computed, cart page → POST /api/orders → confirmation; NO commit. Its tool results (not its title) must mention "discount" (the client-only DISCOUNT_CODES table) — video 3's search.
      id: "s-total-walk",
      afterVideo1: true,
      title: "Walk me through how an order's total is computed",
      author: "zuhayer",
      agent: "codex",
      model: "gpt-5",
      started: { daysAgo: 1, at: "14:05" },
      durationMin: 4,
      branch: "main",
      tokens: { input: 38_400, output: 3_900, cacheRead: 142_000, cacheWrite: 0 },
      costUsd: 0.49,
      brief:
        "Zuhayer · Codex · read-only walkthrough of the order total, cart page to confirmation, no commit; tool results mention the client-only discount codes · src/client/checkout.ts, src/client/summary.ts, src/server/orders.ts, src/shared/pricing.ts",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: "Walk me through how an order's total is computed now, from the cart page to the order confirmation. Read the code; don't change anything.",
        },
        {
          kind: "tool",
          id: "r-checkout",
          min: 1,
          tool: "read",
          title: "Read src/client/checkout.ts",
          path: "src/client/checkout.ts",
          result:
            "const DISCOUNT_CODES: Record<string, number> = { NORTHWIND10: 10, WELCOME5: 5 };\n\nfunction applyDiscount(code: string, subtotal: number): number {",
        },
        {
          kind: "tool",
          id: "r-pricing",
          min: 2,
          tool: "read",
          title: "Read src/shared/pricing.ts",
          path: "src/shared/pricing.ts",
        },
        {
          kind: "response",
          id: "resp1",
          min: 3,
          text: "The server recomputes subtotal, shipping and total from the catalog when the order is placed.",
        },
      ],
    },
    {
      // TODO(content): you · Claude Code · creates src/server/discounts.ts (valid codes + check function) and makes POST /api/orders reject an invalid code and apply a valid one; no tests ("someone else is doing that") · src/server/discounts.ts, src/server/orders.ts, src/server/api.ts. First half of video 10's "Produced by 2 sessions".
      id: "s-server-discounts",
      afterVideo1: true,
      title: "Move discount code validation to the server",
      author: "uzayer",
      agent: "claude-code",
      model: "claude-opus-4",
      started: { daysAgo: 1, at: "16:02" },
      durationMin: 8,
      branch: "server-discounts",
      tokens: { input: 48_600, output: 8_100, cacheRead: 221_000, cacheWrite: 19_700 },
      costUsd: 2.07,
      brief:
        "you · Claude Code · new src/server/discounts.ts (codes + checkDiscount), POST /api/orders rejects invalid codes and applies valid ones when recomputing the total, no tests · src/server/discounts.ts, src/server/orders.ts",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: "Move discount code validation to the server: create src/server/discounts.ts with the valid codes and a function that checks a code and returns the discount, and make POST /api/orders reject an invalid code and apply a valid one when it recomputes the total. Don't write tests; someone else is doing that.",
        },
        {
          kind: "tool",
          id: "w-discounts",
          min: 2,
          tool: "write",
          title: "Write src/server/discounts.ts",
          path: "src/server/discounts.ts",
          insertions: 27,
        },
        {
          kind: "tool",
          id: "e-orders",
          min: 4,
          tool: "edit",
          title: "Edit src/server/orders.ts",
          path: "src/server/orders.ts",
          insertions: 9,
          deletions: 2,
        },
        {
          kind: "response",
          id: "resp1",
          min: 7,
          text: "Discount codes are now checked and applied on the server.",
        },
        { kind: "checkpoint", id: "cp1", min: 8, commit: "c-validate" },
      ],
    },
    {
      // TODO(content): you · Codex · writes tests/discounts.test.ts for src/server/discounts.ts and for POST /api/orders with a valid code, an invalid code and no code · tests/discounts.test.ts. Second half of video 10's "Produced by 2 sessions".
      id: "s-discount-tests",
      afterVideo1: true,
      title: "Write tests for discount validation",
      author: "uzayer",
      agent: "codex",
      model: "gpt-5",
      started: { daysAgo: 1, at: "16:41" },
      durationMin: 5,
      branch: "server-discounts",
      tokens: { input: 26_300, output: 5_400, cacheRead: 97_000, cacheWrite: 0 },
      costUsd: 0.44,
      brief:
        "you · Codex · tests/discounts.test.ts covering checkDiscount and POST /api/orders with a valid code, an invalid code and no code · tests/discounts.test.ts",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: "Write tests in tests/discounts.test.ts for src/server/discounts.ts and for POST /api/orders with a valid code, an invalid code, and no code.",
        },
        {
          kind: "tool",
          id: "w-tests",
          min: 2,
          tool: "write",
          title: "Write tests/discounts.test.ts",
          path: "tests/discounts.test.ts",
          insertions: 41,
        },
        {
          kind: "tool",
          id: "b-test",
          min: 3,
          tool: "bash",
          title: "bun test tests/discounts.test.ts",
          command: "bun test tests/discounts.test.ts",
          result: " 6 pass\n 0 fail",
        },
        {
          kind: "response",
          id: "resp1",
          min: 4,
          text: "Six tests cover the codes and the orders endpoint.",
        },
        { kind: "checkpoint", id: "cp1", min: 5, commit: "c-validate" },
      ],
    },
    {
      // TODO(content): you · Claude Code · makes discount codes case-insensitive by normalising to uppercase once at the API boundary, plus a test; the decision `/remember` stores in video 11 comes from here · src/server/api.ts, src/server/discounts.ts, tests/discounts.test.ts. Zuhayer's open comment (video 7) sits on `e-api`.
      id: "s-normalise",
      afterVideo1: true,
      title: "Make discount codes case-insensitive",
      author: "uzayer",
      agent: "claude-code",
      model: "claude-opus-4",
      started: { daysAgo: 0, at: "now-160" },
      durationMin: 6,
      branch: "main",
      tokens: { input: 24_100, output: 3_700, cacheRead: 119_000, cacheWrite: 9_800 },
      costUsd: 1.07,
      brief:
        "you · Claude Code · codes are case-insensitive: normalise to uppercase in one place at the API boundary, plus a test · src/server/api.ts, src/server/discounts.ts, tests/discounts.test.ts",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: "Discount codes should be case-insensitive. Normalise them to uppercase at the API boundary, in one place, and add a test.",
        },
        {
          kind: "tool",
          id: "e-api",
          min: 2,
          tool: "edit",
          title: "Edit src/server/api.ts",
          path: "src/server/api.ts",
          diff: {
            before: "        const order = orders.place(carts.get(cartId), await req.json());",
            after:
              '        const body = await req.json();\n        // Codes are case-insensitive: normalise once, here, at the boundary.\n        if (typeof body.discountCode === "string") body.discountCode = body.discountCode.trim().toUpperCase();\n        const order = orders.place(carts.get(cartId), body);',
          },
        },
        {
          kind: "tool",
          id: "b-test",
          min: 4,
          tool: "bash",
          title: "bun test",
          command: "bun test",
          result: " 28 pass\n 0 fail",
        },
        {
          kind: "response",
          id: "resp1",
          min: 5,
          text: "Codes are uppercased once in the orders route, so `northwind10` works.",
        },
        { kind: "checkpoint", id: "cp1", min: 6, commit: "c-normalise" },
      ],
    },
    {
      // TODO(content): Zuhayer · Codex · LIVE during videos 1, 3 and 7 · adds tests for every exported function in src/server/cart.ts and src/server/orders.ts not already covered; `liveSteps` stream in one by one on the `zuhayerSessionLive` cue · tests/cart.test.ts, tests/orders.test.ts
      id: "s-live-tests",
      title: "Add tests for the cart and order helpers",
      author: "zuhayer",
      agent: "codex",
      model: "gpt-5",
      started: { daysAgo: 0, at: "now-4" },
      durationMin: 4,
      branch: "main",
      tokens: { input: 31_200, output: 4_100, cacheRead: 88_000, cacheWrite: 0 },
      costUsd: 0.41,
      brief:
        "Zuhayer · Codex · live: tests for every exported function in src/server/cart.ts and src/server/orders.ts that isn't covered; streams on cue · tests/cart.test.ts, tests/orders.test.ts",
      steps: [
        {
          kind: "prompt",
          id: "p1",
          min: 0,
          text: "Add tests for every exported function in src/server/cart.ts and src/server/orders.ts that isn't already covered.",
        },
        {
          kind: "thinking",
          id: "th1",
          min: 1,
          text: "List the exports in both files, then check which ones the existing tests already call.",
        },
        {
          kind: "tool",
          id: "r-cart",
          min: 1,
          tool: "read",
          title: "Read src/server/cart.ts",
          path: "src/server/cart.ts",
        },
        {
          kind: "tool",
          id: "g-exports",
          min: 2,
          tool: "grep",
          title: 'grep "^export"',
          command: "^export",
          result:
            "src/server/cart.ts:4:export class CartError extends Error {\nsrc/server/cart.ts:12:export class CartStore {\nsrc/server/cart.ts:31:export function addItem(\nsrc/server/cart.ts:46:export function setQuantity(\nsrc/server/cart.ts:58:export function summarize(\nsrc/server/orders.ts:4:export class CheckoutError extends Error {\nsrc/server/orders.ts:15:export function validateDetails(\nsrc/server/orders.ts:27:export class OrderBook {",
        },
      ],
      live: {
        liveSteps: [
          {
            kind: "tool",
            id: "r-cart-tests",
            min: 3,
            tool: "read",
            title: "Read tests/cart.test.ts",
            path: "tests/cart.test.ts",
          },
          {
            kind: "response",
            id: "resp1",
            min: 3,
            text: "`setQuantity` with 0 and `CartStore.clear` have no tests yet. Adding them first.",
          },
          {
            kind: "tool",
            id: "e-cart-tests",
            min: 4,
            tool: "edit",
            title: "Edit tests/cart.test.ts",
            path: "tests/cart.test.ts",
            insertions: 22,
          },
          {
            kind: "tool",
            id: "b-test",
            min: 5,
            tool: "bash",
            title: "bun test tests/cart.test.ts",
            command: "bun test tests/cart.test.ts",
            result: " 9 pass\n 0 fail",
          },
          {
            kind: "tool",
            id: "e-orders-tests",
            min: 6,
            tool: "edit",
            title: "Edit tests/orders.test.ts",
            path: "tests/orders.test.ts",
            insertions: 18,
          },
        ],
      },
    },
  ],

  // ── Commits on main, oldest first ───────────────────────────────────────
  //
  // `c-validate` was made on `server-discounts` and rebased onto `c-priya-qty`
  // before it was merged, so its hash moved (`rebasedFrom`) and its checkpoints
  // followed. Video 10 searches for its short SHA: 7d3e0a1.
  commits: [
    {
      key: "c-init",
      sha: "0f4c2a91d8be6e3375a0c19f2d47b8e5a6c31d02",
      subject: "Initial commit: product list, cart and checkout",
      author: "uzayer",
      when: { daysAgo: 7, at: "17:12" },
      files: [
        { path: "server.ts", status: "A", insertions: 18, deletions: 0 },
        { path: "src/server/api.ts", status: "A", insertions: 90, deletions: 0 },
        { path: "src/server/cart.ts", status: "A", insertions: 71, deletions: 0 },
        { path: "src/server/orders.ts", status: "A", insertions: 57, deletions: 0 },
        { path: "src/client/checkout.ts", status: "A", insertions: 51, deletions: 0 },
        { path: "src/shared/pricing.ts", status: "A", insertions: 12, deletions: 0 },
      ],
      sessions: [],
    },
    {
      key: "c-404",
      sha: "a3b81c7e0d52f94461c2e8a7b09d3f15c64e2a70",
      subject: "Add a 404 page",
      author: "uzayer",
      when: { daysAgo: 6, at: "18:09" },
      files: [
        { path: "src/client/404.html", status: "A", insertions: 19, deletions: 0 },
        { path: "server.ts", status: "M", insertions: 3, deletions: 1 },
      ],
      sessions: ["s-404"],
    },
    {
      key: "c-check",
      sha: "5e2d07f1b9a46c83d0e7f2a1c5b94d6e8a0f3c17",
      subject: "Add a check script",
      author: "uzayer",
      when: { daysAgo: 6, at: "18:23" },
      files: [
        { path: "package.json", status: "M", insertions: 1, deletions: 0 },
        { path: "README.md", status: "M", insertions: 4, deletions: 0 },
      ],
      sessions: ["s-check"],
    },
    {
      key: "c-sort",
      sha: "c91f4e20a7d35b8e6f01c2d9a4b7e3f58d6c0a19",
      subject: "Add a sort control to the product list",
      author: "uzayer",
      when: { daysAgo: 5, at: "10:12" },
      files: [
        { path: "src/client/products.ts", status: "M", insertions: 18, deletions: 4 },
        { path: "src/client/index.html", status: "M", insertions: 8, deletions: 0 },
      ],
      sessions: ["s-sort"],
    },
    {
      key: "c-stock",
      sha: "2b7a9d4c1e8f053a6d2c7b9e4f1a08d3c5e6b742",
      subject: "Track stock and refuse to oversell",
      author: "zuhayer",
      when: { daysAgo: 5, at: "11:49" },
      files: [
        { path: "src/server/catalog.ts", status: "M", insertions: 7, deletions: 1 },
        { path: "src/server/cart.ts", status: "M", insertions: 9, deletions: 1 },
        { path: "src/client/products.ts", status: "M", insertions: 4, deletions: 1 },
        { path: "tests/cart.test.ts", status: "M", insertions: 14, deletions: 0 },
      ],
      sessions: ["s-stock"],
    },
    {
      key: "c-search",
      sha: "8d6e1f3a5b0c42d97e8a1b3c6d0f4e2a9b7c5d31",
      subject: "Filter products as you type",
      author: "uzayer",
      when: { daysAgo: 4, at: "09:46" },
      files: [
        { path: "src/client/products.ts", status: "M", insertions: 14, deletions: 3 },
        { path: "src/client/index.html", status: "M", insertions: 2, deletions: 0 },
      ],
      sessions: ["s-search"],
    },
    {
      key: "c-errors",
      sha: "f4a2c86b1d9e037a5c8b2e6d4f1a7c9e0b3d5f82",
      subject: "Show every checkout error at once",
      author: "zuhayer",
      when: { daysAgo: 4, at: "14:23" },
      files: [
        { path: "src/server/orders.ts", status: "M", insertions: 11, deletions: 5 },
        { path: "src/client/checkout.ts", status: "M", insertions: 12, deletions: 4 },
        { path: "tests/orders.test.ts", status: "M", insertions: 16, deletions: 6 },
      ],
      sessions: ["s-errors"],
    },
    {
      key: "c-soldout",
      sha: "6c0e8a2f4b1d93e7a5c0f2b8d6e4a1c3f9b7d025",
      subject: "Mark sold-out products",
      author: "zuhayer",
      when: { daysAgo: 3, at: "10:27" },
      files: [
        { path: "src/client/products.ts", status: "M", insertions: 11, deletions: 2 },
        { path: "src/client/styles.css", status: "M", insertions: 6, deletions: 0 },
        { path: "tests/api.test.ts", status: "M", insertions: 9, deletions: 0 },
      ],
      sessions: ["s-soldout"],
    },
    {
      key: "c-catalog",
      sha: "1e9b3d7f0a2c84e6b1d5f9a3c7e0b2d4f6a8c913",
      subject: "Load the catalog from data/products.json",
      author: "uzayer",
      when: { daysAgo: 3, at: "13:53" },
      files: [
        { path: "data/products.json", status: "A", insertions: 50, deletions: 0 },
        { path: "src/server/catalog.ts", status: "M", insertions: 4, deletions: 45 },
      ],
      sessions: ["s-catalog"],
    },
    {
      key: "c-order-page",
      sha: "d27f5b9c3e1a06d84f2b7c9e5a3d1f08b6c4e2a7",
      subject: "Add an order details page",
      author: "zuhayer",
      when: { daysAgo: 2, at: "11:12" },
      files: [
        { path: "src/client/order.html", status: "A", insertions: 24, deletions: 0 },
        { path: "src/client/order.ts", status: "A", insertions: 38, deletions: 0 },
        { path: "server.ts", status: "M", insertions: 2, deletions: 0 },
        { path: "src/client/checkout.ts", status: "M", insertions: 1, deletions: 1 },
      ],
      sessions: ["s-order-page"],
    },
    {
      key: "c-lengths",
      sha: "9a4c6e8b2d0f17a3c5e9b1d7f4a2c8e6b0d3f5a1",
      subject: "Limit checkout field lengths",
      author: "uzayer",
      when: { daysAgo: 2, at: "16:16" },
      files: [
        { path: "src/server/orders.ts", status: "M", insertions: 8, deletions: 1 },
        { path: "tests/orders.test.ts", status: "M", insertions: 12, deletions: 0 },
      ],
      sessions: ["s-lengths"],
    },
    {
      key: "c-discount",
      sha: "4e8a0c2f6b9d13e5a7c1f3b5d9e0a2c4f8b6d074",
      subject: "Add a discount code field to checkout",
      author: "uzayer",
      when: { daysAgo: 1, at: "10:42" },
      files: [
        { path: "src/client/checkout.html", status: "M", insertions: 2, deletions: 0 },
        { path: "src/client/checkout.ts", status: "M", insertions: 18, deletions: 1 },
        { path: "src/client/summary.ts", status: "M", insertions: 2, deletions: 1 },
      ],
      sessions: ["s-discount"],
    },
    {
      key: "c-priya-qty",
      sha: "b5d1f7a3c9e2048b6d0f2a4c8e1b3d5f7a9c0e26",
      subject: "Cap cart quantities at 10 per product",
      author: "priya",
      when: { daysAgo: 1, at: "15:12" },
      files: [
        { path: "src/server/cart.ts", status: "M", insertions: 5, deletions: 1 },
        { path: "src/client/cart.ts", status: "M", insertions: 1, deletions: 1 },
        { path: "tests/cart.test.ts", status: "M", insertions: 8, deletions: 0 },
      ],
      sessions: ["s-priya-qty"],
    },
    {
      key: "c-validate",
      sha: "7d3e0a1b5c9f24e8a6d2b0c4f7e1a3d9b5c8f062",
      subject: "Validate discount codes on the server",
      body: "Codes are checked in src/server/discounts.ts and applied when POST /api/orders\nrecomputes the total. An unknown code is a 422 on the discountCode field.",
      author: "uzayer",
      when: { daysAgo: 1, at: "16:48" },
      files: [
        { path: "src/server/discounts.ts", status: "A", insertions: 27, deletions: 0 },
        { path: "src/server/orders.ts", status: "M", insertions: 9, deletions: 2 },
        { path: "tests/discounts.test.ts", status: "A", insertions: 41, deletions: 0 },
      ],
      sessions: ["s-server-discounts", "s-discount-tests"],
      rebasedFrom: "e01c9f3a7b5d28c4e6a0f2b8d4c1e7a3f5b9d0c6",
    },
    {
      key: "c-normalise",
      sha: "3f6b8d0a2c4e19f7b5d3a1c9e8f0b2d4a6c7e851",
      subject: "Make discount codes case-insensitive",
      author: "uzayer",
      when: { daysAgo: 0, at: "now-154" },
      files: [
        { path: "src/server/api.ts", status: "M", insertions: 3, deletions: 1 },
        { path: "tests/discounts.test.ts", status: "M", insertions: 7, deletions: 0 },
      ],
      sessions: ["s-normalise"],
    },
  ],

  // ── Comments on Sessions ────────────────────────────────────────────────
  comments: [
    // The full example: a resolved thread on the tool call that edits
    // `src/server/orders.ts` in Zuhayer's session (videos 3/4 "Show resolved").
    {
      id: "cm-email-1",
      session: "s-errors",
      anchor: { kind: "tool_call", step: "e-orders" },
      author: "uzayer",
      body: "Nice. Should we lower-case the email before we store it?",
      when: { daysAgo: 4, at: "15:02" },
      resolved: { by: "uzayer", when: { daysAgo: 4, at: "15:24" } },
    },
    {
      id: "cm-email-2",
      session: "s-errors",
      anchor: { kind: "tool_call", step: "e-orders" },
      author: "zuhayer",
      body: "Trim yes, lower-case no. Some mail servers care about case.",
      when: { daysAgo: 4, at: "15:19" },
      parent: "cm-email-1",
    },
    // TODO(content): Zuhayer · open question on your most recent Session (video 7 answers it with Atlas Agent) · s-normalise, step e-api. Keep it open (no `resolved`).
    {
      id: "cm-expired",
      session: "s-normalise",
      anchor: { kind: "tool_call", step: "e-api" },
      author: "zuhayer",
      body: "Did you check what happens with an expired code?",
      when: { daysAgo: 0, at: "now-40" },
    },
  ],

  // ── Team chat ───────────────────────────────────────────────────────────
  chat: [
    // TODO(content): #general · a couple of short, human messages from the first days (welcome, a link to the shop running locally) · uzayer, zuhayer
    {
      id: "m-gen-01",
      channel: "general",
      author: "uzayer",
      body: "Welcome to Northwind 👋 The shop repo is `northwind-shop`; `bun run dev` and it's on localhost:3000.",
      when: { daysAgo: 6, at: "17:40" },
    },
    {
      id: "m-gen-02",
      channel: "general",
      author: "zuhayer",
      body: "Running. Two Canvas Totes and I still pay shipping, by the way 😅",
      when: { daysAgo: 6, at: "17:52" },
      reactions: [["eyes", ["uzayer"]]],
    },

    // The full example thread: Zuhayer drops the stock Session into #shop as a
    // card, and the conversation that follows.
    {
      id: "m-shop-01",
      channel: "shop",
      author: "zuhayer",
      body: "Stock counts are in. Hoodie's set to 2 so we can see the low-stock label.",
      when: { daysAgo: 5, at: "11:58" },
      sessionRef: { session: "s-stock" },
      reactions: [["rocket", ["uzayer"]]],
    },
    {
      id: "m-shop-02",
      channel: "shop",
      author: "uzayer",
      body: "Nice. Does the server check stock again at checkout, or only when it goes in the cart?",
      when: { daysAgo: 5, at: "12:06" },
      replyTo: "m-shop-01",
    },
    {
      id: "m-shop-03",
      channel: "shop",
      author: "zuhayer",
      body: "Only at add-to-cart for now. Two people buying the last hoodie at once would both get it. Writing that down for later.",
      when: { daysAgo: 5, at: "12:09" },
      replyTo: "m-shop-02",
    },
    {
      id: "m-shop-04",
      channel: "shop",
      author: "uzayer",
      body: "Fine for now. Sold-out items should probably still show, just greyed out?",
      when: { daysAgo: 5, at: "12:11" },
    },
    {
      id: "m-shop-05",
      channel: "shop",
      author: "zuhayer",
      body: "Agreed. I'll start a draft for it here so we can both write the prompt.",
      when: { daysAgo: 5, at: "12:13" },
      reactions: [["thumbsUp", ["uzayer"]]],
    },
    // TODO(content): #shop · Zuhayer posts that "Sold out products" was sent to Claude Code (the sent draft's message), you react · uzayer, zuhayer
    {
      id: "m-shop-06",
      channel: "shop",
      author: "zuhayer",
      body: "Sent **Sold out products** to Claude Code.",
      when: { daysAgo: 3, at: "10:19" },
      draft: "d-soldout",
    },
    // TODO(content): #shop · a short exchange about the checkout errors change and the order details page (yesterday-ish), one with a checkpoint card for c-order-page · uzayer, zuhayer
    {
      id: "m-shop-07",
      channel: "shop",
      author: "zuhayer",
      body: "Order details page is up: the thank-you message links to it now.",
      when: { daysAgo: 2, at: "11:20" },
      sessionRef: { session: "s-order-page", checkpoint: "c-order-page" },
    },
    {
      id: "m-shop-08",
      channel: "shop",
      author: "uzayer",
      body: "Looks good. I'm doing the discount code field next.",
      when: { daysAgo: 2, at: "11:34" },
    },
  ],

  // ── Prompt drafts ───────────────────────────────────────────────────────
  drafts: [
    // The full example: written by two people, then sent by Zuhayer to Claude
    // Code (session `s-soldout`). Sent drafts are locked.
    {
      id: "d-soldout",
      channel: "shop",
      title: "Sold out products",
      createdBy: "zuhayer",
      created: { daysAgo: 5, at: "12:15" },
      updated: { daysAgo: 3, at: "10:18" },
      text: 'Products with a stock of 0 should show a "Sold out" badge on the product list, and their Add to cart button should be disabled with the label "Sold out". Don\'t hide them. Add a test that the API still lists sold-out products.\nPut sold-out products at the end of the Featured order.',
      sent: { by: "zuhayer", when: { daysAgo: 3, at: "10:19" }, message: "m-shop-06" },
    },
    // TODO(content): you · unsent draft for a receipt email, one planning line with open questions (which service? what goes in it?) · #shop
    {
      id: "d-receipt",
      channel: "shop",
      title: "Order confirmation email",
      createdBy: "uzayer",
      created: { daysAgo: 2, at: "17:05" },
      updated: { daysAgo: 2, at: "17:07" },
      text: "Plan: send a receipt email when an order is placed. Which service? What goes in it?",
    },
  ],

  // ── Scripted agent runs ─────────────────────────────────────────────────
  runs: [
    // The full example: video 1, beat 2. Claude Code adds the field live; the
    // edits are left uncommitted so the git panel can commit them on camera.
    {
      id: "run-discount-field",
      match: ["discount code field"],
      agent: "claude-code",
      // The run IS the `s-discount` Session, so Zuhayer's comment on its
      // checkout.ts edit lands on the same tool call in this chat.
      replay: "s-discount",
      beats: [],
      afterwards: "discountSession",
    },
    // TODO(content): video 1 beat 4 / video 7 beat 2 · Atlas Agent · "What is Zuhayer working on?": an org tool lists Zuhayer's recent sessions, the answer summarises them and flags the live one (s-live-tests)
    {
      id: "run-what-is-zuhayer",
      agent: "atlas-agent",
      // "What is @Zuhayer Masud working on?" — Zuhayer picked from the @ picker.
      match: ["zuhayer", "working on"],
      beats: [
        {
          kind: "tool",
          tool: "org",
          title: "List sessions by Zuhayer Masud",
          command: "org_list_sessions",
          args: { member: "Zuhayer Masud", project: "northwind-shop", since: "14 days" },
          result:
            "8 sessions · 1 live\n● Add tests for the cart and order helpers — Codex, live now\n  Walk me through how an order's total is computed — Codex, yesterday\n  Add an order details page — Codex, 2 days ago\n  Mark sold-out products — Claude Code, 3 days ago",
          ms: 1_100,
        },
        {
          kind: "text",
          text: "Zuhayer has one session **running right now**: *Add tests for the cart and order helpers* (Codex), adding tests for the uncovered exports in `cart.ts` and `orders.ts`.\n\nBefore that: the order details page at `/orders/:id`, sold-out badges on the product list, and stock tracking that refuses to oversell.",
        },
      ],
    },
    // TODO(content): video 7 beat 2 · Atlas Agent · "Open the live one and tell me what it's stuck on": reads s-live-tests and says where it is (not stuck: between cart and orders tests)
    {
      id: "run-open-live",
      agent: "atlas-agent",
      // "Open the live one (or @Add tests for the cart and order helpers) and tell me what it's stuck on".
      match: ["stuck on"],
      beats: [
        {
          kind: "tool",
          tool: "org",
          title: "Read session: Add tests for the cart and order helpers",
          command: "org_read_session",
          ms: 1_000,
        },
        {
          kind: "text",
          text: "It isn't stuck. The cart tests pass (9 of 9); it's now adding tests for `validateDetails` and `OrderBook` in `tests/orders.test.ts`.",
        },
      ],
    },
    // The full example of a scripted run: video 7 beat 3. Atlas Agent finds the
    // open comment, then asks before replying under your name (`replyToComment`).
    {
      id: "run-answer-comments",
      agent: "atlas-agent",
      match: ["open comments"],
      beats: [
        {
          kind: "tool",
          tool: "org",
          title: "List open comments on: Make discount codes case-insensitive",
          command: "org_list_comments",
          result:
            "1 open · Zuhayer Masud on Edit src/server/api.ts: “Did you check what happens with an expired code?”",
          ms: 900,
        },
        {
          kind: "approval",
          title: "Reply to Zuhayer Masud's comment",
          args: {
            to: "Zuhayer Masud",
            on: "Make discount codes case-insensitive · Edit src/server/api.ts",
            reply:
              "Codes don't expire yet: checkDiscount only knows valid or unknown. I'll add an expiry date per code and a test for an expired one.",
          },
          effect: "replyToComment",
          allowed: "Replied to Zuhayer's comment.",
          declined: "Okay, I won't reply.",
        },
      ],
    },
    // TODO(content): video 7 beat 4 · Atlas Agent · "Write a short report on my last session and post it to #shop": approval card with recipient #shop and the text; Allow posts it with a session card (effect postShopReport)
    {
      id: "run-report-shop",
      agent: "atlas-agent",
      // "Write a short report on @Make discount codes case-insensitive and post it to @shop".
      match: ["report", "shop"],
      beats: [
        {
          kind: "tool",
          tool: "org",
          title: "Read session: Make discount codes case-insensitive",
          command: "org_read_session",
          ms: 900,
        },
        {
          kind: "approval",
          title: "Post a message to #shop",
          args: {
            to: "#shop",
            message:
              "Discount codes are now case-insensitive: they're uppercased once in the orders route, so `northwind10` works. One open question from Zuhayer about expired codes, answered in the session.",
            session: "Make discount codes case-insensitive",
          },
          effect: "postShopReport",
          allowed: "Posted to #shop with the session attached.",
          declined: "Okay, nothing was posted.",
        },
      ],
    },
    // TODO(content): video 1 beat 5 · Atlas Agent · "Post my discount code session to #shop and ask Zuhayer to check the validation": approval card, Allow posts the s-discount card (effect postDiscountSession)
    {
      id: "run-post-discount",
      agent: "atlas-agent",
      // "Post @Add a discount code field to checkout to @shop and ask @Zuhayer Masud to check the validation".
      match: ["post", "discount code", "shop"],
      beats: [
        {
          kind: "approval",
          title: "Post a message to #shop",
          args: {
            to: "#shop",
            message: "Zuhayer, here's the discount code session. Can you check the validation?",
            session: "Add a discount code field to checkout",
          },
          effect: "postDiscountSession",
          allowed: "Posted to #shop with the session attached.",
          declined: "Okay, nothing was posted.",
        },
      ],
    },
    // TODO(content): video 4 beat 3 · Claude Code · the referenced comment + "do this": moves the code check so the server validates it too (short version of s-server-discounts)
    {
      id: "run-fix-from-comment",
      match: ["do this"],
      beats: [
        {
          kind: "tool",
          tool: "read",
          title: "Read src/server/orders.ts",
          path: "src/server/orders.ts",
        },
        {
          kind: "tool",
          tool: "write",
          title: "Write src/server/discounts.ts",
          path: "src/server/discounts.ts",
          diff: {
            after:
              '/** Percent off, by code. */\nconst CODES: Record<string, number> = { NORTHWIND10: 10, WELCOME5: 5 };\n\nexport function checkDiscount(code: string, subtotal: number): number {\n  const percent = CODES[code];\n  if (percent === undefined) throw new Error("That discount code isn\'t valid");\n  return Math.round((subtotal * percent) / 100);\n}',
          },
          ms: 1_200,
        },
        {
          kind: "text",
          text: "The server now checks the code itself when it places the order, so a code typed into the browser can't change the total on its own.",
        },
      ],
    },
    // TODO(content): video 5 beat 4 · Claude Code · "Move discount pricing to the server" sent from the draft: starts the work (reads, plans) — the take only needs it to start
    {
      id: "run-pricing-to-server",
      match: ["discount pricing"],
      beats: [
        {
          kind: "thinking",
          text: "The draft wants pricing on the server and the old endpoint kept working until mobile ships. Start with where the client computes the discount.",
        },
        {
          kind: "tool",
          tool: "grep",
          title: 'grep "DISCOUNT_CODES"',
          command: "DISCOUNT_CODES",
          result:
            "src/client/checkout.ts:12:const DISCOUNT_CODES: Record<string, number> = { NORTHWIND10: 10, WELCOME5: 5 };",
        },
        {
          kind: "text",
          text: "Plan: move the code table into `src/server/discounts.ts`, have `POST /api/orders` apply it, keep the old endpoint answering as before, and add tests for both.",
        },
      ],
    },
    // TODO(content): video 9 beat 1 · Claude Code · "add a README section on running the tests": one edit to README.md and a one-line answer
    {
      id: "run-readme-tests",
      match: ["readme section"],
      beats: [
        {
          kind: "tool",
          tool: "edit",
          title: "Edit README.md",
          path: "README.md",
          diff: {
            before: "## Scripts",
            after:
              "## Running the tests\n\n`bun test` runs the suite; `bun run check` runs the typecheck first.\n\n## Scripts",
          },
        },
        { kind: "text", text: "Added a **Running the tests** section to the README." },
      ],
    },
    // TODO(content): video 9 beat 3 · Codex · "what does the checkout module export?": reads src/client/checkout.ts, answers in two lines
    {
      id: "run-checkout-exports",
      match: ["checkout module export"],
      beats: [
        {
          kind: "tool",
          tool: "read",
          title: "Read src/client/checkout.ts",
          path: "src/client/checkout.ts",
        },
        {
          kind: "text",
          text: "Nothing: `src/client/checkout.ts` is a page script. It wires up the form and the summary when it loads, and imports `api` and `totalsHtml` from its neighbours.",
        },
      ],
    },
    // TODO(content): video 11 beat 1 · Claude Code · "/remember the discount code rule": calls the memory tool, confirms the decision was stored (afterwards: rememberDecision)
    {
      id: "run-remember",
      match: ["remember", "discount"],
      beats: [
        {
          kind: "tool",
          tool: "memory",
          title: "remember",
          command: "atlas_memory_remember",
          args: {
            kind: "decision",
            text: "Discount codes are case-insensitive: normalise them to uppercase once, at the API boundary (src/server/api.ts), not in the UI.",
          },
          result: "Stored as a decision.",
        },
        {
          kind: "text",
          text: "Remembered: discount codes are case-insensitive, normalised to uppercase once at the API boundary, not in the UI.",
        },
      ],
      afterwards: "rememberDecision",
    },
    // TODO(content): video 11 beat 3 · Codex or Atlas Agent · "Where should discount codes get normalised?": searches shared memory, finds the decision, answers from it
    {
      id: "run-where-normalise",
      match: ["normalised"],
      beats: [
        {
          kind: "tool",
          tool: "memory",
          title: "search memory",
          command: "atlas_memory_search",
          args: { query: "discount code normalise" },
          result:
            "decision · Claude Code · 0.92\nDiscount codes are case-insensitive: normalise them to uppercase once, at the API boundary (src/server/api.ts), not in the UI.",
        },
        {
          kind: "text",
          text: "At the API boundary: `src/server/api.ts` uppercases the code once in the orders route. That's a recorded decision from a Claude Code session, so the UI shouldn't normalise it again.",
        },
      ],
    },
  ],

  // ── Memory (video 11) ───────────────────────────────────────────────────
  // TODO(content): a handful more entries the agents picked up while working (plans, files, a failure), so the list isn't thin · northwind-shop
  memory: [
    {
      id: "mem-free-shipping",
      kind: "fact",
      text: "Free shipping applies to orders of $50.00 or more (FREE_SHIPPING_THRESHOLD in src/shared/pricing.ts). Prices are integer cents.",
      agent: "claude-code",
      session: "s-sort",
      confidence: 0.84,
      when: { daysAgo: 5, at: "10:10" },
      files: ["src/shared/pricing.ts"],
    },
    {
      id: "mem-server-totals",
      kind: "architecture",
      text: "The server recomputes every order total from the catalog in OrderBook.place (src/server/orders.ts); nothing the browser sends is trusted for prices.",
      agent: "codex",
      session: "s-total-walk",
      confidence: 0.9,
      when: { daysAgo: 1, at: "14:09" },
      files: ["src/server/orders.ts"],
    },
    {
      id: "mem-catalog-json",
      kind: "file",
      text: "The catalog lives in data/products.json and is loaded once at startup by src/server/catalog.ts.",
      agent: "claude-code",
      session: "s-catalog",
      confidence: 0.88,
      when: { daysAgo: 3, at: "13:52" },
      files: ["data/products.json", "src/server/catalog.ts"],
    },
  ],
  memoryOnRemember: {
    id: "mem-discount-case",
    kind: "decision",
    text: "Discount codes are case-insensitive: normalise them to uppercase once, at the API boundary (src/server/api.ts), not in the UI.",
    agent: "claude-code",
    session: "s-normalise",
    confidence: 0.92,
    when: { daysAgo: 0, at: "now-0" },
    files: ["src/server/api.ts"],
  },
  policies: [
    {
      policy: "Package manager",
      value: "Always use bun, never npm.",
      source: "CLAUDE.md",
      match: "exact",
    },
    {
      policy: "Branching",
      value: "Never commit directly to main.",
      source: "CLAUDE.md",
      match: "exact",
    },
    {
      policy: "Testing",
      value: "Run the tests before every commit.",
      source: "CLAUDE.md",
      match: "exact",
    },
  ],

  // ── Live cues ───────────────────────────────────────────────────────────
  cues: {
    zuhayerComment: {
      session: "s-discount",
      step: "e-checkout-ts",
      body: "<@usr_uzayer> Should this validate the code server-side?",
    },
    zuhayerMessage: {
      body: "server-side check is in",
      sessionRef: { session: "s-server-discounts", checkpoint: "c-validate" },
    },
    zuhayerShare: {
      body: "<@usr_uzayer> looking at the validation now.",
      sessionRef: { session: "s-discount" },
    },
    zuhayerDraftEdit: {
      draftTitle: "Move discount pricing to the server",
      text: "\nKeep the old endpoint working until the mobile app ships.\nAdd tests for a valid code, an invalid code and no code.",
    },
  },
};
