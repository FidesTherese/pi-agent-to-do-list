import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTasks, restoreTasks, validateTasks } from "../src/tasks.ts";

test("accepts an ordered list and trims task descriptions", () => {
  const source = [
    { description: "  Read the request  ", status: "completed" },
    { description: "Run tests", status: "in_progress" },
    { description: "Explain results", status: "pending" },
  ];
  const result = validateTasks(source);
  assert.deepEqual(result, [
    { description: "Read the request", status: "completed" },
    { description: "Run tests", status: "in_progress" },
    { description: "Explain results", status: "pending" },
  ]);
  assert.equal(source[0].description, "  Read the request  ");
  assert.notEqual(result[1], source[1]);
});

test("counts each emoji as one character when checking description length", () => {
  const description = "😀".repeat(160);
  assert.equal(validateTasks([{ description, status: "pending" }])[0].description, description);
  assert.throws(() => validateTasks([{ description: `${description}😀`, status: "pending" }]));
  assert.throws(() => validateTasks([{ description: ` ${description}`, status: "pending" }]));
});

test("rejects malformed tasks and terminal control characters", () => {
  for (const invalid of [
    null,
    {},
    Array.from({ length: 31 }, () => ({ description: "One", status: "pending" })),
    [{ description: "  ", status: "pending" }],
    [{ description: "x".repeat(161), status: "pending" }],
    [{ description: "Hello\u001b[2J", status: "pending" }],
    [{ description: "One\nTwo", status: "pending" }],
    [{ description: "One", status: "finished" }],
    [{ description: "One", status: "pending", extra: true }],
  ]) {
    assert.throws(() => validateTasks(invalid));
  }
  assert.deepEqual(validateTasks([]), []);
});

test("restores the most recent valid successful result from the supplied branch", () => {
  const first = [{ description: "Read", status: "completed" }];
  const latest = [{ description: "Test", status: "in_progress" }];
  const entries = [
    { type: "message", message: { role: "toolResult", toolName: "set_tasks", isError: false, details: { tasks: first } } },
    { type: "message", message: { role: "toolResult", toolName: "other", isError: false, details: { tasks: [] } } },
    { type: "message", message: { role: "toolResult", toolName: "set_tasks", isError: false, details: { tasks: latest } } },
    { type: "message", message: { role: "toolResult", toolName: "set_tasks", isError: true, details: { tasks: [] } } },
    { type: "message", message: { role: "toolResult", toolName: "set_tasks", isError: false, details: { tasks: [{ description: "", status: "pending" }] } } },
    null,
  ];
  assert.deepEqual(restoreTasks(entries), latest);
  assert.deepEqual(restoreTasks(entries.slice(0, 1)), first);
  assert.deepEqual(restoreTasks([]), []);
  assert.deepEqual(restoreTasks([...entries, { type: "message", message: { role: "toolResult", toolName: "set_tasks", isError: false, details: { tasks: [] } } }]), []);
});

test("formats task states and the completion count for a complete list", () => {
  const text = formatTasks([
    { description: "Read", status: "completed" },
    { description: "Test", status: "in_progress" },
    { description: "Report", status: "pending" },
  ]);
  assert.match(text, /1\/3/);
  assert.match(text, /Read/);
  assert.match(text, /Test/);
  assert.match(text, /Report/);
  assert.match(formatTasks([]), /0\/0/);
});
