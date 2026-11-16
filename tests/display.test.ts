import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createApiTaskDisplay, createTaskDisplay, isWideTerminal, renderTaskPanel } from "../src/display.ts";

const colors: string[] = [];
const theme = {
  /**
   * Record a requested theme color and return the unchanged text.
   *
   * The display tests inspect the requested colors without adding terminal escapes.
   *
   * :param color: string; name of the requested Pi theme color.
   * :param text: string; text that would receive the color.
   * return text: string; unchanged text for width and content checks.
   */
  fg(color: string, text: string): string {
    colors.push(color);
    return text;
  },
};

test("shows the completion count and each task using the active theme", () => {
  colors.length = 0;
  const lines = renderTaskPanel([
    { description: "Read", status: "completed" },
    { description: "Write", status: "in_progress" },
    { description: "Test", status: "pending" },
  ], 38, 8, theme);
  const text = lines.join("\n");
  assert.match(text, /1\/3/);
  assert.match(text, /Read/);
  assert.match(text, /Write/);
  assert.match(text, /Test/);
  assert.ok(colors.includes("success"));
  assert.ok(colors.includes("accent"));
  assert.ok(lines.every((line) => visibleWidth(line) <= 38));
});

test("fits wide characters and reports tasks that do not fit", () => {
  const lines = renderTaskPanel([
    { description: "確認結果をまとめる", status: "completed" },
    { description: "Second task", status: "pending" },
    { description: "Third task", status: "pending" },
    { description: "Fourth task", status: "pending" },
  ], 20, 5, theme);
  assert.equal(lines.length, 5);
  assert.ok(lines.every((line) => visibleWidth(line) <= 20));
  assert.match(lines.join("\n"), /2 more/);
});

test("shows an empty list and chooses the compact view for small terminals", () => {
  assert.match(renderTaskPanel([], 30, 5, theme).join("\n"), /0\/0/);
  assert.equal(isWideTerminal(100, 12), true);
  assert.equal(isWideTerminal(99, 30), false);
  assert.equal(isWideTerminal(120, 11), false);
});

test("sends task updates and visibility changes to an API-connected client", () => {
  const updates: Array<string[] | undefined> = [];
  const ctx = { ui: { setWidget: (_key: string, lines: string[] | undefined) => updates.push(lines) } } as unknown as ExtensionContext;
  const tasks: Array<{ description: string; status: "completed" }> = [];
  const display = createApiTaskDisplay(ctx, () => tasks);
  assert.match(updates.at(-1)!.join("\n"), /0\/0/);
  tasks.push({ description: "Read the request", status: "completed" });
  display.refresh();
  assert.match(updates.at(-1)!.join("\n"), /1\/1[\s\S]*Read the request/);
  display.setVisible(false);
  assert.equal(updates.at(-1), undefined);
  display.setVisible(true);
  assert.match(updates.at(-1)!.join("\n"), /Read the request/);
  display.dispose();
  assert.equal(updates.at(-1), undefined);
});

test("shows the compact list if the right-hand panel fails to open", () => {
  let widget: any;
  const notices: string[] = [];
  const tui = {
    terminal: { rows: 30 },
    requestRender: () => {},
    showOverlay: () => { throw new Error("Display unavailable"); },
  };
  const ctx = {
    ui: {
      theme,
      setWidget: (_key: string, factory: any) => { widget = factory ? factory(tui, theme) : undefined; },
      notify: (text: string) => notices.push(text),
    },
  } as unknown as ExtensionContext;
  const display = createTaskDisplay(ctx, () => [{ description: "Check the result", status: "pending" }]);
  assert.match(widget.render(120).join("\n"), /Check the result/);
  assert.match(notices[0], /compact list/);
  display.dispose();
});

test("keeps the right-hand display out of keyboard focus and switches on resize", () => {
  let redraws = 0;
  let closes = 0;
  let widget: any;
  let panel: any;
  let options: any;
  const tui = {
    terminal: { rows: 30 },
    requestRender: () => { redraws += 1; },
    showOverlay: (component: any, suppliedOptions: any) => {
      panel = component;
      options = suppliedOptions;
      return { hide: () => { closes += 1; } };
    },
  };
  const ctx = {
    ui: {
      theme,
      setWidget: (_key: string, factory: any) => {
        widget?.dispose?.();
        widget = factory ? factory(tui, theme) : undefined;
      },
      custom: () => { throw new Error("The task list must not open a user prompt."); },
      notify: () => {},
    },
  } as unknown as ExtensionContext;
  const tasks = [{ description: "Check the result", status: "in_progress" as const }];
  const display = createTaskDisplay(ctx, () => tasks);
  assert.equal(options.nonCapturing, true);
  assert.equal(options.visible(120, 30), true);
  assert.deepEqual(widget.render(120), []);
  assert.match(panel.render(38).join("\n"), /Check the result/);
  assert.match(widget.render(80).join("\n"), /Check the result/);
  tui.terminal.rows = 4;
  assert.ok(widget.render(80).length <= 0, "The compact list must leave room for the input.");
  tui.terminal.rows = 30;
  display.setVisible(false);
  assert.equal(options.visible(120, 30), false);
  assert.deepEqual(widget.render(80), []);
  display.setVisible(true);
  display.refresh();
  assert.ok(redraws >= 3);
  display.dispose();
  display.dispose();
  assert.equal(closes, 1);
  assert.equal(widget, undefined);
});
