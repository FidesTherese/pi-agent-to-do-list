# Pi To-Do List

This Pi extension shows the agent's current tasks and how many it has finished. It asks the model to create and update the list without a separate reminder.

<a id="table-of-contents"></a>
## Table of Contents

- [Requirements](#requirements)
- [Try the extension](#try-the-extension)
- [Install the package](#install-the-package)
- [Use the list](#use-the-list)
- [What to expect](#what-to-expect)
- [Development](#development)

## Requirements

- Pi 1.5.2.
- Node.js 22.19 or later.
- An interactive terminal for the right-hand list. An API-connected client can also receive the list if it displays Pi's extension messages.

The package is marked `UNLICENSED`.

[↑ Back to Table of Contents](#table-of-contents)

## Try the extension

From a source checkout of this project, install the development dependencies and start Pi with the extension:

```bash
npm install
pi -e ./src/index.ts
```

The extension asks the model to write tasks in plain English or the language of the conversation. It uses the colors of the active Pi theme.

[↑ Back to Table of Contents](#table-of-contents)

## Install the package

To add this directory as a Pi package, run the following command from this directory:

```bash
pi install .
```

Pi records the local directory in its settings. The directory must remain available. Use `pi install . --local` instead to configure only the current project.

When the package is available on npm, install it with:

```bash
pi install npm:pi-agent-to-do-list
```

You can create an npm package file without publishing it:

```bash
npm pack
```

The resulting `.tgz` file can also be installed with `npm install /path/to/pi-agent-to-do-list-0.1.0.tgz` in another Node.js project. Replace `/path/to/` with the file's actual location; on Windows, use its Windows path. In that project, start Pi with `pi -e ./node_modules/pi-agent-to-do-list` or add that directory as a Pi package.

[↑ Back to Table of Contents](#table-of-contents)

## Use the list

On a terminal at least 100 columns wide and 12 rows high, the list appears on the right. A check mark means a task is done, a filled circle means it is in progress, and an empty circle means it is waiting. The heading shows the number completed and the total.

- `/tasks` hides or shows the list.
- `/tasks show` shows it.
- `/tasks hide` hides it.
- `/tasks list` opens the complete list. Select any entry or press Escape to close it.

On a smaller terminal, the list appears above the input instead, provided there is enough room. If the list is too long for the available space, the display reports how many tasks are hidden; `/tasks list` shows them all.

[↑ Back to Table of Contents](#table-of-contents)

## What to expect

Pi does not offer extensions a separate right-hand column. The right-hand list therefore covers part of the chat rather than moving the chat aside. Hide the list when you need to read the covered text.

The model decides which tasks to create and when to update them. The extension supplies instructions and a tool, but its instructions do not guarantee that every model will follow them or judge completion correctly. If the task tool is disabled, the model cannot update the list. It retains the latest valid list in Pi's session history and restores the list for the current branch when a session is resumed or its history is navigated.

An API-connected client receives the task list as text, but that client decides whether and where to display it. In other non-interactive modes, the task tool works without a visible list.

A subagent can maintain its own list when its Pi process loads this package. Its list is separate from the parent session; the extension does not combine them automatically.

[↑ Back to Table of Contents](#table-of-contents)

## Development

```bash
npm install
npm test
npm run typecheck
npm pack --dry-run
```

The source checkout includes guides in `src/README.md`, `tests/README.md`, and `doc/README.md`. They explain the source files, tests, and internal design records. The package has no separate server or runtime dependency installation step inside Pi.

[↑ Back to Table of Contents](#table-of-contents)
