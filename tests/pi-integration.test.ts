import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("Pi saves scripted task updates and restores them in a resumed session", () => {
  const cwd = process.cwd();
  const configDir = mkdtempSync(join(cwd, ".pi-task-test-"));
  try {
    /**
     * Run Pi with a scripted model and return the completed child process.
     *
     * The child stores its session and configuration in this test's temporary
     * directory. The scripted model does not make network requests.
     *
     * :param resume: boolean; whether to continue the preceding session.
     * return result: SpawnSyncReturns<string>; Pi's output and exit status.
     */
    const runPi = (resume: boolean) => spawnSync(process.execPath, [
      "./node_modules/@earendil-works/pi-coding-agent/dist/cli.js",
      "--offline", "--mode", "json", "--session-dir", join(configDir, "sessions"),
      ...(resume ? ["--continue"] : []), "--no-extensions", "--no-skills",
      "--no-prompt-templates", "--no-themes", "--no-context-files",
      "-e", "./src/index.ts", "-e", "./tests/fake-model.ts",
      "--provider", "task-test", "--model", "task-test", "-p", "Check a request.",
    ], {
      cwd,
      env: { ...process.env, PI_CODING_AGENT_DIR: configDir },
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const run = runPi(false);
    assert.equal(run.error, undefined, run.error?.message);
    assert.equal(run.status, 0, run.stderr);
    const events = run.stdout.trim().split("\n").map((line) => JSON.parse(line));
    const results = events.filter((event) => event.type === "tool_execution_end" && event.toolName === "set_tasks");
    assert.equal(results.length, 2);
    assert.deepEqual(results.map((event) => event.isError), [false, false]);
    assert.deepEqual(results.map((event) => event.result.details.tasks[0].status), ["in_progress", "completed"]);
    const final = events.find((event) => event.type === "agent_settled");
    assert.equal(final?.aborted, false);
    assert.match(run.stdout, /The scripted check finished/);

    const resumed = runPi(true);
    assert.equal(resumed.error, undefined, resumed.error?.message);
    assert.equal(resumed.status, 0, resumed.stderr);
    const resumedEvents = resumed.stdout.trim().split("\n").map((line) => JSON.parse(line));
    const promptUpdate = resumedEvents.find((event) => event.type === "message_start" && event.message?.role === "system" && event.message.sections?.task_progress?.includes('"status":"completed"'));
    assert.ok(promptUpdate, "The resumed prompt must contain the saved completed task.");
  } finally {
    rmSync(configDir, { recursive: true, force: true });
  }
});
