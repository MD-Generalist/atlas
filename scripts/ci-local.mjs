#!/usr/bin/env bun
/**
 * Runs what GitHub CI would run, on this machine, so a green run here means a
 * green run there.
 *
 *   bun run ci:local                     the jobs CI would run for this branch
 *   bun run ci:local --base origin/0.4.0 …planned against a different base
 *   bun run ci:local --all               every job
 *   bun run ci:local frontend atlas-git  just these jobs (names as CI shows them)
 *   bun run ci:local --list              the jobs, without running anything
 *
 * The jobs and their commands are read out of `.github/workflows/ci.yml` at
 * run time, never copied: every `run:` step of every job, with the crate
 * matrix expanded from `.github/ci-crates.json` and its `if: matrix.<flag>`
 * conditions applied. Which jobs to run comes from the same planner CI's
 * `changes` job uses (`scripts/ci-affected.mjs`), diffing the working tree
 * against the merge base with this branch's upstream. `frontend` always runs,
 * as in CI.
 *
 * That is the difference from `bun run test:rust`, which is a quick subset:
 * it skips clippy and atlas-kb-server, and tests every crate in one cargo
 * invocation, where cargo unifies features across crates. Here each crate is
 * tested and linted from its own directory with CI's exact flags. Over 200 CI
 * runs, clippy was the largest single cause of failed jobs, and no local gate
 * ran it.
 *
 * Deliberately NOT replicated:
 *   - steps that change this machine (`git config --global`, `sudo apt-get`).
 *     CI sets a throwaway git identity; yours is used instead.
 *   - job `env:`. CI's `RUSTC_WRAPPER=sccache`, `CARGO_INCREMENTAL=0` and
 *     `CARGO_PROFILE_DEV_DEBUG` are cache tuning for throwaway runners;
 *     applying them here would rebuild your whole target/ under a second
 *     profile and lose incremental builds.
 *   - the OS. The `crates` and `engine-dialect` jobs run on Linux in CI, so
 *     the engine's bubblewrap sandbox is not exercised on a Mac; run that job
 *     on a Linux machine for it.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  REPO_ROOT,
  changedFiles,
  dialectPackages,
  loadWorkspace,
  plan,
  readCrateMatrix,
} from "./ci-affected.mjs";

if (typeof Bun === "undefined") {
  console.error("ci-local: run this with bun (`bun run ci:local`); it parses ci.yml with Bun.YAML");
  process.exit(2);
}

/** Jobs that plan or gate other jobs rather than check anything. */
const NOT_CHECKS = new Set(["changes", "ci-ok"]);
/** A step matching this changes the machine it runs on; see the docblock. */
const MUTATES_MACHINE = /\bsudo\b|git config --global/;

const ciYmlText = readFileSync(path.join(REPO_ROOT, ".github", "workflows", "ci.yml"), "utf8");
const ciYml = Bun.YAML.parse(ciYmlText);

/** `if: matrix.flag`, `if: !matrix.flag`, optionally inside `${{ }}`. */
function matrixCondition(cond, entry) {
  const c = cond
    .trim()
    .replace(/^\$\{\{/, "")
    .replace(/\}\}$/, "")
    .trim();
  const negated = c.startsWith("!");
  const m = /^matrix\.([\w-]+)$/.exec(c.replace(/^!\s*/, ""));
  if (!m) throw new Error(`ci-local: cannot evaluate step condition \`${cond}\``);
  return Boolean(entry[m[1]]) !== negated;
}

/** Every checking job in ci.yml, crate matrix expanded, as runnable steps. */
function ciJobs() {
  const jobs = [];
  for (const [id, job] of Object.entries(ciYml.jobs)) {
    if (NOT_CHECKS.has(id)) continue;
    const entries = job.strategy?.matrix?.include ? readCrateMatrix() : [null];
    for (const entry of entries) {
      const steps = [];
      for (const step of job.steps) {
        if (!step.run) continue;
        if (step.if && !(entry && matrixCondition(step.if, entry))) continue;
        const cwd = (step["working-directory"] ?? ".").replace("${{ matrix.crate }}", entry?.crate);
        if (cwd.includes("${{") || step.run.includes("${{")) {
          throw new Error(
            `ci-local: step "${step.name}" in ${id} needs an expression ci-local can't evaluate`,
          );
        }
        steps.push({ name: step.name ?? step.run.split("\n")[0], run: step.run, cwd });
      }
      jobs.push({ id, name: entry ? entry.crate : (job.name ?? id), crate: entry?.crate, steps });
    }
  }
  return jobs;
}

function git(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

/** The job names CI would run for this working tree, or null for all. */
function plannedNames(argv) {
  if (argv.includes("--all")) return { names: null, why: "--all" };
  const i = argv.indexOf("--base");
  let base = i >= 0 ? argv[i + 1] : undefined;
  if (!base) {
    try {
      base = git(["merge-base", "HEAD", "@{upstream}"]);
    } catch {
      return { names: null, why: "this branch has no upstream to diff against" };
    }
  }
  const crates = readCrateMatrix();
  const p = plan(changedFiles(base, undefined), {
    workspace: loadWorkspace(),
    crates,
    dialect: dialectPackages(ciYmlText),
  });
  const names = new Set(["frontend", ...p.crates.map((c) => c.crate)]);
  if (p.app) names.add(ciYml.jobs.app.name);
  if (p.engineDialect) names.add(ciYml.jobs["engine-dialect"].name);
  return { names, why: `${p.reason} since ${base.slice(0, 12)}` };
}

/** Warn, don't fail: a version mismatch is a reason a result may not transfer. */
function checkVersions() {
  const tools = Object.fromEntries(
    [
      ...readFileSync(path.join(REPO_ROOT, "mise.toml"), "utf8").matchAll(/^(\w+) = "([^"]+)"/gm),
    ].map((m) => [m[1], m[2]]),
  );
  const have = (cmd) => spawnSync(cmd, ["--version"], { encoding: "utf8" }).stdout?.trim() ?? "";
  const bun = have("bun");
  const node = have("node").replace(/^v/, "");
  const warn = [];
  if (tools.bun && bun !== tools.bun)
    warn.push(`bun ${bun || "missing"}, mise.toml pins ${tools.bun}`);
  if (tools.node && !(node === tools.node || node.startsWith(`${tools.node}.`))) {
    warn.push(`node ${node || "missing"}, mise.toml pins ${tools.node}`);
  }
  for (const w of warn) console.warn(`ci-local: warning: ${w} (\`mise install\` fixes it)`);
}

function main(argv) {
  const all = ciJobs();
  const picked = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--base");
  let jobs;
  if (picked.length) {
    const unknown = picked.filter((n) => !all.some((j) => j.name === n || j.id === n));
    if (unknown.length) {
      console.error(
        `ci-local: no such job: ${unknown.join(", ")}. Jobs: ${all.map((j) => j.name).join(", ")}`,
      );
      process.exit(2);
    }
    jobs = all.filter((j) => picked.includes(j.name) || picked.includes(j.id));
    console.log(`ci-local: ${jobs.length} job(s) by name`);
  } else {
    const { names, why } = plannedNames(argv);
    jobs = names ? all.filter((j) => names.has(j.name)) : all;
    console.log(`ci-local: ${jobs.length} of ${all.length} jobs (${why})`);
  }
  // Fastest feedback first: the frontend takes about a minute, the app longest.
  const rank = { frontend: 0, crates: 1, "engine-dialect": 2, app: 3 };
  jobs.sort((a, b) => (rank[a.id] ?? 1) - (rank[b.id] ?? 1));

  if (argv.includes("--list")) {
    for (const j of jobs) {
      console.log(`\n${j.name}`);
      for (const s of j.steps) {
        const skip = MUTATES_MACHINE.test(s.run) ? "  (skipped: changes this machine)" : "";
        console.log(`  [${s.cwd}] ${s.run.replace(/\s*\n\s*/g, "; ")}${skip}`);
      }
    }
    return;
  }

  checkVersions();
  const env = { ...process.env };
  // As in scripts/test-rust.sh: apple-sys needs the active macOS SDK.
  if (process.platform === "darwin" && !env.SDKROOT) {
    env.SDKROOT = execFileSync("xcrun", ["--show-sdk-path"], { encoding: "utf8" }).trim();
  }

  const results = [];
  for (const job of jobs) {
    const started = Date.now();
    let failed = null;
    for (const step of job.steps) {
      if (MUTATES_MACHINE.test(step.run)) {
        console.log(`\n── ${job.name} › ${step.name}: skipped (changes this machine)`);
        continue;
      }
      console.log(
        `\n── ${job.name} › ${step.name}\n   [${step.cwd}] ${step.run.replace(/\s*\n\s*/g, " ")}`,
      );
      const r = spawnSync("bash", ["-eo", "pipefail", "-c", step.run], {
        cwd: path.join(REPO_ROOT, step.cwd),
        env,
        stdio: "inherit",
      });
      if (r.status !== 0) {
        failed = step.name;
        break;
      }
    }
    results.push({ job: job.name, failed, secs: Math.round((Date.now() - started) / 1000) });
  }

  console.log("\nci-local summary");
  for (const r of results) {
    console.log(
      `  ${r.failed ? "FAIL" : "ok  "}  ${r.job.padEnd(32)} ${String(r.secs).padStart(5)}s${r.failed ? `  (${r.failed})` : ""}`,
    );
  }
  const failures = results.filter((r) => r.failed).length;
  if (process.platform !== "linux" && jobs.some((j) => j.id !== "app" && j.id !== "frontend")) {
    console.log(
      "\n  Rust crate jobs ran on this OS; CI runs them on Linux, so Linux-only paths (the engine sandbox) were not exercised.",
    );
  }
  process.exit(failures ? 1 : 0);
}

main(process.argv.slice(2));
