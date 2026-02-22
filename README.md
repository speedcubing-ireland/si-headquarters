# Headquarters

Internal operations platform for Speedcubing Ireland — managing competitions, tasks, teams, sponsors, and communication workflows.

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, TanStack Router, Radix UI
- **Backend:** [Convex](https://convex.dev) (real-time database, serverless functions, auth, crons)
- **Build:** Vite (via rolldown-vite), Bun
- **Linting/Formatting:** Biome, ESLint (Convex plugin)
- **Testing:** Vitest with `convex-test` and `@edge-runtime/vm`

## Prerequisites

- [Bun](https://bun.sh) (runtime and package manager)
- A Convex project (see [Convex docs](https://docs.convex.dev))

## Getting Started

### Install dependencies

```sh
bun install
```

### Run development servers

Start both the Vite frontend and Convex backend in parallel:

```sh
bun run dev
```

Or run them individually:

```sh
bun run dev:frontend   # Vite dev server with HMR
bun run dev:backend    # Convex dev (syncs functions and schema)
```

### Build for production

```sh
bun run build
```

### Preview production build

```sh
bun run preview
```

## Testing

Tests use Vitest with the `edge-runtime` environment and `convex-test` for backend function testing. Test files live alongside source code (`convex/**/*.test.ts`, `src/**/*.test.ts`).

```sh
bun run test            # Watch mode
bun run test:once       # Single run
bun run test:coverage   # Run with coverage report
bun run test:debug      # Debug with --inspect-brk
```

## Linting and Formatting

Biome handles both linting and formatting for the frontend. ESLint with the Convex plugin covers backend functions.

```sh
bun run lint            # Biome lint + format (auto-fix)
bun run lint:convex     # ESLint for convex/ directory
bun run typecheck       # Type-check frontend and convex
```

## Scripts

| Command | Description |
|---|---|
| `bun run auth` | Run auth setup script (development) |
| `bun run auth:prod` | Run auth setup script (production) |
| `bun run openapi-ts` | Generate TypeScript clients from OpenAPI specs |

## Project Structure

```
├── convex/              # Convex backend (schema, functions, tests)
│   ├── schema.ts        # Database schema definitions
│   ├── tasks.ts         # Task management functions
│   ├── competitions.ts  # Competition management
│   ├── sponsors.ts      # Sponsor management
│   ├── teams.ts         # Team management
│   ├── notifications/   # Notification system
│   ├── emailQueue/      # Email dispatch pipeline
│   ├── sponsorship/     # Sponsorship auction system
│   ├── canva/           # Canva integration
│   └── *.test.ts        # Backend tests (behavior, security, logic)
├── src/
│   ├── components/      # React UI components
│   ├── routes/          # TanStack Router pages
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Shared utilities
│   ├── store/           # Zustand state stores
│   └── data/            # Static data
├── openapi/             # OpenAPI specs (WCA, Canva)
├── scripts/             # CLI utilities (auth setup)
└── public/              # Static assets
```

## Integrations

- **WCA (World Cube Association):** Competition data, 2FA verification, check-in sheets, schedules
- **Google Sheets:** Competition spreadsheets and schedule caching
- **Canva:** Design asset management linked to tasks
- **Azure Communication Services:** Email dispatch queue with dead-letter handling
