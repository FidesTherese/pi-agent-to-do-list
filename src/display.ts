import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, type OverlayHandle, type TUI } from "@earendil-works/pi-tui";
import { formatTasks, type Task } from "./tasks.ts";

export interface TaskDisplay {
  refresh(): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

/**
 * Check terminal dimensions and return whether the right-hand panel fits.
 *
 * A wide terminal has at least 100 columns and 12 rows. Smaller terminals use
 * the compact display above the input instead.
 *
 * :param width: number; terminal width in columns.
 * :param height: number; terminal height in rows.
 * return wide: boolean; whether the right-hand panel is enabled.
 */
export function isWideTerminal(width: number, height: number): boolean {
  return width >= 100 && height >= 12;
}

/**
 * Draw an ordered task list and return lines that fit the supplied dimensions.
 *
 * Each task contains a non-null `description` string and a `status` of
 * `pending`, `in_progress`, or `completed`. The list may be empty. The first
 * line shows the completion count, and the final line closes the border. When
 * tasks exceed the available rows, a line reports how many are hidden. Theme
 * colors are applied at render time; the input list is not modified.
 *
 * :param tasks: readonly Task[]; validated tasks in the order to display.
 * :param width: number; maximum visible width in terminal columns.
 * :param maxLines: number; maximum number of lines available to the panel.
 * :param theme: Pick<Theme, "fg">; Pi's current foreground color function.
 * return lines: string[]; bordered, themed lines in display order.
 */
export function renderTaskPanel(tasks: readonly Task[], width: number, maxLines: number, theme: Pick<Theme, "fg">): string[] {
  if (width < 4 || maxLines < 3) return [];
  const innerWidth = width - 2;
  const completed = tasks.filter((task) => task.status === "completed").length;
  const title = truncateToWidth(` To-do list ${completed}/${tasks.length} `, innerWidth, "…");
  const top = theme.fg("accent", `┌${title}${"─".repeat(Math.max(0, innerWidth - visibleWidth(title)))}┐`);
  const bottom = theme.fg("accent", `└${"─".repeat(innerWidth)}┘`);
  const capacity = maxLines - 2;
  const shown = tasks.length > capacity ? Math.max(0, capacity - 1) : Math.min(tasks.length, capacity);
  const lines = [top];
  for (const task of tasks.slice(0, shown)) {
    const marker = task.status === "completed" ? "✓" : task.status === "in_progress" ? "●" : "○";
    const color = task.status === "completed" ? "success" : task.status === "in_progress" ? "accent" : "muted";
    const text = truncateToWidth(` ${marker} ${task.description}`, innerWidth, "…", true);
    lines.push(`${theme.fg("accent", "│")}${theme.fg(color, text)}${theme.fg("accent", "│")}`);
  }
  if (tasks.length > shown) {
    const text = truncateToWidth(` + ${tasks.length - shown} more`, innerWidth, "…", true);
    lines.push(`${theme.fg("accent", "│")}${theme.fg("muted", text)}${theme.fg("accent", "│")}`);
  } else if (tasks.length === 0) {
    const text = truncateToWidth(" No tasks yet", innerWidth, "…", true);
    lines.push(`${theme.fg("accent", "│")}${theme.fg("muted", text)}${theme.fg("accent", "│")}`);
  }
  lines.push(bottom);
  return lines;
}

/**
 * Send a task list to an API-connected Pi client and return display controls.
 *
 * The supplier returns an ordered list of Task objects, each with a non-null
 * `description` and a `status` of `pending`, `in_progress`, or `completed`.
 * Pi sends text lines to the client, which decides where to display them. The
 * controls can resend the list, hide it, show it, or clear it at shutdown.
 *
 * :param ctx: ExtensionContext; Pi session and its client display methods.
 * :param getTasks: () => readonly Task[]; supplies the current validated task list.
 * return display: TaskDisplay; controls for the current session's display.
 */
export function createApiTaskDisplay(ctx: ExtensionContext, getTasks: () => readonly Task[]): TaskDisplay {
  let visible = true;
  let disposed = false;

  /**
   * Send the current task lines to the client and return no value.
   *
   * Pi clears the lines when the display is hidden. Once closed, this function
   * leaves the client unchanged.
   *
   * return None: void; no value is returned.
   */
  const publishTasks = () => {
    if (!disposed) ctx.ui.setWidget("task-progress", visible ? ["To-do list", ...formatTasks(getTasks()).split("\n")] : undefined);
  };
  publishTasks();
  return {
    /**
     * Send the current list to the client and return no value.
     *
     * A hidden or closed display does not show task lines.
     *
     * return None: void; no value is returned.
     */
    refresh: () => publishTasks(),
    /**
     * Set whether the client receives task lines and return no value.
     *
     * Hiding the lines does not change the task list or session history.
     *
     * :param nextVisible: boolean; whether the list should be shown.
     * return None: void; no value is returned.
     */
    setVisible: (nextVisible: boolean) => {
      visible = nextVisible;
      publishTasks();
    },
    /**
     * Clear the client's task lines and return no value.
     *
     * Repeated calls leave the display closed and have no further effect.
     *
     * return None: void; no value is returned.
     */
    dispose: () => {
      if (disposed) return;
      disposed = true;
      ctx.ui.setWidget("task-progress", undefined);
    },
  };
}

/**
 * Connect the task display to an interactive Pi session and return its controls.
 *
 * The supplier returns ordered Task objects with non-null `description` and
 * `status` fields; the status is `pending`, `in_progress`, or `completed`.
 * A panel that does not take keyboard input covers the right edge of a wide
 * terminal. A compact list appears above the input on smaller terminals or if
 * panel setup fails.
 * The returned controls update the screen, change visibility, and close both displays.
 * This function does not change the task list.
 *
 * :param ctx: ExtensionContext; interactive Pi session and its display methods.
 * :param getTasks: () => readonly Task[]; supplies the current validated task list.
 * return display: TaskDisplay; controls for the current session's display.
 */
export function createTaskDisplay(ctx: ExtensionContext, getTasks: () => readonly Task[]): TaskDisplay {
  let visible = true;
  let overlayReady = false;
  let tui: TUI | undefined;
  let disposed = false;

  ctx.ui.setWidget("task-progress", (instance) => {
    tui = instance;
    let panel: OverlayHandle | undefined;
    try {
      panel = instance.showOverlay({
        /**
         * Draw the right-hand task panel and return its visible lines.
         *
         * The panel uses at most half the terminal height and applies the
         * current theme each time Pi updates the screen.
         *
         * :param width: number; panel width in terminal columns.
         * return lines: string[]; themed task lines within the available height.
         */
        render: (width: number) => renderTaskPanel(getTasks(), width, Math.floor(instance.terminal.rows / 2), ctx.ui.theme),
        /**
         * Accept a request to update the screen and return no value.
         *
         * The panel has no saved lines to clear.
         *
         * return None: void; no value is returned.
         */
        invalidate: () => {},
      }, {
        anchor: "top-right",
        width: 38,
        maxHeight: "50%",
        margin: { top: 1, right: 1 },
        nonCapturing: true,
        visible: (width, height) => visible && isWideTerminal(width, height),
      });
      overlayReady = true;
    } catch {
      ctx.ui.notify("The right-hand task display could not open. The compact list remains available.", "warning");
    }
    return {
      /**
       * Draw the compact list at the right of the input area and return its lines.
       *
       * The list is hidden when the wide panel is active or there is too little
       * space. Each returned line fits the available terminal width.
       *
       * :param width: number; available terminal width in columns.
       * return lines: string[]; right-aligned task lines, or an empty list.
       */
      render: (width: number) => {
        if (!visible || (overlayReady && isWideTerminal(width, instance.terminal.rows))) return [];
        const panelWidth = Math.min(width, 38);
        const availableLines = Math.min(6, Math.max(0, instance.terminal.rows - 4));
        return renderTaskPanel(getTasks(), panelWidth, availableLines, ctx.ui.theme)
          .map((line) => `${" ".repeat(Math.max(0, width - visibleWidth(line)))}${line}`);
      },
      /**
       * Accept a request to update the screen and return no value.
       *
       * The compact display has no saved lines to clear.
       *
       * return None: void; no value is returned.
       */
      invalidate: () => {},
      /**
       * Close the right-hand panel and return no value.
       *
       * Pi calls this when it removes or replaces the compact display.
       *
       * return None: void; no value is returned.
       */
      dispose: () => {
        panel?.hide();
        panel = undefined;
        overlayReady = false;
      },
    };
  });

  return {
    /**
     * Update the displayed task list and return no value.
     *
     * Pi combines this request with any other pending screen updates.
     *
     * return None: void; no value is returned.
     */
    refresh: () => tui?.requestRender(),
    /**
     * Set whether the task display is visible and return no value.
     *
     * Hiding the display does not change the task list or the saved session.
     *
     * :param nextVisible: boolean; whether the display should be visible.
     * return None: void; no value is returned.
     */
    setVisible: (nextVisible: boolean) => {
      visible = nextVisible;
      tui?.requestRender();
    },
    /**
     * Remove the session's task display and return no value.
     *
     * Repeated calls leave the display closed and have no further effect.
     *
     * return None: void; no value is returned.
     */
    dispose: () => {
      if (disposed) return;
      disposed = true;
      ctx.ui.setWidget("task-progress", undefined);
    },
  };
}
