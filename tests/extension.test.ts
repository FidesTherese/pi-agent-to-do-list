import { test } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerTaskExtension from "../src/index.ts";

type Handler = (...args: any[]) => any;

/**
 * Create a controlled Pi session and return its captured extension callbacks.
 *
 * The session starts without tasks or a terminal. Its mutable `branch` array
 * represents the entries on the current session path. The returned objects
 * expose the registered tool, events, command, and notifications for tests.
 *
 * return fixture: object; captured Pi callbacks and an editable session branch.
 */
function createFixture() {
  const events = new Map<string, Handler>();
  const tools = new Map<string, any>();
  const commands = new Map<string, any>();
  const branch: unknown[] = [];
  const notices: string[] = [];
  const api = {
    on: (name: string, handler: Handler) => events.set(name, handler),
    registerTool: (tool: any) => tools.set(tool.name, tool),
    registerCommand: (name: string, command: any) => commands.set(name, command),
  } as unknown as ExtensionAPI;
  const ctx = {
    mode: "print",
    hasUI: false,
    sessionManager: { getBranch: () => branch },
    ui: { notify: (text: string) => notices.push(text) },
  };
  registerTaskExtension(api);
  return { events, tools, commands, branch, notices, ctx };
}

test("updates the session list without a separate user command", async () => {
  const { tools, events, ctx } = createFixture();
  await events.get("session_start")!({}, ctx);
  const tool = tools.get("set_tasks");
  assert.equal(tool.executionMode, "sequential");
  assert.deepEqual(tool.parameters.properties.tasks.items.properties.status.enum, ["pending", "in_progress", "completed"]);
  const result = await tool.execute("call-1", {
    tasks: [
      { description: "Read the request", status: "completed" },
      { description: "Check the result", status: "in_progress" },
    ],
  }, undefined, undefined, ctx);
  assert.equal(result.details.tasks.length, 2);
  assert.match(result.content[0].text, /1\/2/);
  const start = { systemPromptOptions: { sections: {} as Record<string, string> } };
  await events.get("before_agent_start")!(start, ctx);
  assert.match(start.systemPromptOptions.sections.task_progress, /Check the result/);
  assert.match(start.systemPromptOptions.sections.task_progress, /set_tasks/);
});

test("rejects an invalid replacement without losing the current list", async () => {
  const { tools, events, ctx } = createFixture();
  await events.get("session_start")!({}, ctx);
  const tool = tools.get("set_tasks");
  await tool.execute("call-1", { tasks: [{ description: "Keep this", status: "pending" }] }, undefined, undefined, ctx);
  await assert.rejects(() => tool.execute("call-2", { tasks: [{ description: "", status: "completed" }] }, undefined, undefined, ctx));
  const start = { systemPromptOptions: { sections: {} as Record<string, string> } };
  await events.get("before_agent_start")!(start, ctx);
  assert.match(start.systemPromptOptions.sections.task_progress, /Keep this/);
});

test("restores a different task list when the active session branch changes", async () => {
  const { tools, events, branch, ctx } = createFixture();
  const saved = [{ description: "Earlier work", status: "completed" }];
  branch.push({ type: "message", message: { role: "toolResult", toolName: "set_tasks", isError: false, details: { tasks: saved } } });
  await events.get("session_start")!({}, ctx);
  let start = { systemPromptOptions: { sections: {} as Record<string, string> } };
  await events.get("before_agent_start")!(start, ctx);
  assert.match(start.systemPromptOptions.sections.task_progress, /Earlier work/);
  await tools.get("set_tasks").execute("call-1", { tasks: [{ description: "New work", status: "pending" }] }, undefined, undefined, ctx);
  branch.length = 0;
  await events.get("session_tree")!({}, ctx);
  start = { systemPromptOptions: { sections: {} as Record<string, string> } };
  await events.get("before_agent_start")!(start, ctx);
  assert.doesNotMatch(start.systemPromptOptions.sections.task_progress, /New work|Earlier work/);
});

test("sends the task list to a client connected through Pi's API", async () => {
  const { tools, events, ctx } = createFixture();
  const updates: Array<string[] | undefined> = [];
  const apiContext = { ...ctx, mode: "rpc", hasUI: true, ui: { ...ctx.ui, setWidget: (_key: string, lines: string[] | undefined) => updates.push(lines) } };
  await events.get("session_start")!({}, apiContext);
  await tools.get("set_tasks").execute("call-1", { tasks: [{ description: "Check the result", status: "in_progress" }] }, undefined, undefined, apiContext);
  assert.match(updates.at(-1)!.join("\n"), /Check the result/);
  await events.get("session_shutdown")!({}, apiContext);
  assert.equal(updates.at(-1), undefined);
});

test("does not ask the model to use the task tool when it is disabled", async () => {
  const { events, ctx } = createFixture();
  const start = { systemPromptOptions: { selectedTools: [], hiddenTools: [], sections: { task_progress: "old" } } };
  await events.get("before_agent_start")!(start, ctx);
  assert.equal("task_progress" in start.systemPromptOptions.sections, false);
});

test("registers a full-list command and reports terminal-only use in print mode", async () => {
  const { commands, notices, ctx } = createFixture();
  const command = commands.get("tasks");
  assert.ok(command);
  await command.handler("list", ctx);
  assert.match(notices[0], /terminal/i);
});
