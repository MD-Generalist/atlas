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
          id: "r-404",
          min: 1,
          tool: "read",
          title: "Read src/client/index.html",
          path: "src/client/index.html",
          result:
            '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>Northwind Shop</title>\n    <link rel="stylesheet" href="styles.css" />\n  </head>\n  <body>\n    <main id="root"></main>\n    <script type="module" src="products.ts"></script>\n  </body>\n</html>',
        },
        {
          kind: "tool",
          id: "w-404",
          min: 1,
          tool: "write",
          title: "Write src/client/404.html",
          path: "src/client/404.html",
          diff: {
            after:
              '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>Not found — Northwind Shop</title>\n    <link rel="stylesheet" href="styles.css" />\n  </head>\n  <body>\n    <main class="center">\n      <h1>Page not found</h1>\n      <p>That path doesn\'t exist, but your <a href="/">products are here</a>.</p>\n    </main>\n  </body>\n</html>',
          },
          insertions: 12,
          result: "Created src/client/404.html.",
        },
        {
          kind: "tool",
          id: "e-server",
          min: 2,
          tool: "edit",
          title: "Edit server.ts",
          path: "server.ts",
          diff: {
            before:
              'if (req.url.startsWith("/api")) {\n  return new Response("Not found", { status: 404 });\n}',
            after:
              'if (req.url.startsWith("/api")) {\n  return new Response("Not found", { status: 404 });\n}\n\nconst notFound = await Bun.file("src/client/404.html").text();\nreturn new Response(notFound, { status: 404, headers: { "Content-Type": "text/html" } });',
          },
          insertions: 3,
          deletions: 1,
          result: "Applied 1 edit to server.ts.",
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
          diff: {
            before: '    "dev": "bun run --bun src/server/dev.ts",\n    "test": "vitest"',
            after:
              '    "dev": "bun run --bun src/server/dev.ts",\n    "check": "tsc --noEmit && bun test",\n    "test": "vitest"',
          },
          insertions: 1,
          result: "Applied 1 edit to package.json.",
        },
        {
          kind: "tool",
          id: "e-readme",
          min: 1,
          tool: "edit",
          title: "Edit README.md",
          path: "README.md",
          diff: {
            before: "## Scripts\n\n- `bun run dev`: start the server",
            after:
              "## Development\n\nRun `bun run check` before every commit (typecheck + tests).\n\n## Scripts\n\n- `bun run dev`: start the server",
          },
          insertions: 2,
          result: "Applied 1 edit to README.md.",
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
          result:
            'const products = await api.products();\nconst root = document.getElementById("root") as HTMLDivElement;\nroot.innerHTML = products.map((p) => `<div class="product">${p.name} — $${(p.price / 100).toFixed(2)}</div>`).join("");',
        },
        {
          kind: "tool",
          id: "e-html",
          min: 2,
          tool: "edit",
          title: "Edit src/client/index.html",
          path: "src/client/index.html",
          diff: {
            before: '    <main id="root"></main>',
            after:
              '    <main>\n      <select id="sort-control">\n        <option value="featured">Featured</option>\n        <option value="price-asc">Price: low to high</option>\n        <option value="price-desc">Price: high to low</option>\n      </select>\n      <div id="root"></div>\n    </main>',
          },
          insertions: 7,
          deletions: 1,
          result: "Applied 1 edit to src/client/index.html.",
        },
        {
          kind: "tool",
          id: "e-products",
          min: 3,
          tool: "edit",
          title: "Edit src/client/products.ts",
          path: "src/client/products.ts",
          diff: {
            before:
              'function render(items: Product[]) {\n  root.innerHTML = items.map((p) => `<div class="product">${p.name}...`).join("");\n}',
            after:
              'function sortProducts(items: Product[], by: string): Product[] {\n  if (by === "price-asc") return [...items].sort((a, b) => a.price - b.price);\n  if (by === "price-desc") return [...items].sort((a, b) => b.price - a.price);\n  return items;\n}\n\nfunction render(items: Product[]) {\n  const sortBy = (document.getElementById("sort-control") as HTMLSelectElement).value;\n  const sorted = sortProducts(items, sortBy);\n  root.innerHTML = sorted.map((p) => `<div class="product">${p.name}...`).join("");\n}',
          },
          insertions: 11,
          deletions: 3,
          result: "Applied 1 edit to src/client/products.ts.",
        },
        {
          kind: "tool",
          id: "e-listener",
          min: 4,
          tool: "edit",
          title: "Edit src/client/products.ts (event listener)",
          path: "src/client/products.ts",
          diff: {
            before: 'root.addEventListener("click", handleAddToCart);',
            after:
              'root.addEventListener("click", handleAddToCart);\ndocument.getElementById("sort-control")?.addEventListener("change", () => render(products));',
          },
          insertions: 2,
          deletions: 1,
          result: "Applied 1 edit to src/client/products.ts.",
        },
        {
          kind: "response",
          id: "resp1",
          min: 5,
          text: "Added the Sort by control. Featured keeps the catalog order, and the dropdown updates the list instantly.",
        },
        { kind: "checkpoint", id: "cp1", min: 6, commit: "c-sort" },
      ],
    },
    {
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
          diff: {
            before:
              'const PRODUCTS: Product[] = [\n  { id: 1, name: "Canvas Tote", price: 2899 },\n  { id: 2, name: "Harbor Hoodie", price: 6299 },\n  { id: 3, name: "Enamel Pin Set", price: 1499 },',
            after:
              'const PRODUCTS: Product[] = [\n  { id: 1, name: "Canvas Tote", price: 2899, stock: 25 },\n  { id: 2, name: "Harbor Hoodie", price: 6299, stock: 2 },\n  { id: 3, name: "Enamel Pin Set", price: 1499, stock: 0 },',
          },
          insertions: 7,
          deletions: 1,
          result: "Applied 1 edit to src/server/catalog.ts.",
        },
        {
          kind: "tool",
          id: "e-cart",
          min: 4,
          tool: "edit",
          title: "Edit src/server/cart.ts",
          path: "src/server/cart.ts",
          diff: {
            before:
              "export function addItem(cart: CartItem[], product: Product, qty: number): CartItem[] {\n  return [...cart, { product, quantity: qty }];\n}",
            after:
              "export function addItem(cart: CartItem[], product: Product, qty: number): CartItem[] {\n  if (qty > product.stock) throw new CartError(`Only ${product.stock} left in stock`, product.id);\n  const line = cart.find((c) => c.product.id === product.id);\n  if (line) return cart.map((c) => (c === line ? { ...c, quantity: c.quantity + qty } : c));\n  return [...cart, { product, quantity: qty }];\n}",
          },
          insertions: 9,
          deletions: 1,
          result: "Applied 1 edit to src/server/cart.ts.",
        },
        {
          kind: "tool",
          id: "e-products-stock",
          min: 5,
          tool: "edit",
          title: "Edit src/client/products.ts (stock label)",
          path: "src/client/products.ts",
          diff: {
            before:
              'const stockText = p.stock === 0 ? "" : p.stock <= 3 ? ` — Only ${p.stock} left` : "";',
            after:
              'const stockLabel = p.stock === 0 ? "" : p.stock <= 3 ? ` — Only ${p.stock} left` : "";',
          },
          insertions: 1,
          deletions: 1,
          result: "Applied 1 edit to src/client/products.ts.",
        },
        {
          kind: "tool",
          id: "b-test",
          min: 6,
          tool: "bash",
          title: "bun test",
          command: "bun test",
          result:
            "bun test v1.2.21\n\ntests/cart.test.ts:\n✓ addItem refuses oversell\n✓ addItem stacks quantities\n✓ summarize counts stock correctly\n…\n\n 24 pass\n 0 fail\n Ran 24 tests across 4 files. [156.00ms]",
        },
        {
          kind: "response",
          id: "resp1",
          min: 7,
          text: "Stock is tracked on the server and the cart refuses to oversell. Products show 'Only N left' when 3 or fewer are in stock.",
        },
        { kind: "checkpoint", id: "cp1", min: 8, commit: "c-stock" },
      ],
    },
    {
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
          id: "e-html",
          min: 1,
          tool: "edit",
          title: "Edit src/client/index.html",
          path: "src/client/index.html",
          diff: {
            before: '    <main>\n      <select id="sort-control">',
            after:
              '    <main>\n      <input id="search-box" type="search" placeholder="Search products..." autocomplete="off" />\n      <select id="sort-control">',
          },
          insertions: 1,
          deletions: 0,
          result: "Applied 1 edit to src/client/index.html.",
        },
        {
          kind: "tool",
          id: "e-products",
          min: 2,
          tool: "edit",
          title: "Edit src/client/products.ts",
          path: "src/client/products.ts",
          diff: {
            before:
              'function render(items: Product[]) {\n  const sortBy = (document.getElementById("sort-control") as HTMLSelectElement).value;\n  const sorted = sortProducts(items, sortBy);\n  root.innerHTML = items.length === 0 ? \'<p>No products.</p>\' : sorted.map(...).join("");\n}',
            after:
              'function filterProducts(items: Product[], query: string): Product[] {\n  const q = query.toLowerCase();\n  return items.filter((p) => p.name.toLowerCase().includes(q) || (p.description?.toLowerCase().includes(q) ?? false));\n}\n\nfunction render(items: Product[]) {\n  const query = (document.getElementById("search-box") as HTMLInputElement).value;\n  const filtered = filterProducts(items, query);\n  const sortBy = (document.getElementById("sort-control") as HTMLSelectElement).value;\n  const sorted = sortProducts(filtered, sortBy);\n  root.innerHTML = sorted.length === 0 ? \'<p>No products match.</p>\' : sorted.map(...).join("");\n}',
          },
          insertions: 12,
          deletions: 3,
          result: "Applied 1 edit to src/client/products.ts.",
        },
        {
          kind: "tool",
          id: "e-listener",
          min: 3,
          tool: "edit",
          title: "Edit src/client/products.ts (search listener)",
          path: "src/client/products.ts",
          diff: {
            before:
              'document.getElementById("sort-control")?.addEventListener("change", () => render(products));',
            after:
              'document.getElementById("sort-control")?.addEventListener("change", () => render(products));\ndocument.getElementById("search-box")?.addEventListener("input", () => render(products));',
          },
          insertions: 2,
          deletions: 1,
          result: "Applied 1 edit to src/client/products.ts.",
        },
        {
          kind: "response",
          id: "resp1",
          min: 4,
          text: "Search filters as you type and respects the sort. Type 'hoodie' and you'll see the Harbor Hoodie; type 'pin' and you'll see the Enamel Pin Set.",
        },
        { kind: "checkpoint", id: "cp1", min: 5, commit: "c-search" },
      ],
    },
    {
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
          result:
            'export function validateDetails(body: unknown): CheckoutDetails {\n  const data = body as Record<string, unknown>;\n  const read = (k: string) => (typeof data[k] === "string" ? data[k] : "").trim();\n  const details = { name: read("name"), email: read("email"), address: read("address") };\n  if (!details.name) throw new CheckoutError("Enter your name", "name");\n  if (!EMAIL.test(details.email)) throw new CheckoutError("Enter a valid email address", "email");\n  if (details.address.length < 10) throw new CheckoutError("Enter your full shipping address", "address");\n  return details;\n}',
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
              '  const details = { name: read("name"), email: read("email"), address: read("address") };\n  const fields: Record<string, string> = {};\n  if (!details.name) fields.name = "Enter your name";\n  if (!EMAIL.test(details.email)) fields.email = "Enter a valid email address";\n  if (details.address.length < 10) fields.address = "Enter your full shipping address";\n  if (Object.keys(fields).length > 0) throw new CheckoutError("Check the highlighted fields", fields);\n  return details;',
          },
          result: "Applied 1 edit to src/server/orders.ts.",
        },
        {
          kind: "tool",
          id: "e-checkout",
          min: 5,
          tool: "edit",
          title: "Edit src/client/checkout.ts",
          path: "src/client/checkout.ts",
          diff: {
            before:
              'form.addEventListener("submit", async (e) => {\n  const body = Object.fromEntries(new FormData(form));\n  const result = await api.placeOrder(body);\n  if (!result.ok) showError(result.error);\n});',
            after:
              'form.addEventListener("submit", async (e) => {\n  const body = Object.fromEntries(new FormData(form));\n  const result = await api.placeOrder(body);\n  if (!result.ok) {\n    const err = result.error as Record<string, string>;\n    Object.entries(err.fields || {}).forEach(([field, msg]) => {\n      const input = form.elements[field];\n      if (input) input.classList.add("error");\n      const label = form.querySelector(`label[for="${field}"]`);\n      if (label) label.setAttribute("aria-invalid", "true");\n    });\n    showError(err.error);\n  }\n});',
          },
          insertions: 12,
          deletions: 4,
          result: "Applied 1 edit to src/client/checkout.ts.",
        },
        {
          kind: "tool",
          id: "b-test",
          min: 6,
          tool: "bash",
          title: "bun test tests/orders.test.ts",
          command: "bun test tests/orders.test.ts",
          result:
            "bun test v1.2.21\n\ntests/orders.test.ts:\n✓ validateDetails checks all fields\n✓ placeOrder returns all errors at once\n…\n\n 12 pass\n 0 fail\n Ran 12 tests. [98.00ms]",
        },
        {
          kind: "response",
          id: "resp1",
          min: 6,
          text: "Every invalid field is reported at once, and each shows its own message under the input.",
        },
        { kind: "checkpoint", id: "cp1", min: 7, commit: "c-errors" },
      ],
    },
    {
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
          result:
            "Session: Show every checkout error at once · Zuhayer · 2 days ago · 7 min\nFiles: src/server/orders.ts, src/client/checkout.ts, tests/orders.test.ts\nChanges: collect all errors before throwing; mark fields client-side",
        },
        {
          kind: "response",
          id: "resp1",
          min: 2,
          text: "Good change. Collecting all field errors is UX-friendly: no need to fix and resubmit five times. One gap: no test covers all three fields invalid at once, so edge case behavior (field render order, CSS) isn't verified. Worth a follow-up test.",
        },
      ],
    },
    {
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
          id: "r-products",
          min: 1,
          tool: "read",
          title: "Read src/client/products.ts",
          path: "src/client/products.ts",
          result:
            "const products = await api.products();\n// Render with sortProducts and filterProducts ...\nconst addButton = button(p.name, () => api.addToCart(p.id, qty));",
        },
        {
          kind: "tool",
          id: "e-products",
          min: 2,
          tool: "edit",
          title: "Edit src/client/products.ts",
          path: "src/client/products.ts",
          diff: {
            before:
              'function sortProducts(items: Product[], by: string): Product[] {\n  if (by === "price-asc") return [...items].sort((a, b) => a.price - b.price);\n  if (by === "price-desc") return [...items].sort((a, b) => b.price - a.price);\n  return items;\n}',
            after:
              'function sortProducts(items: Product[], by: string): Product[] {\n  const featured = (a: Product, b: Product) => {\n    const aOut = a.stock === 0 ? 1 : 0;\n    const bOut = b.stock === 0 ? 1 : 0;\n    return aOut - bOut;\n  };\n  if (by === "price-asc") return [...items].sort((a, b) => featured(a, b) || (a.price - b.price));\n  if (by === "price-desc") return [...items].sort((a, b) => featured(a, b) || (b.price - a.price));\n  return [...items].sort(featured);\n}',
          },
          insertions: 11,
          deletions: 2,
          result: "Applied 1 edit to src/client/products.ts.",
        },
        {
          kind: "tool",
          id: "e-products-render",
          min: 3,
          tool: "edit",
          title: "Edit src/client/products.ts (render)",
          path: "src/client/products.ts",
          diff: {
            before:
              'const button = p.stock === 0 ? "Sold out" : `Add to cart (${qty})`;\nconst html = `<div class="product"><h3>${p.name}</h3><p>$${(p.price / 100).toFixed(2)}</p><button>${button}</button></div>`;',
            after:
              'const badge = p.stock === 0 ? \'<span class="badge">Sold out</span>\' : "";\nconst btn = p.stock === 0 ? "Sold out" : `Add to cart (${qty})`;\nconst disabled = p.stock === 0 ? "disabled" : "";\nconst html = `<div class="product">${badge}<h3>${p.name}</h3><p>$${(p.price / 100).toFixed(2)}</p><button ${disabled}>${btn}</button></div>`;',
          },
          insertions: 4,
          deletions: 2,
          result: "Applied 1 edit to src/client/products.ts.",
        },
        {
          kind: "tool",
          id: "e-css",
          min: 4,
          tool: "edit",
          title: "Edit src/client/styles.css",
          path: "src/client/styles.css",
          // ratchet-allow: demo content in mock scenario; not part of Atlas frontend
          diff: {
            before: ".product button { padding: 8px 16px; }",
            after:
              ".badge { display: inline-block; background: gray; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px; }\n.product button:disabled { opacity: 0.5; cursor: not-allowed; }",
          },
          insertions: 2,
          deletions: 0,
          result: "Applied 1 edit to src/client/styles.css.",
        },
        {
          kind: "tool",
          id: "e-test",
          min: 5,
          tool: "edit",
          title: "Edit tests/api.test.ts",
          path: "tests/api.test.ts",
          diff: {
            before: 'it("GET /api/products lists the catalog", async () => {',
            after:
              'it("GET /api/products includes sold-out items", async () => {\n  const res = await fetch("http://localhost:3000/api/products");\n  const products = await res.json();\n  const pinSet = products.find((p) => p.id === 3);\n  expect(pinSet.stock).toBe(0);\n});\n\nit("GET /api/products lists the catalog", async () => {',
          },
          insertions: 6,
          deletions: 0,
          result: "Applied 1 edit to tests/api.test.ts.",
        },
        {
          kind: "tool",
          id: "b-test",
          min: 5,
          tool: "bash",
          title: "bun test tests/api.test.ts",
          command: "bun test tests/api.test.ts",
          result: " 4 pass\n 0 fail",
        },
        {
          kind: "response",
          id: "resp1",
          min: 5,
          text: "Sold-out products show a 'Sold out' badge, their button is disabled, and they appear at the end of the Featured list. The API still lists them.",
        },
        { kind: "checkpoint", id: "cp1", min: 6, commit: "c-soldout" },
      ],
    },
    {
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
          id: "r-catalog",
          min: 1,
          tool: "read",
          title: "Read src/server/catalog.ts",
          path: "src/server/catalog.ts",
          result:
            'export interface Product { id: number; name: string; price: number; stock: number; }\nexport const PRODUCTS: Product[] = [\n  { id: 1, name: "Canvas Tote", price: 2899, stock: 25 },\n  { id: 2, name: "Harbor Hoodie", price: 6299, stock: 2 },\n  { id: 3, name: "Enamel Pin Set", price: 1499, stock: 0 },\n];',
        },
        {
          kind: "tool",
          id: "w-json",
          min: 2,
          tool: "write",
          title: "Write data/products.json",
          path: "data/products.json",
          diff: {
            after:
              '[\n  {\n    "id": 1,\n    "name": "Canvas Tote",\n    "price": 2899,\n    "stock": 25,\n    "description": "Durable canvas tote bag"\n  },\n  {\n    "id": 2,\n    "name": "Harbor Hoodie",\n    "price": 6299,\n    "stock": 2,\n    "description": "Cozy fleece hoodie"\n  },\n  {\n    "id": 3,\n    "name": "Enamel Pin Set",\n    "price": 1499,\n    "stock": 0,\n    "description": "Set of 3 enamel pins"\n  }\n]',
          },
          insertions: 22,
          result: "Created data/products.json.",
        },
        {
          kind: "tool",
          id: "e-catalog",
          min: 3,
          tool: "edit",
          title: "Edit src/server/catalog.ts",
          path: "src/server/catalog.ts",
          diff: {
            before:
              'export interface Product { id: number; name: string; price: number; stock: number; }\n\nexport const PRODUCTS: Product[] = [\n  { id: 1, name: "Canvas Tote", price: 2899, stock: 25 },\n  { id: 2, name: "Harbor Hoodie", price: 6299, stock: 2 },\n  { id: 3, name: "Enamel Pin Set", price: 1499, stock: 0 },\n];',
            after:
              'export interface Product { id: number; name: string; price: number; stock: number; }\n\nconst data = await Bun.file("data/products.json").json();\nexport const PRODUCTS: Product[] = data;',
          },
          insertions: 4,
          deletions: 11,
          result: "Applied 1 edit to src/server/catalog.ts.",
        },
        {
          kind: "tool",
          id: "b-check",
          min: 5,
          tool: "bash",
          title: "bun run check",
          command: "bun run check",
          result:
            "$ tsc --noEmit\n$ bun test\nbun test v1.2.21\n 28 pass\n 0 fail\n Ran 28 tests across 4 files. [169.00ms]",
        },
        {
          kind: "response",
          id: "resp1",
          min: 6,
          text: "The catalog now loads from data/products.json at startup. PRODUCTS and findProduct are unchanged; tests all pass.",
        },
        { kind: "checkpoint", id: "cp1", min: 7, commit: "c-catalog" },
      ],
    },
    {
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
          id: "w-order-html",
          min: 1,
          tool: "write",
          title: "Write src/client/order.html",
          path: "src/client/order.html",
          diff: {
            after:
              '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>Order — Northwind Shop</title>\n    <link rel="stylesheet" href="styles.css" />\n  </head>\n  <body>\n    <main>\n      <div id="root"></div>\n    </main>\n    <script type="module" src="order.ts"></script>\n  </body>\n</html>',
          },
          insertions: 13,
        },
        {
          kind: "tool",
          id: "w-order",
          min: 2,
          tool: "write",
          title: "Write src/client/order.ts",
          path: "src/client/order.ts",
          diff: {
            after:
              'import { api } from "./api.ts";\n\nconst id = new URLSearchParams(location.search).get("id") || "";\nconst root = document.getElementById("root") as HTMLDivElement;\n\nif (!id) {\n  root.innerHTML = "<p>Order not found</p>";\n} else {\n  const order = await api.getOrder(id);\n  if (!order) {\n    root.innerHTML = "<p>Order not found</p>";\n  } else {\n    const lines = order.items.map((item) => `<tr><td>${item.name}</td><td>${item.quantity}</td><td>$${(item.price / 100).toFixed(2)}</td></tr>`).join("");\n    root.innerHTML = `\n      <h1>Order #${order.id}</h1>\n      <p>Placed: ${new Date(order.createdAt).toLocaleDateString()}</p>\n      <table>\n        <tr><th>Product</th><th>Qty</th><th>Price</th></tr>\n        ${lines}\n      </table>\n      <dl class="totals">\n        <dt>Subtotal</dt><dd>$${(order.subtotal / 100).toFixed(2)}</dd>\n        <dt>Shipping</dt><dd>$${(order.shipping / 100).toFixed(2)}</dd>\n        <dt>Total</dt><dd>$${(order.total / 100).toFixed(2)}</dd>\n      </dl>\n      <p><a href="/">Back to products</a></p>\n    `;\n  }\n}',
          },
          insertions: 30,
        },
        {
          kind: "tool",
          id: "e-server",
          min: 3,
          tool: "edit",
          title: "Edit server.ts",
          path: "server.ts",
          diff: {
            before: 'serveFile(req, "src/client/checkout.html");',
            after:
              'serveFile(req, "src/client/checkout.html");\n    if (req.url.startsWith("/orders/")) return serveFile(req, "src/client/order.html");',
          },
          insertions: 2,
          deletions: 0,
          result: "Applied 1 edit to server.ts.",
        },
        {
          kind: "tool",
          id: "e-checkout-link",
          min: 4,
          tool: "edit",
          title: "Edit src/client/checkout.ts",
          path: "src/client/checkout.ts",
          diff: {
            before: "root.innerHTML = `<p>Order placed: #${order.id}</p>`;",
            after:
              'root.innerHTML = `<p>Order placed: <a href="/orders/?id=${order.id}">#${order.id}</a></p>`;',
          },
          insertions: 1,
          deletions: 1,
          result: "Applied 1 edit to src/client/checkout.ts.",
        },
        {
          kind: "response",
          id: "resp1",
          min: 5,
          text: "Added /orders/:id to show order details. The thank-you message now links to the order.",
        },
        { kind: "checkpoint", id: "cp1", min: 6, commit: "c-order-page" },
      ],
    },
    {
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
          diff: {
            before:
              '  const fields: Record<string, string> = {};\n  if (!details.name) fields.name = "Enter your name";\n  if (!EMAIL.test(details.email)) fields.email = "Enter a valid email address";\n  if (details.address.length < 10) fields.address = "Enter your full shipping address";',
            after:
              '  const fields: Record<string, string> = {};\n  if (!details.name) fields.name = "Enter your name";\n  if (details.name.length > 100) fields.name = "Name must be 100 characters or fewer";\n  if (!EMAIL.test(details.email)) fields.email = "Enter a valid email address";\n  if (details.email.length > 254) fields.email = "Email must be 254 characters or fewer";\n  if (details.address.length < 10) fields.address = "Enter your full shipping address";\n  if (details.address.length > 300) fields.address = "Address must be 300 characters or fewer";',
          },
          insertions: 8,
          deletions: 1,
          result: "Applied 1 edit to src/server/orders.ts.",
        },
        {
          kind: "tool",
          id: "e-tests",
          min: 3,
          tool: "edit",
          title: "Edit tests/orders.test.ts",
          path: "tests/orders.test.ts",
          diff: {
            before: 'it("throws on invalid email", () => {',
            after:
              'it("throws on name too long", () => {\n  const tooLong = "a".repeat(101);\n  expect(() => validateDetails({ name: tooLong, email: "a@b.com", address: "123 Main St" })).toThrow();\n});\n\nit("throws on invalid email", () => {',
          },
          insertions: 5,
          deletions: 1,
          result: "Applied 1 edit to tests/orders.test.ts.",
        },
        {
          kind: "tool",
          id: "b-test",
          min: 4,
          tool: "bash",
          title: "bun test tests/orders.test.ts",
          command: "bun test tests/orders.test.ts",
          result: " 14 pass\n 0 fail",
        },
        {
          kind: "response",
          id: "resp1",
          min: 4,
          text: "Each field is capped on the server with its own error message. Tests pass.",
        },
        { kind: "checkpoint", id: "cp1", min: 5, commit: "c-lengths" },
      ],
    },
    {
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
          diff: {
            before:
              "export function setQuantity(cart: CartItem[], productId: number, qty: number): CartItem[] {\n  return cart.map((c) => (c.product.id === productId ? { ...c, quantity: qty } : c));\n}",
            after:
              "export function setQuantity(cart: CartItem[], productId: number, qty: number): CartItem[] {\n  const MAX_QTY = 10;\n  if (qty > MAX_QTY) throw new CartError(`Max ${MAX_QTY} per product`, productId);\n  return cart.map((c) => (c.product.id === productId ? { ...c, quantity: qty } : c));\n}",
          },
          insertions: 5,
          deletions: 1,
          result: "Applied 1 edit to src/server/cart.ts.",
        },
        {
          kind: "tool",
          id: "e-client",
          min: 3,
          tool: "edit",
          title: "Edit src/client/cart.ts",
          path: "src/client/cart.ts",
          diff: {
            before:
              'const qtyInput = item.querySelector("input[type=number]") as HTMLInputElement;\nqtyInput.value = String(line.quantity);',
            after:
              'const qtyInput = item.querySelector("input[type=number]") as HTMLInputElement;\nqtyInput.value = String(line.quantity);\nqtyInput.max = "10";',
          },
          insertions: 2,
          deletions: 1,
          result: "Applied 1 edit to src/client/cart.ts.",
        },
        {
          kind: "tool",
          id: "e-test-priya",
          min: 4,
          tool: "edit",
          title: "Edit tests/cart.test.ts",
          path: "tests/cart.test.ts",
          diff: {
            before: 'it("setQuantity updates a line", () => {',
            after:
              'it("setQuantity refuses over 10", () => {\n  const items = [{ product: PRODUCT, quantity: 1 }];\n  expect(() => setQuantity(items, PRODUCT.id, 11)).toThrow("Max 10");\n});\n\nit("setQuantity updates a line", () => {',
          },
          insertions: 4,
          deletions: 1,
          result: "Applied 1 edit to tests/cart.test.ts.",
        },
        {
          kind: "tool",
          id: "b-test-priya",
          min: 4,
          tool: "bash",
          title: "bun test tests/cart.test.ts",
          command: "bun test tests/cart.test.ts",
          result: " 10 pass\n 0 fail",
        },
        {
          kind: "response",
          id: "resp1",
          min: 5,
          text: "Cart lines are capped at 10 on both sides.",
        },
        { kind: "checkpoint", id: "cp1", min: 5, commit: "c-priya-qty" },
      ],
    },
    DISCOUNT_SESSION,
    {
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
            "const DISCOUNT_CODES: Record<string, number> = { NORTHWIND10: 10, WELCOME5: 5 };\n\nfunction applyDiscount(code: string, subtotal: number): number {\n  const percent = DISCOUNT_CODES[code.trim()];\n  if (!percent) return 0;\n  return Math.round((subtotal * percent) / 100);\n}",
        },
        {
          kind: "tool",
          id: "r-summary",
          min: 1,
          tool: "read",
          title: "Read src/client/summary.ts",
          path: "src/client/summary.ts",
          result:
            'export function totalsHtml(summary: CartSummary, discount = 0): string {\n  return `\n    <dl class="totals">\n      <dt>Subtotal</dt><dd>${formatCents(summary.subtotal)}</dd>\n      ${discount ? `<dt>Discount</dt><dd>−${formatCents(discount)}</dd>` : ""}\n      <dt>Shipping</dt>...',
        },
        {
          kind: "tool",
          id: "r-orders",
          min: 2,
          tool: "read",
          title: "Read src/server/orders.ts",
          path: "src/server/orders.ts",
          result:
            'export class OrderBook {\n  place(cart: CartItem[], details: CheckoutDetails): Order {\n    const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);\n    const discount = checkDiscount(details.discountCode || "", subtotal);\n    const shipping = subtotal - discount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;\n    return { id, subtotal, discount, shipping, total: subtotal - discount + shipping };\n  }\n}',
        },
        {
          kind: "response",
          id: "resp1",
          min: 3,
          text: "The client shows the subtotal and lets you enter a discount code (NORTHWIND10 or WELCOME5, client-side only for now). When you place an order, the server recomputes the subtotal from the cart, applies the discount if valid, adds shipping (free over $50), and returns the total.",
        },
      ],
    },
    {
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
          diff: {
            after:
              "/** Percent off, by code. */\nconst CODES: Record<string, number> = { NORTHWIND10: 10, WELCOME5: 5 };\n\nexport class DiscountError extends Error {\n  constructor(public code: string) {\n    super(`That code isn't valid`);\n  }\n}\n\nexport function checkDiscount(code: string, subtotal: number): number {\n  if (!code) return 0;\n  const percent = CODES[code];\n  if (percent === undefined) throw new DiscountError(code);\n  return Math.round((subtotal * percent) / 100);\n}",
          },
          insertions: 15,
          result: "Created src/server/discounts.ts.",
        },
        {
          kind: "tool",
          id: "e-orders",
          min: 4,
          tool: "edit",
          title: "Edit src/server/orders.ts",
          path: "src/server/orders.ts",
          diff: {
            before:
              "export class OrderBook {\n  place(cart: CartItem[], details: CheckoutDetails): Order {\n    const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);\n    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;\n    return { id, subtotal, shipping, total: subtotal + shipping };\n  }\n}",
            after:
              'import { checkDiscount } from "./discounts.ts";\n\nexport class OrderBook {\n  place(cart: CartItem[], details: CheckoutDetails & { discountCode?: string }): Order {\n    const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);\n    const discount = checkDiscount(details.discountCode || "", subtotal);\n    const shipping = subtotal - discount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;\n    return { id, subtotal, discount, shipping, total: subtotal - discount + shipping };\n  }\n}',
          },
          insertions: 9,
          deletions: 2,
          result: "Applied 1 edit to src/server/orders.ts.",
        },
        {
          kind: "tool",
          id: "b-compile",
          min: 6,
          tool: "bash",
          title: "bun run typecheck",
          command: "bun run typecheck",
          result: "$ tsc --noEmit",
        },
        {
          kind: "response",
          id: "resp1",
          min: 7,
          text: "Discount codes are now checked and applied on the server. An unknown code returns 422 with the field error.",
        },
        { kind: "checkpoint", id: "cp1", min: 8, commit: "c-validate" },
      ],
    },
    {
      id: "s-discount-tests",
      afterVideo1: true,
      title: "Write tests for discount validation",
      author: "zuhayer",
      agent: "codex",
      model: "gpt-5",
      started: { daysAgo: 1, at: "16:41" },
      durationMin: 5,
      branch: "server-discounts",
      tokens: { input: 26_300, output: 5_400, cacheRead: 97_000, cacheWrite: 0 },
      costUsd: 0.44,
      brief:
        "Zuhayer · Codex · tests/discounts.test.ts covering checkDiscount and POST /api/orders with a valid code, an invalid code and no code · tests/discounts.test.ts",
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
          diff: {
            after:
              'import { describe, it, expect } from "bun:test";\nimport { checkDiscount } from "../src/server/discounts";\nimport { placeOrder } from "../src/server/api";\n\ndescribe("checkDiscount", () => {\n  it("applies valid code", () => {\n    const discount = checkDiscount("NORTHWIND10", 10000);\n    expect(discount).toBe(1000);\n  });\n\n  it("throws on invalid code", () => {\n    expect(() => checkDiscount("BADCODE", 10000)).toThrow();\n  });\n\n  it("returns 0 for no code", () => {\n    const discount = checkDiscount("", 10000);\n    expect(discount).toBe(0);\n  });\n});\n\ndescribe("POST /api/orders with discount", () => {\n  it("applies a valid code", async () => {\n    const res = await fetch("http://localhost:3000/api/orders", {\n      method: "POST",\n      body: JSON.stringify({ name: "Test", email: "test@test.com", address: "123 Main St", discountCode: "NORTHWIND10" }),\n    });\n    const order = await res.json();\n    expect(order.discount).toBe(Math.round((order.subtotal * 10) / 100));\n  });\n\n  it("rejects invalid code", async () => {\n    const res = await fetch("http://localhost:3000/api/orders", {\n      method: "POST",\n      body: JSON.stringify({ name: "Test", email: "test@test.com", address: "123 Main St", discountCode: "BADCODE" }),\n    });\n    expect(res.status).toBe(422);\n  });\n});',
          },
          insertions: 41,
          result: "Created tests/discounts.test.ts.",
        },
        {
          kind: "tool",
          id: "b-test",
          min: 3,
          tool: "bash",
          title: "bun test tests/discounts.test.ts",
          command: "bun test tests/discounts.test.ts",
          result:
            "bun test v1.2.21\n\ntests/discounts.test.ts:\n✓ applies valid code\n✓ throws on invalid code\n✓ returns 0 for no code\n✓ POST /api/orders applies a valid code\n✓ POST /api/orders rejects invalid code\n\n 5 pass\n 0 fail",
        },
        {
          kind: "response",
          id: "resp1",
          min: 4,
          text: "Tests for discount codes pass: valid codes apply, invalid codes throw, and the API endpoint rejects bad codes.",
        },
        { kind: "checkpoint", id: "cp1", min: 5, commit: "c-validate" },
      ],
    },
    {
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
          id: "r-api",
          min: 1,
          tool: "read",
          title: "Read src/server/api.ts",
          path: "src/server/api.ts",
          result:
            "POST /api/orders\n  const order = orders.place(carts.get(cartId), await req.json());",
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
          insertions: 3,
          deletions: 1,
          result: "Applied 1 edit to src/server/api.ts.",
        },
        {
          kind: "tool",
          id: "e-tests-normalise",
          min: 3,
          tool: "edit",
          title: "Edit tests/discounts.test.ts",
          path: "tests/discounts.test.ts",
          diff: {
            before: '  it("returns 0 for no code", () => {',
            after:
              '  it("is case-insensitive", () => {\n    const discount = checkDiscount("northwind10", 10000);\n    expect(discount).toBe(1000);\n  });\n\n  it("returns 0 for no code", () => {',
          },
          insertions: 5,
          deletions: 1,
          result: "Applied 1 edit to tests/discounts.test.ts.",
        },
        {
          kind: "tool",
          id: "b-test",
          min: 4,
          tool: "bash",
          title: "bun test",
          command: "bun test",
          result: "bun test v1.2.21\n\n 29 pass\n 0 fail\n Ran 29 tests across 5 files. [175.00ms]",
        },
        {
          kind: "response",
          id: "resp1",
          min: 5,
          text: "Codes are uppercased once at the API boundary, so `northwind10` and `NORTHWIND10` both work.",
        },
        { kind: "checkpoint", id: "cp1", min: 6, commit: "c-normalise" },
      ],
    },
    {
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
          result:
            "export class CartError extends Error {\n  constructor(public message: string, public productId: number) {\n    super(message);\n  }\n}\n\nexport class CartStore { ... }\nexport function addItem(...) { ... }\nexport function setQuantity(...) { ... }\nexport function summarize(...) { ... }",
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
            result:
              "import { describe, it, expect } from 'bun:test';\nimport { CartStore, addItem, setQuantity, summarize } from '../src/server/cart';\n\ndescribe('CartStore', () => {\n  it('init creates an empty cart', () => {\n    const store = new CartStore();\n    expect(store.get('xyz').length).toBe(0);\n  });\n});\n\ndescribe('addItem', () => {\n  it('adds a new item', () => { ... });\n  it('stacks quantities', () => { ... });\n});\n\ndescribe('setQuantity', () => {\n  // No test for setQuantity with 0\n});\n// CartStore.clear() untested",
          },
          {
            kind: "response",
            id: "resp1",
            min: 3,
            text: "`setQuantity` and `CartStore.clear()` have no tests yet. Let me add them and then move to orders.",
          },
          {
            kind: "tool",
            id: "e-cart-tests",
            min: 4,
            tool: "edit",
            title: "Edit tests/cart.test.ts",
            path: "tests/cart.test.ts",
            diff: {
              before: "describe('setQuantity', () => {\n  // TODO: test setQuantity with 0\n});",
              after:
                "describe('setQuantity', () => {\n  it('updates quantity', () => {\n    const cart = [{ product: PRODUCT, quantity: 2 }];\n    const updated = setQuantity(cart, PRODUCT.id, 5);\n    expect(updated[0].quantity).toBe(5);\n  });\n\n  it('clears with quantity 0', () => {\n    const cart = [{ product: PRODUCT, quantity: 2 }];\n    const updated = setQuantity(cart, PRODUCT.id, 0);\n    expect(updated.length).toBe(0);\n  });\n});\n\ndescribe('CartStore.clear', () => {\n  it('clears the cart', () => {\n    const store = new CartStore();\n    store.add('id1', PRODUCT, 1);\n    store.clear('id1');\n    expect(store.get('id1').length).toBe(0);\n  });\n});",
            },
            insertions: 18,
            deletions: 2,
            result: "Applied 1 edit to tests/cart.test.ts.",
          },
          {
            kind: "tool",
            id: "b-test",
            min: 5,
            tool: "bash",
            title: "bun test tests/cart.test.ts",
            command: "bun test tests/cart.test.ts",
            result:
              "bun test v1.2.21\n\ntests/cart.test.ts:\n✓ init creates an empty cart\n✓ addItem adds a new item\n✓ addItem stacks quantities\n✓ setQuantity updates quantity\n✓ setQuantity clears with quantity 0\n✓ CartStore.clear clears the cart\n✓ summarize computes totals\n✓ refuse oversell\n✓ refuse max qty\n✓ CartStore.clear works\n\n 10 pass\n 0 fail",
          },
          {
            kind: "response",
            id: "resp2",
            min: 5,
            text: "Cart tests all pass. Now adding the missing orders tests.",
          },
          {
            kind: "tool",
            id: "e-orders-tests",
            min: 6,
            tool: "edit",
            title: "Edit tests/orders.test.ts",
            path: "tests/orders.test.ts",
            diff: {
              before: "describe('OrderBook', () => {\n  // Tests for place, restore\n});",
              after:
                "describe('OrderBook', () => {\n  it('place creates an order', () => {\n    const book = new OrderBook();\n    const order = book.place([{ product: PRODUCT, quantity: 1 }], DETAILS);\n    expect(order.id).toBeTruthy();\n    expect(order.total).toBeGreaterThan(0);\n  });\n\n  it('place applies discount', () => {\n    const book = new OrderBook();\n    const order = book.place([{ product: PRODUCT, quantity: 1 }], { ...DETAILS, discountCode: 'NORTHWIND10' });\n    expect(order.discount).toBeGreaterThan(0);\n  });\n\n  it('restore retrieves an order', () => {\n    const book = new OrderBook();\n    const order1 = book.place([{ product: PRODUCT, quantity: 1 }], DETAILS);\n    const order2 = book.restore(order1.id);\n    expect(order2?.id).toBe(order1.id);\n  });\n});",
            },
            insertions: 18,
            deletions: 1,
            result: "Applied 1 edit to tests/orders.test.ts.",
          },
          {
            kind: "tool",
            id: "b-test-orders",
            min: 7,
            tool: "bash",
            title: "bun test tests/orders.test.ts",
            command: "bun test tests/orders.test.ts",
            result:
              "bun test v1.2.21\n\ntests/orders.test.ts:\n✓ validateDetails checks all fields\n✓ validateDetails name required\n✓ validateDetails email required\n✓ validateDetails address required\n✓ validateDetails throws on name too long\n✓ place creates an order\n✓ place applies discount\n✓ restore retrieves an order\n\n 8 pass\n 0 fail",
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
    {
      id: "m-gen-01",
      channel: "general",
      author: "uzayer",
      body: "Welcome to Northwind. The shop repo is `northwind-shop`; run `bun run dev` and it's on localhost:3000.",
      when: { daysAgo: 6, at: "17:40" },
    },
    {
      id: "m-gen-02",
      channel: "general",
      author: "zuhayer",
      body: "Running. Two Canvas Totes and shipping still costs $5—the threshold might be higher.",
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
    {
      id: "m-shop-06",
      channel: "shop",
      author: "zuhayer",
      body: "Sent **Sold out products** to Claude Code.",
      when: { daysAgo: 3, at: "10:19" },
      draft: "d-soldout",
      reactions: [["thumbsUp", ["uzayer"]]],
    },
    {
      id: "m-shop-07",
      channel: "shop",
      author: "zuhayer",
      body: "Order details page is up. /orders/:id shows the number, date, lines and totals. The thank-you message links to it.",
      when: { daysAgo: 2, at: "11:20" },
      sessionRef: { session: "s-order-page", checkpoint: "c-order-page" },
    },
    {
      id: "m-shop-08",
      channel: "shop",
      author: "uzayer",
      body: "Nice. I'm doing the discount code field next—adding it to checkout.",
      when: { daysAgo: 2, at: "11:34" },
      replyTo: "m-shop-07",
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
    {
      id: "d-receipt",
      channel: "shop",
      title: "Order confirmation email",
      createdBy: "uzayer",
      created: { daysAgo: 2, at: "17:05" },
      updated: { daysAgo: 2, at: "17:07" },
      text: "Send a confirmation email after checkout succeeds. Questions: which service (SendGrid, Mailgun, etc)? Does it go in a job queue or synchronously? What fields: order number, items, total, tracking link?",
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
    {
      id: "run-what-is-zuhayer",
      agent: "atlas-agent",
      match: ["zuhayer", "working on"],
      beats: [
        {
          kind: "tool",
          tool: "org",
          title: "List sessions by Zuhayer Masud",
          command: "org_list_sessions",
          args: { member: "Zuhayer Masud", project: "northwind-shop", since: "7 days" },
          result:
            "6 sessions · 1 live\n● Add tests for the cart and order helpers — Codex, live now\n  Write tests for discount validation — Codex, yesterday\n  Add an order details page — Codex, 2 days ago\n  Mark sold-out products — Claude Code, 3 days ago",
        },
        {
          kind: "text",
          text: "Zuhayer has one **live session** right now: *Add tests for the cart and order helpers* (Codex). He's adding test coverage for the cart and order helpers that the API relies on. Before that he wrote the discount test suite and built the order details page.",
        },
      ],
    },
    {
      id: "run-open-live",
      agent: "atlas-agent",
      match: ["stuck on", "live one"],
      beats: [
        {
          kind: "tool",
          tool: "org",
          title: "Read session: Add tests for the cart and order helpers",
          command: "org_read_session",
        },
        {
          kind: "text",
          text: "Not stuck. Cart tests are passing (10 of 10); now adding the missing tests for `validateDetails`, `place` and `restore` in orders. Should finish in under a minute.",
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
    {
      id: "run-report-shop",
      agent: "atlas-agent",
      match: ["report", "shop"],
      beats: [
        {
          kind: "tool",
          tool: "org",
          title: "Read session: Make discount codes case-insensitive",
          command: "org_read_session",
        },
        {
          kind: "approval",
          title: "Post a message to #shop",
          args: {
            to: "#shop",
            message:
              "Discount codes are now case-insensitive—uppercased once at the API boundary in `src/server/api.ts`. So `northwind10` and `NORTHWIND10` both work. Zuhayer asked about expired codes; the session answers it.",
            session: "Make discount codes case-insensitive",
          },
          effect: "postShopReport",
          allowed: "Posted to #shop with the session attached.",
          declined: "Okay, nothing was posted.",
        },
      ],
    },
    {
      id: "run-post-discount",
      agent: "atlas-agent",
      match: ["post", "discount code", "shop"],
      beats: [
        {
          kind: "approval",
          title: "Post a message to #shop",
          args: {
            to: "#shop",
            message:
              "Discount code field is ready. Zuhayer, can you check that the validation works?",
            session: "Add a discount code field to checkout",
          },
          effect: "postDiscountSession",
          allowed: "Posted to #shop with the session attached.",
          declined: "Okay, nothing was posted.",
        },
      ],
    },
    {
      id: "run-fix-from-comment",
      agent: "claude-code",
      match: ["do this"],
      beats: [
        {
          kind: "tool",
          tool: "read",
          title: "Read src/server/orders.ts",
          path: "src/server/orders.ts",
          result:
            "export function validateDetails(body: unknown): CheckoutDetails {\n  ...\n  const discount = checkDiscount(details.discountCode || '', subtotal);\n  ...\n}",
        },
        {
          kind: "tool",
          tool: "write",
          title: "Write src/server/discounts.ts",
          path: "src/server/discounts.ts",
          diff: {
            after:
              'const CODES: Record<string, number> = { NORTHWIND10: 10, WELCOME5: 5 };\n\nexport function checkDiscount(code: string, subtotal: number): number {\n  if (!code) return 0;\n  const percent = CODES[code];\n  if (percent === undefined) throw new Error("That discount code isn\'t valid");\n  return Math.round((subtotal * percent) / 100);\n}',
          },
        },
        {
          kind: "text",
          text: "Server validates discount codes now, so a code typed into the browser can't override the computed total.",
        },
      ],
    },
    {
      id: "run-pricing-to-server",
      agent: "claude-code",
      match: ["discount pricing", "server"],
      beats: [
        {
          kind: "thinking",
          text: "The draft is asking to move discount pricing logic to the server. Check where it's currently client-only.",
        },
        {
          kind: "tool",
          tool: "grep",
          title: 'grep "DISCOUNT_CODES"',
          command: "DISCOUNT_CODES",
          result:
            "src/client/checkout.ts:12:const DISCOUNT_CODES: Record<string, number> = { NORTHWIND10: 10, WELCOME5: 5 };\nsrc/server/discounts.ts:3:const CODES: Record<string, number> = { NORTHWIND10: 10, WELCOME5: 5 };",
        },
        {
          kind: "text",
          text: "Plan: move the client discount table out, keep `src/server/discounts.ts` as the single source of truth, update the API to send discount back to the client, keep the old client-side discount for backward compat until mobile ships.",
        },
      ],
    },
    {
      id: "run-readme-tests",
      agent: "claude-code",
      match: ["readme", "tests"],
      beats: [
        {
          kind: "tool",
          tool: "edit",
          title: "Edit README.md",
          path: "README.md",
          diff: {
            before: "## Scripts",
            after:
              "## Running the tests\n\n`bun test` runs the vitest suite. `bun run check` runs typecheck and tests together.\n\n## Scripts",
          },
        },
        {
          kind: "text",
          text: "Added a **Running the tests** section.",
        },
      ],
    },
    {
      id: "run-checkout-exports",
      agent: "codex",
      match: ["checkout", "export"],
      beats: [
        {
          kind: "tool",
          tool: "read",
          title: "Read src/client/checkout.ts",
          path: "src/client/checkout.ts",
          result:
            'import { api } from "./api";\nimport { totalsHtml } from "./summary";\n\nconst form = document.getElementById("checkout-form") as HTMLFormElement;\n...\n// Page script; no exports',
        },
        {
          kind: "text",
          text: "Nothing: `checkout.ts` is a page script. It loads the cart, wires the form, and imports `api` and `totalsHtml` from neighbors. No exports.",
        },
      ],
    },
    {
      id: "run-remember",
      agent: "claude-code",
      match: ["remember", "discount"],
      beats: [
        {
          kind: "tool",
          tool: "memory",
          title: "remember",
          command: "atlas_memory_remember",
          args: {
            kind: "decision",
            text: "Discount codes are case-insensitive: normalise to uppercase once at the API boundary (src/server/api.ts), not in the UI.",
          },
          result: "Stored.",
        },
        {
          kind: "text",
          text: "Stored: discount codes are uppercased once at the API boundary in src/server/api.ts.",
        },
      ],
      afterwards: "rememberDecision",
    },
    {
      id: "run-where-normalise",
      agent: "codex",
      match: ["normalise", "discount"],
      beats: [
        {
          kind: "tool",
          tool: "memory",
          title: "search memory",
          command: "atlas_memory_search",
          args: { query: "discount normalise case" },
          result:
            "decision · Claude Code · 0.92\nDiscount codes are case-insensitive: normalise to uppercase once at the API boundary (src/server/api.ts), not in the UI.",
        },
        {
          kind: "text",
          text: "At the API boundary: `src/server/api.ts` uppercases codes in the orders route. It's a recorded decision, so the client shouldn't normalise.",
        },
      ],
    },
  ],

  memory: [
    {
      id: "mem-free-shipping",
      kind: "fact",
      text: "Free shipping applies to orders of $50.00 or more (FREE_SHIPPING_THRESHOLD in src/shared/pricing.ts). Prices are in integer cents.",
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
    {
      id: "mem-stock-oversell",
      kind: "failure",
      text: "Race condition if two carts add the last item concurrently; both succeed. Server checks stock at add-to-cart time only, not at checkout.",
      agent: "claude-code",
      session: "s-stock",
      confidence: 0.88,
      when: { daysAgo: 5, at: "11:50" },
      files: ["src/server/cart.ts"],
    },
    {
      id: "mem-field-errors",
      kind: "plan",
      text: "Checkout validates all fields together and returns them in one response: { error: string, fields: { name?, email?, address? } }. Client marks each field under its input.",
      agent: "atlas-agent",
      session: "s-errors",
      confidence: 0.92,
      when: { daysAgo: 4, at: "14:25" },
      files: ["src/server/orders.ts", "src/client/checkout.ts"],
    },
    {
      id: "mem-order-api",
      kind: "file",
      text: "GET /api/orders/:id returns the order (number, date, items, subtotal, discount, shipping, total). Used by /orders/:id page.",
      agent: "codex",
      session: "s-order-page",
      confidence: 0.86,
      when: { daysAgo: 2, at: "11:12" },
      files: ["src/server/api.ts", "src/client/order.ts"],
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
