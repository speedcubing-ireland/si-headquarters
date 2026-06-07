<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

When finishing making changes - run typecheck and lint and test and if any issues arrise, ensure that there is not a better pattern that would avoid the root cause rather than a quick fix

## Tooling

- **Lint:** Oxlint with type-aware mode (`bun run lint`). Config: `.oxlintrc.json`. Convex rules use `@convex-dev/eslint-plugin` (JS plugin) plus `@trestleinc/convex-oxlint` for `explicit-table-ids`.
- **Typecheck:** `tsc` for app/node/scripts; `tsgo` (`@typescript/native-preview`) for Convex — see `convex.json` and the `typecheck` script.
- **Format:** Oxfmt (`bun run format:check`). Config: `.oxfmtrc.json`.
