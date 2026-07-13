# Spiritual Arts

## Overview

Spiritual Arts is a full-stack tabletop character-sheet and card-game
application focused on Spirit Die mechanics. It includes character and
technique management, trackers, glossary tooltips with structured rich content,
portrait uploads, live roll notifications, a separate DM workspace, faction
management, and a shared card-game battlefield.

The application is deliberately deployable as one Node process:

- React 18 + Vite render the single-page client.
- Express exposes the REST API and serves the production client bundle.
- Drizzle ORM talks to PostgreSQL when `DATABASE_URL` is configured.
- A complete in-memory adapter supports local development without a database.
- A WebSocket server broadcasts committed Spirit Die rolls.

## Project layout

```text
client/src/
  components/               Shared application and shadcn UI components
  features/character-sheet/ Character-sheet panels and controllers
  features/card-game/       Card-game types, state normalization, and API logic
  features/dm/              DM resource hooks, panels, cards, and dialogs
  features/glossary/        Structured enhanced-content block UI
  hooks/                    Cross-feature React hooks
  lib/                      API client, query keys, identity, utilities
  pages/                    Route-level composition components

server/
  http/                     Async route and normalized error helpers
  routes/                   Domain-specific Express routers
  storage/                  Contract plus PostgreSQL and memory adapters
  uploads/                  Safe local/R2 raster-image persistence
  scripts/                  One-off R2 migration and URL rewiring utilities
  db.ts                     Optional database connection
  routes.ts                 HTTP/WebSocket composition root
  index.ts                  Process startup and client serving

shared/
  schema.ts                 Drizzle tables, request schemas, shared DTO types
  spirit-dice.ts            Pure Spirit Die domain rules
  enhanced-content.ts       Validated rich glossary content model
  realtime.ts               WebSocket message contract
```

## Spirit Die model

Spirit pools use stable slots. A depleted die is stored as `null`; it is never
removed from the array. For example, failing with the first die in
`["d4", "d8"]` produces `[null, "d8"]`. This prevents the second die from
shifting into the first die's UI position and inheriting the wrong maximum.

Rules and progression live in `shared/spirit-dice.ts`, where they can be used by
both client and server and tested without React or a database. Shortened legacy
arrays are treated as having depleted trailing slots when read by the client.

A character creation transaction also creates the initial level-based pool.
Changing a level updates the character and reconciles its pool in one storage
operation; overrides are cleared intentionally on a level change.

## Storage modes

### Local memory mode

If `DATABASE_URL` is absent in development, the server starts with `MemStorage`.
It synchronously loads the same default fixture used to seed an empty database.
The memory adapter implements the full storage contract, including DM resources,
preferences, trackers, users, and delete cascades.

Memory data is lost when the process exits.

### PostgreSQL mode

When `DATABASE_URL` is present, `DatabaseStorage` receives a non-null injected
Drizzle client. Startup initialization is awaited before the server listens and
seeds an empty database transactionally.

Production startup fails clearly when `DATABASE_URL` is missing instead of
silently switching to ephemeral data.

## HTTP API conventions

- Request bodies are parsed with narrow Zod schemas from `shared/schema.ts`.
- Immutable IDs, ownership keys, timestamps, and portrait paths cannot be mass
  assigned through update endpoints.
- Async errors flow through one safe JSON error handler.
- Invalid JSON returns 400; unknown `/api` routes return 404.
- Resource creation returns 201.
- API logs contain request metadata, not response bodies.

Routers are grouped by character, Spirit Die, technique/effect, glossary,
tracker, preference, upload, card-game, and DM domains under `server/routes/`.

## Production features

- Normal and DM-only characters are stored separately. DM character sheets can
  return directly to the DM workspace.
- The factions screen manages the factions used by the card game.
- The card-game screen persists one shared game state. Writes carry the version
  last read by the client, so stale saves receive a conflict instead of silently
  writing over a newer server version. Faction edits rebase their narrow changes
  onto the returned state before retrying.
- Successful and failed Spirit Die rolls can be posted to Discord when a webhook
  is configured. Technique details are only attached after the server verifies
  that the technique belongs to the rolling character.

## Upload handling

Uploads are buffered with a 5 MB limit, checked by file signature, and accepted
only as PNG, JPEG, GIF, or WebP. The server chooses a UUID filename and extension;
it never trusts the client's filename, MIME type, extension, or stored path.

All local file resolution is constrained to the relevant upload directory.
Static responses disable MIME sniffing. General character updates cannot write
a `portraitUrl`; only the portrait endpoints can do that.

When every `R2_*` setting is present, `ImageStore` uses Cloudflare R2 and stores
public object URLs. When every setting is absent, it uses local `./uploads`
storage. A partial R2 configuration is rejected at startup so a deployment
cannot silently start writing images to an ephemeral filesystem.

Card-game uploads use a separate `card-images` namespace. Automatic card cleanup
only removes objects from that namespace; legacy card images in the shared
`images` namespace are retained because other content may still reference them.

## Client data flow

- `client/src/lib/api.ts` is the single HTTP boundary.
- `client/src/lib/query-keys.ts` defines canonical TanStack Query keys.
- Server state uses finite staleness and exact invalidation/cache updates.
- Route pages are lazy-loaded into separate production chunks.
- WebSocket reconnects use bounded exponential backoff and clean up on unmount.
- Technique preferences are fetched once for the whole techniques panel.
- Scratchpad autosaves preserve dirty local drafts during background refetches.

The DM page and character-sheet page are composition roots; feature state and UI
live in their respective `features/` directories.

## Realtime integrations

`/ws` broadcasts committed Spirit Die rolls as live-only events. The server does
not retain or replay a backlog, so external consumers receive only rolls made
while they are connected. Each message has a top-level `protocolVersion`, UUID
`eventId`, `type`, and validated `data` payload. Consumers should reject unknown
protocol versions and use `eventId` for duplicate suppression.

## Commands

```bash
npm run dev       # Cross-platform development server
npm run check     # Strict TypeScript check, including unused-code checks
npm test          # Domain, storage, API, and upload tests
npm run build     # Production client and server bundles
npm run verify    # check + test + build
npm run db:push   # Push the Drizzle schema to the configured database
npm run db:harden # Apply the idempotent post-0002 production hardening migration
npm run migrate:r2 # Upload local files and rewrite stored URLs to R2
npm run rewire:r2  # Rewrite URLs after changing the R2 public base URL
npm start         # Serve the production build (DATABASE_URL required)
```

Copy `.env.example` to `.env` for local configuration. `.env` files are ignored
and must never be committed.

```dotenv
DATABASE_URL=
PORT=5000
NODE_ENV=development
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=
DISCORD_WEBHOOK_URL=
APP_PUBLIC_BASE_URL=
```

`R2_OLD_BASE_URL` is needed only while running `npm run rewire:r2`. The R2
migration scripts update character portraits, enhanced text content, and image
URLs nested inside card-game JSON. Back up the production database and object
storage before running either one-off script.

Do not run `db:push` against production as part of this source merge. After a
backup, `npm run db:harden` explicitly applies
`migrations/0003_harden_schema_constraints.sql` in one transaction. It
deduplicates legacy Spirit Die pools using the same canonical ordering as the
application, backfills the two formerly nullable values, and installs missing
constraints/indexes. Historical orphan rows are preserved; their foreign keys
remain `NOT VALID` and emit a warning until those rows are reconciled. The
checked-in historical migrations remain unchanged.

## Verification coverage

The Node test suite covers:

- Spirit Die progression, depletion, restoration, legacy normalization, and
  input validation.
- Structured glossary-content parsing and round trips.
- Complete memory-storage behavior, deterministic ordering, defensive copying,
  relationship checks, cascades, and level reconciliation.
- Real Express requests for creation, level changes, strict DTOs, malformed JSON,
  DM-character isolation/deletion, card-state conflicts, and API 404s.
- Upload signature detection, path-traversal prevention, and partial-R2-config
  rejection.

## Current limitations

- There is no real authentication layer. The DM identity and technique preference
  identity are local browser IDs, not security boundaries. Do not expose private
  campaign data publicly without adding server-side authentication and ownership
  checks.
- The card game's DM access code and the main-menu admin toggle are convenience
  UI gates, not authentication or authorization.
- The main battlefield still resolves a concurrent whole-document conflict by
  retrying its latest local state. Faction edits are field-aware, but simultaneous
  battlefield edits can still be last-writer-wins until state is split into
  smaller commands or given a full three-way merge.
- Spirit Die pool updates are transactional for level changes, but simultaneous
  roll requests do not yet use a database row lock or version column.
- Image cleanup occurs when the owning record changes, but there is no general
  orphan-reconciliation job for objects left behind by interrupted requests or
  manual database edits.
