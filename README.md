# Wildcard

A real-time, browser-based multiplayer card game (2–10 players) built around
color/number matching, action cards, and wild cards. Create or join a table with
a room code, play synchronously, and see every move update live. No installs,
no accounts required — link, join, play.

## Quick start

```bash
pnpm install
pnpm dev:server   # starts the backend on port 3001
pnpm dev:client   # starts the frontend on port 5173
```

## Project structure

```
packages/
├── shared/    # types + pure game engine — imported by both client and server
├── server/    # Node/TypeScript backend (Fastify + Socket.IO)
└── client/    # React/Vite frontend
```

## Commands

| Command | Description |
|---|---|
| `pnpm build` | Build all packages |
| `pnpm dev:server` | Start the backend in watch mode |
| `pnpm dev:client` | Start the frontend dev server |
| `pnpm test` | Run tests across all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint all packages |
