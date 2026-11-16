# Pi To-Do List — a task tracker for the Pi coding agent

When a request has several steps, it helps to see what's done and what's still ahead. Pi To-Do List is a to-do list extension for the Pi AI coding agent that puts that progress in your terminal. It asks the agent to create and update tasks as it works, so you don't have to keep asking for a status update.

[Get the package on npm](https://www.npmjs.com/package/pi-agent-to-do-list) · [View the source on GitHub](https://github.com/FidesTherese/pi-agent-to-do-list)

<a id="table-of-contents"></a>
## Table of Contents

- [Install from npm](#install-from-npm)
- [Why use Pi To-Do List?](#why-use-pi-to-do-list)
- [Using the to-do list](#using-the-to-do-list)
- [Display and limitations](#display-and-limitations)
- [Subagents and API clients](#subagents-and-api-clients)
- [Developing the extension](#developing-the-extension)
- [License](#license)

## Install from npm

The extension has been tested with Pi 1.5.2 and requires Node.js 22.19 or later. Once Pi is installed, run:

```bash
pi install npm:pi-agent-to-do-list
```

Start a new Pi session to load the extension. To try it for a single session without adding it to your settings, run:

```bash
pi -e npm:pi-agent-to-do-list
```

[↑ Back to Table of Contents](#table-of-contents)

## Why use Pi To-Do List?

- **See progress at a glance.** The list shows which tasks are waiting, in progress, or complete, along with a completion count.
- **Spend less time asking for updates.** The extension prompts the agent to create and maintain its own task list.
- **Pick up where you left off.** Pi saves the latest valid list in the session history and restores it when you reopen a session or move through its history.
- **Keep the display easy to read.** The list uses your Pi theme's colors, and the extension asks the agent to write tasks in plain English or the language of your conversation.

[↑ Back to Table of Contents](#table-of-contents)

## Using the to-do list

The list appears as your agent works. It might look like this:

```text
┌ To-do list 1/3 ────────────────────┐
│ ✓ Read the request                 │
│ ● Make the changes                 │
│ ○ Check the result                 │
└────────────────────────────────────┘
```

A check mark means a task is complete, a filled circle means it is in progress, and an empty circle means it is waiting. The heading shows the number completed out of the total.

You can control the display from the chat:

- `/tasks` hides or shows the list.
- `/tasks show` shows it.
- `/tasks hide` hides it.
- `/tasks list` opens the complete list. Select an entry or press Escape to close it.

[↑ Back to Table of Contents](#table-of-contents)

## Display and limitations

On a terminal that is at least 100 columns wide and 12 rows high, the list appears on the right. Pi does not give extensions a separate column, so the list covers part of the chat. You can hide it when you need to read the text underneath.

On a smaller terminal, the list appears above the input when there is enough room. If the available space is too short for every task, the list shows how many are hidden; use `/tasks list` to see them all.

The model decides what to add and when to update it. The extension gives it instructions, but a list may still be incomplete or out of date. If the task tool is disabled, the agent cannot update the list.

[↑ Back to Table of Contents](#table-of-contents)

## Subagents and API clients

A subagent can keep its own task list if its Pi process loads the extension. Each list belongs to its own session; subagent tasks are not combined with the parent list.

An API-connected client can receive the list as text. The client decides whether and where to show it. In other non-interactive modes, the task tool works without a visible list.

[↑ Back to Table of Contents](#table-of-contents)

## Developing the extension

If you are working from a source checkout, install the development dependencies and run the checks from the project directory:

```bash
npm install
npm test
npm run typecheck
```

To start Pi with your local copy without installing it, run:

```bash
pi -e ./src/index.ts
```

To install the local directory as a Pi package instead, run `pi install .` from the project directory. Pi keeps a reference to that directory, so it needs to remain available. Add `--local` to save the package setting for the current project only.

The source checkout includes guides in `src/README.md`, `tests/README.md`, and `doc/README.md`. They explain the source files, tests, and internal design records.

[↑ Back to Table of Contents](#table-of-contents)

## License

The npm package is marked `UNLICENSED`.

[↑ Back to Table of Contents](#table-of-contents)
