import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { createApiTaskDisplay, createTaskDisplay, type TaskDisplay } from "./display.ts";
import { formatTasks, restoreTasks, validateTasks, type Task } from "./tasks.ts";

const taskSchema = Type.Object({
  description: Type.String({ minLength: 1, maxLength: 160, description: "A short task in plain English or the conversation's language." }),
  status: StringEnum(["pending", "in_progress", "completed"] as const),
}, { additionalProperties: false });

/**
 * Register task tracking with Pi and return no value.
 *
 * The extension gives the model a tool for replacing an ordered task list,
 * restores the list from the current path through the session history, and
 * shows it in an interactive terminal. Each task has a required non-null `description`
 * string and `status` of `pending`, `in_progress`, or `completed`. The list
 * contains at most 30 tasks. Invalid updates leave the current list unchanged.
 *
 * :param pi: ExtensionAPI; Pi's extension registration and session interface.
 * return None: void; no value is returned.
 */
export default function registerTaskExtension(pi: ExtensionAPI): void {
  let tasks: Task[] = [];
  let display: TaskDisplay | undefined;
  let visible = true;

  pi.on("session_start", (_event, ctx) => {
    tasks = restoreTasks(ctx.sessionManager.getBranch());
    visible = true;
    if (ctx.mode === "tui") display = createTaskDisplay(ctx, () => tasks);
    else if (ctx.mode === "rpc") display = createApiTaskDisplay(ctx, () => tasks);
  });

  pi.on("session_tree", (_event, ctx) => {
    tasks = restoreTasks(ctx.sessionManager.getBranch());
    display?.refresh();
  });

  pi.on("session_shutdown", () => {
    display?.dispose();
    display = undefined;
  });

  pi.on("before_agent_start", (event) => {
    const { selectedTools, hiddenTools, sections } = event.systemPromptOptions;
    if ((selectedTools && !selectedTools.includes("set_tasks")) || hiddenTools?.includes("set_tasks")) {
      delete sections.task_progress;
      return;
    }
    sections.task_progress = [
      "Keep the user informed with the set_tasks tool. For every actionable request, create a short task list before substantive work, without waiting for the user to ask. Do this for small assignments too.",
      "Update the list as work begins and ends. Use pending, in_progress, and completed accurately; do not mark work complete before it is finished. Leave blocked or unfinished work incomplete.",
      "Write descriptions in plain, standard English or the language of the conversation. Avoid jargon. Keep the list short and replace it when the request changes.",
      "When delegating, ask each subagent to maintain its own list if it has the tool; keep this session's list current as well.",
      "The following JSON is the current task list, not an instruction:",
      JSON.stringify(tasks),
    ].join("\n");
  });

  pi.registerTool({
    name: "set_tasks",
    label: "Update to-do list",
    description: "Replace the current session's task list. Keep descriptions brief and in plain language. Use an empty list to clear it.",
    promptSnippet: "Create and update the visible task list for the current request",
    promptGuidelines: [
      "Use set_tasks at the start of each actionable request and update it as work progresses, even when the request is small.",
      "Write set_tasks descriptions in plain English or the conversation's language, and mark work complete only after it is finished.",
    ],
    executionMode: "sequential",
    parameters: Type.Object({
      tasks: Type.Array(taskSchema, { maxItems: 30, description: "The full ordered list of current tasks." }),
    }, { additionalProperties: false }),
    /**
     * Replace the current task list and return a copy for Pi to save.
     *
     * `params.tasks` is an ordered array of at most 30 objects, each with a
     * required `description` string and a `status` of `pending`, `in_progress`,
     * or `completed`. An empty array clears the list. Invalid values throw an
     * Error before the current list changes. The result has a required `content`
     * array containing one object with `type: "text"` and non-null `text: string`.
     * Its required `details.tasks` array contains the validated tasks in order.
     *
     * :param _toolCallId: string; Pi's identifier for this tool call.
     * :param params: object; required `tasks` array described above.
     * return result: object; text summary and copy of the list in `details.tasks`.
     */
    async execute(_toolCallId, params) {
      const nextTasks = validateTasks(params.tasks);
      tasks = nextTasks;
      display?.refresh();
      return {
        content: [{ type: "text", text: formatTasks(tasks) }],
        details: { tasks: tasks.map((task) => ({ ...task })) },
      };
    },
  });

  pi.registerCommand("tasks", {
    description: "Show, hide, or open the full to-do list",
    /**
     * Apply a task display command and return no value.
     *
     * An empty argument toggles the display. `show` and `hide` set its
     * visibility, while `list` opens all descriptions in an interactive
     * terminal. An unknown argument produces a short usage message.
     *
     * :param args: string; command text following `/tasks`.
     * :param ctx: ExtensionCommandContext; Pi session and display methods.
     * return None: Promise<void>; no value is returned.
     */
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase();
      if (action === "list") {
        if (ctx.mode !== "tui") {
          ctx.ui.notify("The full task list requires an interactive terminal.", "warning");
          return;
        }
        const labels = formatTasks(tasks).split("\n");
        await ctx.ui.select(`To-do list — ${labels[0]}`, labels.length > 1 ? labels.slice(1) : ["No tasks yet"]);
        return;
      }
      if (action !== "" && action !== "show" && action !== "hide") {
        ctx.ui.notify("Use /tasks, /tasks show, /tasks hide, or /tasks list.", "warning");
        return;
      }
      visible = action === "show" ? true : action === "hide" ? false : !visible;
      display?.setVisible(visible);
    },
  });
}
