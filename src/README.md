# Source Files

<a id="table-of-contents"></a>
## Table of Contents

- [Purpose](#purpose)

## Purpose

`index.ts` registers the task tool, session events, and `/tasks` command with Pi. `tasks.ts` validates and restores task lists. `display.ts` draws the list with Pi's current theme, sends task lines to API-connected clients, and provides the show and hide controls. Pi loads `index.ts` through the package manifest in the parent directory.

Run `npm test` and `npm run typecheck` from the parent directory after changing these files.

[↑ Back to Table of Contents](#table-of-contents)
