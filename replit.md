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
- A WebSocket server broadcasts committed Spirit Die rolls and live Foundry
  action requests.

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
  foundry/                  Bounded Playwright login and session lifecycle
  http/                     Async route and normalized error helpers
  routes/                   Domain-specific Express routers
  storage/                  Contract plus PostgreSQL and memory adapters
  uploads/                  Safe local/R2 raster-image persistence
  scripts/                  One-off R2 migration and URL rewiring utilities
  db.ts                     Optional database connection
  routes.ts                 HTTP/WebSocket composition root
  index.ts                  Process startup and client serving

shared/
  foundry-session.ts        Secret-free Foundry control/status contract
  schema.ts                 Drizzle tables, request schemas, shared DTO types
  spirit-dice.ts            Pure Spirit Die domain rules
  mechanics.ts              Safe Foundry action model and dice grammar
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

`/ws` broadcasts committed Spirit Die rolls as live-only `spirit_die_roll`
events. After a technique roll, whether it succeeds or fails, it also broadcasts one
`foundry_action_request` for each action configured on the stored SP tier. The
server resolves the technique from storage, verifies that it belongs to the
rolling character, and never accepts mechanics in the roll request itself.
Ownership mismatches and tiers without mechanics produce no action requests.
Spirit Die rolls remain authoritative on the website; Foundry remains
authoritative for configured attack, damage, and healing rolls and renders
save-only and template-only actions without making an additional dice roll.
When the roll names a valid character-owned technique, its `spirit_die_roll`
also carries the selected tier's investment effect as bounded plain text so
Foundry can show it once in an initially collapsed, expandable section. This
also applies to tiers without configured Foundry actions.
Roll out realtime additions module-first: the updated Foundry parser accepts
older website events, while a pre-update module's strict allowlist rejects the
`investmentEffect` field and newer `roll_attack` or `place_template` action
kinds.

Each message has a top-level `protocolVersion`, UUID `eventId`, `type`, and
validated `data` payload. A Foundry action request uses this version-one shape:

```json
{
  "protocolVersion": 1,
  "eventId": "0b793756-5e97-4bdf-952e-3c897ea31e42",
  "type": "foundry_action_request",
  "data": {
    "requestedAt": "2026-07-13T12:00:01.000Z",
    "sourceRollEventId": "5c13c52f-f89d-41f5-8816-7d5ac0ab132f",
    "character": {
      "id": "2167178a-df9f-4f08-8d94-05b342dfcef1",
      "name": "R'aan Fames",
      "path": "Path of Gluttony",
      "level": 9,
      "portraitUrl": null,
      "spiritualArtsDc": 16
    },
    "technique": {
      "id": "6a4b7b9d-cbf7-4e41-8110-294a9036cfa0",
      "name": "Devour Essence"
    },
    "spInvestment": 2,
    "action": {
      "id": "523240f5-7433-4e0b-876c-c209ad3b310a",
      "kind": "roll_damage",
      "formula": "2d8 + 4",
      "damageType": "necrotic",
      "label": "Devour Essence",
      "savingThrow": { "ability": "dex" },
      "template": { "type": "circle", "distance": 20 }
    }
  }
}
```

Mechanics remain inside the existing JSONB `spEffects` value, so this feature
does not need a database migration. Version 5 permits at most ten strict attack,
damage, healing, save-only, or template-only actions per tier. Damage actions
require one of the allowlisted damage types; healing actions reject a damage
type. Save-only
actions require a saving throw and reject formula and damage-type fields.
Attack actions contain only their ID and optional label because their roll is
always derived as `1d20 + Spiritual Arts attack modifier`; they reject custom
formulas, saves, damage types, and templates. Action IDs are UUIDs and must be
unique within the tier. Template-only actions require measured-template
geometry and reject formulas, damage types, and saving throws. Optional labels
are trimmed and limited to 255 characters. Supported damage types are acid,
bludgeoning, cold, fire, force,
lightning, necrotic, piercing, poison, psychic, radiant, slashing, and thunder.
Legacy version 1 through 4 blocks remain readable and are normalized to version
5. Version 2 introduced saving throws and measured templates on dice rolls;
version 3 added save-only actions; version 4 added Spiritual Arts attack rolls;
version 5 adds template-only placement prompts.
Actions may optionally name a Strength, Dexterity, Constitution, Intelligence,
Wisdom, or Charisma saving throw and attach one measured template. The server
derives `spiritualArtsDc` from the rolling character's level and saved highest
ability score whenever an action names a save; it is `null` when that score has
not been configured and is omitted from actions without saves. Templates
support circles, cones, rectangles, and rays with bounded distances in feet;
cones also define an angle and rays define a width. These fields inform the
Foundry chat card and template placement only—they do not select targets,
resolve saves, or apply damage or healing automatically.
Template-only actions omit `spiritualArtsDc` and show no save information.
For attack actions the server derives `spiritualArtsAttackModifier` from the
same saved ability-score modifier plus the character's level-based proficiency
bonus. Foundry constructs the d20 formula from that bounded server value rather
than accepting a client-authored attack formula. A missing saved ability score
produces an informational unavailable-modifier card instead of an incorrect
unmodified attack roll.

Formulas are raw-length limited to 200 characters and use only unsigned integer
or `NdM` terms joined by `+` or `-`; unary signs, parentheses, functions,
modifiers, `@` references, and macros are rejected. There may be at most 50
terms and 100 total dice. A dice term permits 1-100 dice with 2-1,000 faces, and
an integer constant may be 0-1,000,000.

The server does not retain or replay a backlog, so consumers receive only events
sent while they are connected. There are no acknowledgements: the website
cannot distinguish an offline bridge from a delivered command, and delivery is
not guaranteed. Consumers should reject unknown versions and use `eventId` for
duplicate suppression. Website browser clients continue to parse only
`spirit_die_roll` and silently ignore action events.

## Session-bound Foundry browser

The DM page controls one Foundry browser session in either `agent` (recommended)
or `local` mode. Both paths report ready only after Foundry loads the exact
dedicated user, reaches `game.ready`, and verifies the active
`spiritual-arts-foundry` module and its configured bridge-user setting. This
does not prove that the module's separate public `/ws` roll socket connected:
that realtime protocol still has no application-level acknowledgement or replay
queue, so diagnose roll delivery separately after the session reports ready.

Connect is idempotent. Disconnect cancels startup or closes the browser, and a
hard `FOUNDRY_SESSION_MAX_MINUTES` lease (eight hours by default) applies at the
website and remote agent. A failure, expiry, or restart never starts Chromium
again automatically.

The start/stop API requires `FOUNDRY_CONTROL_PASSWORD`, exchanged for a
process-local short-lived HttpOnly/SameSite cookie. Mutations also need a
same-origin control header and failed logins are throttled. Infrastructure mode
and agent availability remain redacted until that control authorization succeeds;
agent identity, token, Foundry URL, and access key are never returned. A deploy
invalidates existing control cookies.

### Foundry world setup

1. Create a dedicated Foundry user with a unique name and access key. Give it
   only the role and permissions the roll bridge needs.
2. Enable the Spiritual Arts module in the world.
3. In module settings, select that user as **Bridge User**, then reload the world.
4. Keep the Foundry world launched so its Join Game page remains reachable.

### Remote Zima agent mode (recommended)

The lightweight agent keeps one outbound authenticated WebSocket open to
`/ws/foundry-agent`. It consumes negligible idle CPU and does not launch
Chromium until the DM clicks Connect. The website sends a bounded start command,
receives progress/readiness, and sends a stop command on Disconnect, expiry, or
shutdown. No home-network port forwarding is needed.

Configure these server-only variables on Render:

```dotenv
FOUNDRY_SESSION_MODE=agent
FOUNDRY_AGENT_ID=zima-home
FOUNDRY_AGENT_TOKEN=a-unique-64-character-hexadecimal-random-secret
FOUNDRY_BRIDGE_USER=Website Bridge
FOUNDRY_CONTROL_PASSWORD=a-separate-long-random-password
FOUNDRY_SESSION_MAX_MINUTES=480
```

Use the exact same agent ID, agent token, and bridge-user spelling in the Zima
agent. Generate the required 64-character hexadecimal token with
`openssl rand -hex 32` rather than reusing either password. Agent mode does not require
`FOUNDRY_WORLD_URL` or `FOUNDRY_BRIDGE_ACCESS_KEY` on Render; the Foundry
credentials remain on Zima.

The agent control hub and roll clients are process-local, so production must run
exactly one website instance. Adding replicas would require shared routing/state
before a control command and roll request could safely land on different nodes.

### Local browser mode (compatibility fallback)

```dotenv
FOUNDRY_SESSION_MODE=local
FOUNDRY_WORLD_URL=https://your-foundry-host.example/join
FOUNDRY_BRIDGE_USER=Website Bridge
FOUNDRY_BRIDGE_ACCESS_KEY=a-foundry-user-access-key
FOUNDRY_CONTROL_PASSWORD=a-separate-long-random-password
FOUNDRY_SESSION_MAX_MINUTES=480
FOUNDRY_HEADLESS=true
FOUNDRY_DISABLE_CANVAS=true
```

The URL, bridge user, and access key are required together. Production URLs must
use HTTPS without embedded credentials; a cross-origin redirect is rejected
before the key is entered. Session limits are bounded to 15-1440 minutes.
Canvas is disabled by default through Foundry's `core.noCanvas` preference and
Chromium uses a 1366x768 viewport. Set `FOUNDRY_DISABLE_CANVAS=false` or
`FOUNDRY_HEADLESS=false` only for local diagnosis; headed mode is rejected in
production. Install the local browser once with `npx playwright install chromium`.

When `FOUNDRY_SESSION_MODE` is omitted, agent ID/token values select agent mode;
otherwise the legacy world URL/access-key pair selects local mode. Leaving all
Foundry values blank disables the feature.

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
FOUNDRY_WORLD_URL=
FOUNDRY_BRIDGE_USER=
FOUNDRY_BRIDGE_ACCESS_KEY=
FOUNDRY_CONTROL_PASSWORD=
FOUNDRY_SESSION_MAX_MINUTES=480
FOUNDRY_HEADLESS=true
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
  DM-character isolation/deletion, technique-mechanics round trips and
  rejection, card-state conflicts, and API 404s.
- Foundry formula/action bounds, strict realtime envelopes, successful stored
  action broadcasting, failure gating, ownership checks, and distinct event IDs.
- Upload signature detection, path-traversal prevention, and partial-R2-config
  rejection.
- Foundry configuration bounds, control-password sessions/throttling, protected
  API routes, Playwright login verification, cancellation cleanup, idempotent
  lifecycle control, expiry, crashes, and shutdown.

## Current limitations

- There is no general application authentication layer. The DM identity and
  technique preference identity are local browser IDs, not security boundaries.
  The Foundry start/stop controls have their own narrow server-side password,
  but it does not protect the rest of the DM workspace. Do not expose private
  campaign data publicly without adding full authentication and ownership checks.
- The WebSocket is a public server-to-client stream. Do not add automatic HP
  changes or other state-changing Foundry actions until strong authentication
  and authorization protect both the website commands and their recipients.
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
