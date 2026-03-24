# CLAUDE.md

## Project Overview

Pixel War — a multiplayer r/place-style game. Players use their phones to place colored pixels on a shared canvas displayed on a big screen. Inspired by CDawgVA's pixel wars.

## Commands

- `npm install` — install dependencies
- `npm start` — start the server (`node server.js`)
- `npm run dev` — start with auto-reload (`node --watch server.js`)

No test suite, no linter, no build step. Everything is vanilla HTML/CSS/JS served as static files.

## Architecture

```
Phone (controller/) ---WebSocket---> server.js ---WebSocket---> Big screen (game/)
```

- **`server.js`** — Express + `ws` server. Authoritative state: canvas (200×200 grid), players, teams, cooldowns, leaderboard. Serves both frontends as static files.
- **`controller/`** — Mobile-first UI. Join screen (pseudo + reconnect ID), then pixel canvas + color palette + team management. Emits `join`, `reconnect`, `placePixel`, `createTeam`, `joinTeam`, `leaveTeam`, `setOverlay`.
- **`game/`** — Display-only page for the projector/TV. Shows canvas, leaderboard (alternates individual/team), QR code. No user interaction.

## WebSocket Protocol

All messages are JSON: `{ type, data }`.

| type | Direction | data |
|------|-----------|------|
| `join` | controller → server | `{ pseudo }` |
| `reconnect` | controller → server | `{ playerId }` |
| `joined` | server → controller | `{ playerId, pseudo, cooldown, palette, canvasSize }` |
| `placePixel` | controller → server | `{ x, y, color }` |
| `pixelPlaced` | server → controller | `{ x, y, color, cooldown, nextPlacement }` |
| `pixelUpdate` | server → all | `{ x, y, color, playerId }` |
| `createTeam` | controller → server | `{ name, color }` |
| `joinTeam` | controller → server | `{ teamId }` |
| `leaveTeam` | controller → server | `{}` |
| `teamJoined` | server → controller | `{ teamId, team }` |
| `teamsUpdate` | server → all | teams object |
| `leaderboard` | server → all | `{ individual, teams }` |
| `init` | server → new client | full state |
| `state` | server → all | full state (periodic) |
| `error` | server → controller | `{ message }` |
| `cooldownError` | server → controller | `{ message, remaining }` |

## Configuration

All constants are at the top of `server.js`:

| Constant | Default | Description |
|----------|---------|-------------|
| `CANVAS_WIDTH` | 200 | Canvas width in pixels |
| `CANVAS_HEIGHT` | 200 | Canvas height in pixels |
| `DEFAULT_COOLDOWN` | 30s | Base cooldown between pixel placements |
| `COLOR_PALETTE` | 20 colors | Available colors for players |

## Key Design Decisions

- State is server-authoritative: clients never modify the canvas locally.
- Players get a 5-character reconnection ID (no accounts needed).
- Canvas is a 2D array `[y][x]` of hex colors or null.
- `pixelUpdate` broadcasts single pixel changes (lightweight). `state` broadcasts full canvas (heavy, used on connect/reconnect).
- Leaderboard counts pixels currently owned on the canvas (last placer wins).
- Teams are dynamic: any player can create or join one.
- Team overlays (templates) are stored server-side and sent to team members.