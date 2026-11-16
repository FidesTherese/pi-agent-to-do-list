# Tests

<a id="table-of-contents"></a>
## Table of Contents

- [Run the checks](#run-the-checks)

## Run the checks

Run `npm test` from the parent directory. The tests check task validation, saved session history, display dimensions, and the extension's registered behavior. One test starts a real Pi process with `fake-model.ts`, a scripted model that makes no network requests. The test resumes the session and checks that Pi receives the saved task list.

Run `npm run typecheck` to check the TypeScript source and tests. These checks do not establish how a real model will follow the instructions.

[↑ Back to Table of Contents](#table-of-contents)
