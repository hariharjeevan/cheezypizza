# Contributing to CheezyPizza

Contributions are welcome and genuinely appreciated. CheezyPizza is a small open-source project and every bit of help — whether it's a bug fix, a new feature, a test, or just trying to self-host it and reporting what broke — makes a real difference.

## Where help is needed most

These are the areas where the project could use the most attention. If you're not sure where to start, pick one of these:

**Writing tests** — test coverage is thin as it is a forked repo. Unit tests for the transfer logic, message parsing, chunk handling, hash verification, and resume behaviour would be extremely valuable. Integration tests that simulate a full upload/download cycle would be even better. E2E tests are also welcome.

**Browser compatibility** — WebRTC and OPFS behaviour varies meaningfully across browsers. Testing file transfers (especially large files, multi-file transfers, pause/resume, and the streaming fallback path) on Chrome, Firefox, Safari, and mobile browsers and reporting or fixing edge cases is very helpful.

**Self-hosting and Docker** — if you try to self-host CheezyPizza and hit issues with the setup, configuration, Redis connection, TURN server, or anything else, please open an issue. Documentation and tooling around self-hosting (including a working Dockerfile and docker-compose setup) is an area that needs work.

## Getting started

```bash
git clone https://github.com/hariharjeevan/cheezypizza
cd cheezypizza
pnpm install
cp .env.example .env.local  # fill in your values
pnpm dev
```

## Before opening a pull request

**Run the formatter.** The project uses Prettier. Make sure your code is formatted before committing:

```bash
pnpm format
```

**Run the linter.**

```bash
pnpm lint:check
```

Fix any errors before submitting. Warnings should be addressed where reasonable.

**Run the tests.** If there are existing tests covering the area you changed, make sure they pass:

```bash
pnpm test
```

If you're adding a feature or fixing a bug, add a test for it if at all possible. Even a basic unit test for the changed function is better than nothing.

**Keep the diff focused.** Only change what is directly related to your fix or feature. Don't reformat unrelated files, rename unrelated variables, or refactor neighbouring code in the same PR. Focused diffs are easier to review and faster to merge.

**Don't break the transfer.** CheezyPizza's core job is getting files from one browser to another reliably. If your change touches anything in the upload, download, chunking, or WebRTC path, manually test a transfer before submitting — ideally across two different browser tabs, and ideally with a file large enough to exercise chunking.

## Opening an issue

If you've found a bug, please include:

- Browser and OS
- Whether you're on the hosted version or self-hosting
- Steps to reproduce
- What you expected vs what happened
- Console errors if any

For feature requests, a brief description of the use case is more useful than just describing the feature itself.


## Code style

- TypeScript everywhere - no `any` unless genuinely unavoidable
- Avoid large comments if possible
- No new dependencies without discussion - keep the bundle lean

## Questions

Open an issue and tag it `question`. There's no mailing list or Discord — GitHub issues is the right place.