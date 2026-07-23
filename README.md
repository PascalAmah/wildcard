# Wildcard

A real-time, browser-based multiplayer card game (2–10 players) built around
color/number matching, action cards, and wild cards. Create or join a table with
a room code, play synchronously, and see every move update live. No installs,
no accounts required — link, join, play.

## How to play

### Objective
Be the first player to empty your hand. When you play your last card, you win
the round and score points equal to the total value of the cards left in
everyone else's hands.

### On your turn
Play a card that matches the top card on the discard pile by **color**,
**number**, or **symbol** (Skip, Reverse, Draw Two). If you can't play, click
the draw pile — a card is added to your hand and your turn passes.

### Action cards
| Card | Effect |
|------|--------|
| ⊘ Skip | The next player loses their turn |
| \u21C4 Reverse | Reverses the direction of play |
| +2 Draw Two | The next player draws 2 cards and loses their turn |
| \u2605 Wild | Play on any turn and choose a color |
| +4 Wild Draw Four | Choose a color — the next player draws 4 and loses turn |

### Scoring
Cards left in hand at the end of a round score points for the winner:
- Number cards (0–9): face value
- Skip, Reverse, Draw Two: 20 points each
- Wild, Wild Draw Four: 50 points each

## Quick start

```bash
pnpm install
pnpm dev:server   # starts the backend on port 3001
pnpm dev:client   # starts the frontend on port 5173
```

Open http://localhost:5173 in your browser. Create a table or play against bots.

## Project structure

```
wildcard/
├── packages/
│   ├── shared/     # Types + pure game engine — imported by both client and server
│   │   └── src/
│   │       ├── engine/       # GameEngine, canPlay, applyEffect, turnOrder
│   │       ├── bots/          # chooseBotMove — bot AI
│   │       └── types.ts       # Card, GameState, ClientView, socket event payloads
│   ├── server/     # Node/TypeScript backend (Fastify + Socket.IO)
│   │   └── src/
│   │       ├── rooms/        # Room + RoomManager — game session orchestration
│   │       ├── sockets/       # Socket.IO event handlers (game + room)
│   │       ├── bots/          # BotScheduler — timed bot turns
│   │       └── store/         # Redis persistence for rooms
│   └── client/     # React/Vite frontend (Tailwind CSS, GSAP animations)
│       └── src/
│           ├── pages/        # Landing, Lobby, WaitingRoom, Table, Scoreboard
│           ├── components/   # Game components: Hand, DiscardPile, OpponentRow, etc.
│           ├── hooks/        # useGameState, useSocket, useHaptics
│           └── lib/          # socketClient, gsapConfig
├── logo/          # Favicons and app icons
├── docs/          # Mockups, task list, build plan
├── render.yaml    # Render.com deployment config
└── packages/
    └── server/
        └── Dockerfile
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

## Tech stack

| Layer | Technology |
|---|---|
| Client framework | React 18 + Vite |
| Styling | Tailwind CSS + CSS variables for theming |
| Animation | GSAP 3 (Flip, timeline, matchMedia) |
| Realtime | Socket.IO (WebSocket transport) |
| Server | Fastify + TypeScript |
| Persistence | Redis (via ioredis) |
| Package manager | pnpm workspaces |

## Deployment

See the deployment guide in [the task list](docs/wildcard-tasks.md).

The server can be deployed to Render (Docker or Node), the client to Vercel/Netlify.
Set `VITE_SERVER_URL` to point the client at the production server.
