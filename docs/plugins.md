# Plugin Boundaries

Plugins register capabilities through a small set of compile-time registries.
Core domain modules should depend on registry-facing infrastructure, not on
individual plugin folders.

## Registries

- `convex/plugins/registry.ts` wires backend integrations, workflow plugins, and plugin-owned tables.
- `src/plugins/registry.ts` wires frontend sidebar entries and competition property rows.
- `src/plugins/integrations/registry.ts` wires linked resource UI, task integration cards, and plugin-specific display metadata.

## Import Direction

- Core backend domains (`competitions`, `projects`, `tasks`, `notifications`, `phases`, `updates`, `templates`, `users`, `impersonation`) must not import `convex/plugins/<plugin>/...`.
- Shared backend infrastructure lives in `convex/integrations/**`, `convex/projectWorkflows/**`, and `convex/access/**`; it must not import a specific plugin implementation.
- Generic frontend features and layout code must not import `src/plugins/<plugin>/...`; they should use the frontend registries.
- Generic frontend features and layout code must not call `api.plugins.<plugin>.*` directly; expose a core facade when a core feature needs a plugin-backed operation.
- Routes may import plugin pages because routes are the shell that mounts plugin-owned screens.
- Plugin implementations may import shared core infrastructure and their own plugin internals.

## Adding Plugin Capabilities

1. Add backend tables through `pluginTables`.
2. Register task integrations, linked resources, workflow definitions, notification enrichers, and frontend UI through the appropriate registry.
3. Keep plugin-specific helpers inside the plugin unless the helper is genuinely shared; shared helpers belong in `convex/`, `src/lib/`, or another core folder with a generic name.
4. Add or update a registry alignment test when templates or other core configuration reference plugin-provided IDs.
