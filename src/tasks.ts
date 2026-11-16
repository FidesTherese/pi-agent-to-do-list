export type TaskStatus = "pending" | "in_progress" | "completed";

export interface Task {
  description: string;
  status: TaskStatus;
}

/**
 * Validate an unknown value and return a separate, ordered list of tasks.
 *
 * The input must be an array of at most 30 objects. Each object must contain
 * exactly `description`, a non-null string of at most 160 Unicode values,
 * and `status`, one of `pending`, `in_progress`, or `completed`. Descriptions
 * must contain text after trimming and cannot contain terminal control
 * characters. The length limit includes spaces before and after the text.
 * This function does not change its input and throws an Error for invalid items.
 *
 * :param input: unknown; proposed task list in the shape described above.
 * return tasks: Task[]; validated task objects in their original order.
 */
export function validateTasks(input: unknown): Task[] {
  if (!Array.isArray(input) || input.length > 30) {
    throw new Error("The list must contain no more than 30 tasks.");
  }
  return input.map((value, index) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Task ${index + 1} must have a description and a state.`);
    }
    const item = value as Record<string, unknown>;
    const keys = Object.keys(item);
    if (keys.length !== 2 || !keys.includes("description") || !keys.includes("status")) {
      throw new Error(`Task ${index + 1} must contain only a description and a state.`);
    }
    if (typeof item.description !== "string" || /[\u0000-\u001f\u007f-\u009f]/u.test(item.description)) {
      throw new Error(`Task ${index + 1} needs a description without control characters.`);
    }
    const description = item.description.trim();
    if (description.length === 0 || Array.from(item.description).length > 160) {
      throw new Error(`Task ${index + 1} needs a description of 1 to 160 characters.`);
    }
    if (item.status !== "pending" && item.status !== "in_progress" && item.status !== "completed") {
      throw new Error(`Task ${index + 1} has an unknown state.`);
    }
    return { description, status: item.status };
  });
}

/**
 * Read session entries and return the last valid task list on that path.
 *
 * Each relevant entry has `type: "message"` and a non-null `message` object
 * with `role: "toolResult"`, `toolName: "set_tasks"`, optional boolean
 * `isError`, and `details.tasks` containing the list accepted by validateTasks.
 * Missing, failed, unrelated, and malformed entries are ignored. The input is
 * not changed, and an empty list is returned when no valid saved list exists.
 *
 * :param entries: readonly unknown[]; entries from the current path through the session history, in order.
 * return tasks: Task[]; last valid saved list, with fresh item objects.
 */
export function restoreTasks(entries: readonly unknown[]): Task[] {
  let tasks: Task[] = [];
  for (const entry of entries) {
    if (entry === null || typeof entry !== "object" || !("type" in entry) || entry.type !== "message" || !("message" in entry)) {
      continue;
    }
    const message = entry.message;
    if (message === null || typeof message !== "object" || !("role" in message) || message.role !== "toolResult" ||
        !("toolName" in message) || message.toolName !== "set_tasks" || ("isError" in message && message.isError === true) ||
        !("details" in message) || message.details === null || typeof message.details !== "object" || !("tasks" in message.details)) {
      continue;
    }
    try {
      tasks = validateTasks(message.details.tasks);
    } catch {
      // A damaged or older entry does not replace the last valid list.
    }
  }
  return tasks;
}

/**
 * Format a validated task list and return its full text and completion count.
 *
 * Each item has a non-null `description` string and a `status` of `pending`,
 * `in_progress`, or `completed`. The list may be empty, and its order is kept.
 * The returned text starts with the number completed and includes every item.
 *
 * :param tasks: readonly Task[]; validated tasks in display order.
 * return text: string; completion count followed by the complete list.
 */
export function formatTasks(tasks: readonly Task[]): string {
  const completed = tasks.filter((task) => task.status === "completed").length;
  const labels: Record<TaskStatus, string> = { pending: "Waiting", in_progress: "In progress", completed: "Done" };
  return [`${completed}/${tasks.length} complete`, ...tasks.map((task) => `${labels[task.status]}: ${task.description}`)].join("\n");
}
