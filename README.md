# Chat Server API

Node.js + TypeScript backend API using Express, MySQL, Firebase Authentication, and Prisma Migrate for schema deployment.

Prisma is used here as the migration manager only. The runtime query layer still uses `mysql2` and the existing handwritten SQL services.

## Stack

- Express 5
- TypeScript
- MySQL 8
- Firebase Admin Auth
- Prisma Migrate

## Database Shape

The live schema after all migrations includes these tables:

- `USER`
- `USER_PLAY_STATS`
- `USER_SETTINGS`
- `USER_GENERIC_STATS`
- `USER_LOADOUT`
- `USER_ITEM`
- `WEAPON`
- `THROWABLE`
- `MELEE`
- `AGENT`
- `user_versions`

Important schema rules preserved by the Prisma migration history:

- Firebase UID stays the backend `user_id`
- there is no `SKIN` table in the final schema
- `WEAPON.skin_id` and `MELEE.skin_id` stay item-level game IDs
- vanilla or no-skin items use `skin_id = -1`
- `pattern_x`, `pattern_y`, and `pattern_z` are float-compatible
- `matches_played` is not stored
- `headshot_rate` is not stored
- `user_versions.user_id` is both the primary key and a foreign key to `USER.id`

## Prisma Migrate Setup

Prisma files live under:

```text
prisma/
  schema.prisma
  migrations/
    001_init/
    002_firebase_uid_and_sync_ready/
    003_agents_and_hydrated_inventory/
    004_versioned_sync_and_play_stats/
    005_skin_material_primary_key/
    006_remove_skin_table_utc_and_float_patterns/
```

Production uses:

```bash
prisma migrate deploy
```

Do not use these for production schema rollout:

- `prisma migrate dev`
- `prisma db push`
- `prisma migrate reset`

## Environment

Copy the sample file first:

```bash
cp .env.example .env
```

Sample variables:

```env
MYSQL_ROOT_PASSWORD=change_me_root
MYSQL_DATABASE=chat_server
MYSQL_USER=chat_api
MYSQL_PASSWORD=change_me_user

DATABASE_URL=mysql://chat_api:change_me_user@mysql:3306/chat_server

PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=chat_api
DB_PASSWORD=change_me_user
DB_NAME=chat_server
DB_CONNECTION_LIMIT=10

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

DEV_AUTH_BYPASS=false
DEV_AUTH_USER_ID=local-dev-user
ALLOW_DEV_USER_ROUTES=true
```

Notes:

- `DATABASE_URL` is used by Prisma.
- `DB_*` values are used by the runtime `mysql2` pool.
- In Docker Compose, the backend overrides the runtime host to `mysql`.
- For host-side local development, `DB_HOST=localhost` works with the exposed MySQL port.

## Quick Start

### Fresh server deployment

On a fresh machine, the intended production flow is:

```bash
cp .env.example .env
# edit .env
docker compose up -d --build
```

What happens:

1. MySQL starts.
2. MySQL becomes healthy.
3. Backend starts after MySQL health is ready.
4. `prisma migrate deploy` applies pending migrations.
5. The API starts on `PORT`.

Useful commands:

```bash
docker compose logs -f backend
docker compose logs -f mysql
docker compose down
docker compose down -v
docker compose run --rm backend npx prisma migrate deploy
```

### Local development

Install dependencies:

```bash
npm install
```

Run MySQL:

```bash
docker compose up -d mysql
```

Start the API:

```bash
npm run dev
```

Build for production-style output:

```bash
npm run build
npm start
```

## Existing Database Baselining

For a fresh server, `docker compose up -d --build` is the normal path and should apply all Prisma migrations automatically.

If you already have an existing database where the old manual SQL migrations were applied before Prisma was introduced, you may need to mark those Prisma migrations as already applied once.

Command pattern:

```bash
npx prisma migrate resolve --applied 001_init
npx prisma migrate resolve --applied 002_firebase_uid_and_sync_ready
npx prisma migrate resolve --applied 003_agents_and_hydrated_inventory
npx prisma migrate resolve --applied 004_versioned_sync_and_play_stats
npx prisma migrate resolve --applied 005_skin_material_primary_key
npx prisma migrate resolve --applied 006_remove_skin_table_utc_and_float_patterns
```

Docker equivalent:

```bash
docker compose run --rm backend npx prisma migrate resolve --applied 001_init
docker compose run --rm backend npx prisma migrate resolve --applied 002_firebase_uid_and_sync_ready
docker compose run --rm backend npx prisma migrate resolve --applied 003_agents_and_hydrated_inventory
docker compose run --rm backend npx prisma migrate resolve --applied 004_versioned_sync_and_play_stats
docker compose run --rm backend npx prisma migrate resolve --applied 005_skin_material_primary_key
docker compose run --rm backend npx prisma migrate resolve --applied 006_remove_skin_table_utc_and_float_patterns
```

Use this only for already-migrated databases, not for new deployments.

## Authentication

Production requests use:

```http
Authorization: Bearer <firebase_id_token>
```

Local development can use the dev bypass when:

- `NODE_ENV` is not `production`
- `DEV_AUTH_BYPASS=true`
- the request comes from localhost
- the request does not include `Authorization`

Development header:

```http
X-Dev-User-Id: local-dev-user
```

Recommended local auth setup:

```env
DEV_AUTH_BYPASS=true
DEV_AUTH_USER_ID=local-dev-user
ALLOW_DEV_USER_ROUTES=true
```

## API Errors

All handled API errors return this JSON shape:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable message.",
    "status": 400,
    "requiredAction": "OPTIONAL_ACTION",
    "details": {}
  }
}
```

Notes:

- `error.code` is stable and machine-readable.
- `error.status` matches the HTTP status code.
- `requiredAction` is only present when the client should do something specific next.
- unexpected server failures return a generic `500 INTERNAL_SERVER_ERROR` body without stack traces.

## Sync Behavior

`POST /auth/sync` is idempotent for already registered users and creates missing baseline data:

- `USER_SETTINGS`
- `USER_GENERIC_STATS`
- `USER_PLAY_STATS`
- five `USER_LOADOUT` rows
- default `WEAPON` items
- default `MELEE` item
- default `THROWABLE` items
- default `AGENT` item
- `user_versions`

If a client version matches the server version, that section is omitted from the sync payload. If all versions match, `data` is empty.

If the Firebase token is valid but the backend user row does not exist yet, `/auth/sync` returns:

```json
{
  "error": {
    "code": "USER_NOT_REGISTERED",
    "message": "Authenticated Firebase user does not exist in the backend database. Create the user first, then call /auth/sync again.",
    "status": 409,
    "requiredAction": "CREATE_USER",
    "details": {
      "user": {
        "id": "firebase-user-2",
        "email": "player2@test.com"
      }
    }
  }
}
```

Recommended client flow:

1. Call `/auth/sync` with a Firebase token.
2. If the response is `409 USER_NOT_REGISTERED`, call `POST /users`.
3. Retry `/auth/sync`.
4. Sync proceeds normally after the user exists.

Example user creation request:

```json
{
  "id": "firebase-user-2",
  "username": "Player Two",
  "email": "player2@test.com"
}
```

## API Guide

Base URL:

```text
http://localhost:3000
```

### `GET /health`

Example request:

```bash
curl http://localhost:3000/health
```

Example response:

```json
{
  "status": "ok"
}
```

### `POST /auth/sync`

Example input:

```json
{
  "username": "Arda",
  "email": "arda@test.com",
  "versions": {
    "settings": 0,
    "genericStats": 0,
    "playStats": 0,
    "loadout": 0,
    "inventory": 0
  }
}
```

Example request:

```bash
curl -X POST http://localhost:3000/auth/sync \
  -H "Content-Type: application/json" \
  -H "X-Dev-User-Id: local-dev-user" \
  -d '{"username":"Arda","email":"arda@test.com","versions":{"settings":0,"genericStats":0,"playStats":0,"loadout":0,"inventory":0}}'
```

Example response:

```json
{
  "error": {
    "code": "USER_NOT_REGISTERED",
    "message": "Authenticated Firebase user does not exist in the backend database. Create the user first, then call /auth/sync again.",
    "status": 409,
    "requiredAction": "CREATE_USER",
    "details": {
      "user": {
        "id": "firebase-user-2",
        "email": "player2@test.com"
      }
    }
  }
}
```

Successful response after the user already exists:

```json
{
  "user": {
    "userId": "local-dev-user",
    "username": "Arda",
    "email": "arda@test.com"
  },
  "serverVersions": {
    "settings": 1,
    "genericStats": 1,
    "playStats": 1,
    "loadout": 1,
    "inventory": 1
  },
  "data": {
    "settings": {},
    "genericStats": {
      "user_id": "local-dev-user",
      "created_at": "2026-07-05T00:00:00.000Z",
      "last_online": "2026-07-05T14:30:00.000Z",
      "xp": 0
    },
    "playStats": {
      "user_id": "local-dev-user",
      "kills": 0,
      "deaths": 0,
      "wins": 0,
      "losses": 0,
      "damage_dealt": 0,
      "damage_taken": 0,
      "healing_done": 0,
      "headshots": 0,
      "shots_fired": 0,
      "shots_hit": 0,
      "playtime_seconds": 0
    },
    "loadout": [],
    "inventory": []
  }
}
```

### `GET /me`

Example request:

```bash
curl http://localhost:3000/me -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
{
  "user": {
    "id": "local-dev-user",
    "username": "Arda",
    "email": "arda@test.com"
  },
  "settings": {
    "user_id": "local-dev-user",
    "settings": {}
  },
  "genericStats": {
    "user_id": "local-dev-user",
    "created_at": "2026-07-05T00:00:00.000Z",
    "last_online": "2026-07-05T14:30:00.000Z",
    "xp": 0
  },
  "playStats": {
    "user_id": "local-dev-user",
    "kills": 0,
    "deaths": 0,
    "wins": 0,
    "losses": 0,
    "damage_dealt": 0,
    "damage_taken": 0,
    "healing_done": 0,
    "headshots": 0,
    "shots_fired": 0,
    "shots_hit": 0,
    "playtime_seconds": 0
  },
  "loadouts": [],
  "items": []
}
```

### `GET /me/settings`

Example request:

```bash
curl http://localhost:3000/me/settings -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "settings": {
    "volume": 80,
    "language": "en"
  }
}
```

### `PUT /me/settings`

Example input:

```json
{
  "settings": {
    "volume": 80,
    "language": "en"
  }
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "settings": {
    "volume": 80,
    "language": "en"
  }
}
```

### `GET /me/generic-stats`

Example request:

```bash
curl http://localhost:3000/me/generic-stats -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "created_at": "2026-07-05T00:00:00.000Z",
  "last_online": "2026-07-05T14:30:00.000Z",
  "xp": 1400
}
```

### `PUT /me/generic-stats`

Example input:

```json
{
  "created_at": "2026-07-05",
  "last_online": "2026-07-05T14:30:00Z",
  "xp": 1400
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "created_at": "2026-07-05T00:00:00.000Z",
  "last_online": "2026-07-05T14:30:00.000Z",
  "xp": 1400
}
```

### `PATCH /me/generic-stats`

Example input:

```json
{
  "xp": 1500,
  "last_online": "2026-07-05T16:00:00Z"
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "created_at": "2026-07-05T00:00:00.000Z",
  "last_online": "2026-07-05T16:00:00.000Z",
  "xp": 1500
}
```

### `GET /me/play-stats`

Example request:

```bash
curl http://localhost:3000/me/play-stats -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "kills": 11,
  "deaths": 4,
  "wins": 3,
  "losses": 1,
  "damage_dealt": 4200,
  "damage_taken": 2500,
  "healing_done": 150,
  "headshots": 6,
  "shots_fired": 300,
  "shots_hit": 120,
  "playtime_seconds": 5400
}
```

### `PUT /me/play-stats`

Example input:

```json
{
  "kills": 11,
  "deaths": 4,
  "wins": 3,
  "losses": 1,
  "damage_dealt": 4200,
  "damage_taken": 2500,
  "healing_done": 150,
  "headshots": 6,
  "shots_fired": 300,
  "shots_hit": 120,
  "playtime_seconds": 5400
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "kills": 11,
  "deaths": 4,
  "wins": 3,
  "losses": 1,
  "damage_dealt": 4200,
  "damage_taken": 2500,
  "healing_done": 150,
  "headshots": 6,
  "shots_fired": 300,
  "shots_hit": 120,
  "playtime_seconds": 5400
}
```

### `PATCH /me/play-stats`

Example input:

```json
{
  "kills": 12,
  "wins": 4
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "kills": 12,
  "deaths": 4,
  "wins": 4,
  "losses": 1,
  "damage_dealt": 4200,
  "damage_taken": 2500,
  "healing_done": 150,
  "headshots": 6,
  "shots_fired": 300,
  "shots_hit": 120,
  "playtime_seconds": 5400
}
```

### `GET /me/loadouts`

Example request:

```bash
curl http://localhost:3000/me/loadouts -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
{
  "loadouts": [
    {
      "user_id": "local-dev-user",
      "loadout_id": 0,
      "slot_index": 0,
      "primary_gun_id": 101,
      "secondary_gun_id": 102,
      "knife_id": 103,
      "throwable_id": 104,
      "agent_id": 105,
      "primary_gun": null,
      "secondary_gun": null,
      "knife": null,
      "throwable": null,
      "agent": null
    }
  ]
}
```

### `POST /me/loadouts`

Example input:

```json
{
  "loadout_id": 7,
  "slot_index": 7,
  "primary_gun_id": 101,
  "secondary_gun_id": 102,
  "knife_id": 103,
  "throwable_id": 104,
  "agent_id": 105
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "loadout_id": 7,
  "slot_index": 7,
  "primary_gun_id": 101,
  "secondary_gun_id": 102,
  "knife_id": 103,
  "throwable_id": 104,
  "agent_id": 105
}
```

### `PUT /me/loadouts/:loadoutId`

Example input:

```json
{
  "primary_gun_id": 110,
  "throwable_id": 111
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "loadout_id": 7,
  "slot_index": 7,
  "primary_gun_id": 110,
  "secondary_gun_id": 102,
  "knife_id": 103,
  "throwable_id": 111,
  "agent_id": 105
}
```

### `DELETE /me/loadouts/:loadoutId`

Example request:

```bash
curl -X DELETE http://localhost:3000/me/loadouts/7 -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```text
204 No Content
```

### `GET /me/items`

Example request:

```bash
curl http://localhost:3000/me/items -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
{
  "items": [
    {
      "user_id": "local-dev-user",
      "item_id": 101,
      "item_type": "weapon",
      "acquired_at": "2026-07-05T14:30:00.000Z",
      "first_owner_id": "local-dev-user",
      "kind": "weapon",
      "details": {
        "item_id": 101,
        "weapon_id": "M4A1",
        "skin_id": -1,
        "description": "Classic automatic rifle with balanced all-around performance.",
        "pattern_x": 0,
        "pattern_y": 0,
        "pattern_z": 0
      }
    }
  ]
}
```

### `GET /me/items/:itemId`

Example request:

```bash
curl http://localhost:3000/me/items/101 -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "item_id": 101,
  "item_type": "weapon",
  "acquired_at": "2026-07-05T14:30:00.000Z",
  "first_owner_id": "local-dev-user",
  "kind": "weapon",
  "details": {
    "item_id": 101,
    "weapon_id": "M4A1",
    "skin_id": -1,
    "description": "Classic automatic rifle with balanced all-around performance.",
    "pattern_x": 0,
    "pattern_y": 0,
    "pattern_z": 0
  }
}
```

### `POST /me/items`

Example weapon input:

```json
{
  "item_type": "weapon",
  "details": {
    "weapon_id": "m4a1",
    "skin_id": 12,
    "description": "M4A1 Fade",
    "pattern_x": 0.125,
    "pattern_y": 0.75,
    "pattern_z": 0.5
  },
  "acquired_at": "2026-07-05T14:30:00Z"
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "item_id": 150,
  "item_type": "weapon",
  "acquired_at": "2026-07-05T14:30:00.000Z",
  "first_owner_id": "local-dev-user",
  "kind": "weapon",
  "details": {
    "item_id": 150,
    "weapon_id": "m4a1",
    "skin_id": 12,
    "description": "M4A1 Fade",
    "pattern_x": 0.125,
    "pattern_y": 0.75,
    "pattern_z": 0.5
  }
}
```

### `DELETE /me/items/:itemId`

Example request:

```bash
curl -X DELETE http://localhost:3000/me/items/150 -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```text
204 No Content
```

### `GET /users`

Development-only admin listing through the dev bypass.

Example request:

```bash
curl http://localhost:3000/users -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
{
  "users": [
    {
      "id": "local-dev-user",
      "username": "Arda",
      "email": "arda@test.com"
    }
  ]
}
```

### `POST /users`

Example input:

```json
{
  "id": "firebase-user-2",
  "username": "Player Two",
  "email": "player2@test.com"
}
```

Example response:

```json
{
  "id": "firebase-user-2",
  "username": "Player Two",
  "email": "player2@test.com"
}
```

### `GET /users/:id`

Example request:

```bash
curl http://localhost:3000/users/local-dev-user -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
{
  "id": "local-dev-user",
  "username": "Arda",
  "email": "arda@test.com"
}
```

### `PATCH /users/:id`

Example input:

```json
{
  "username": "Arda Prime",
  "email": "arda.prime@test.com"
}
```

Example response:

```json
{
  "id": "local-dev-user",
  "username": "Arda Prime",
  "email": "arda.prime@test.com"
}
```

### `GET /users/:id/settings`

Example request:

```bash
curl http://localhost:3000/users/local-dev-user/settings -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "settings": {
    "volume": 80,
    "language": "en"
  }
}
```

### `PUT /users/:id/settings`

Example input:

```json
{
  "settings": {
    "volume": 60,
    "language": "de"
  }
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "settings": {
    "volume": 60,
    "language": "de"
  }
}
```

### `GET /users/:id/generic-stats`

Example request:

```bash
curl http://localhost:3000/users/local-dev-user/generic-stats -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "created_at": "2026-07-05T00:00:00.000Z",
  "last_online": "2026-07-05T16:00:00.000Z",
  "xp": 1500
}
```

### `PUT /users/:id/generic-stats`

Example input:

```json
{
  "created_at": "2026-07-05",
  "last_online": "2026-07-05T16:00:00Z",
  "xp": 1500
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "created_at": "2026-07-05T00:00:00.000Z",
  "last_online": "2026-07-05T16:00:00.000Z",
  "xp": 1500
}
```

### `GET /users/:id/play-stats`

Example request:

```bash
curl http://localhost:3000/users/local-dev-user/play-stats -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "kills": 12,
  "deaths": 4,
  "wins": 4,
  "losses": 1,
  "damage_dealt": 4200,
  "damage_taken": 2500,
  "healing_done": 150,
  "headshots": 6,
  "shots_fired": 300,
  "shots_hit": 120,
  "playtime_seconds": 5400
}
```

### `PUT /users/:id/play-stats`

Example input:

```json
{
  "kills": 20,
  "deaths": 7,
  "wins": 6,
  "losses": 2,
  "damage_dealt": 7000,
  "damage_taken": 4000,
  "healing_done": 200,
  "headshots": 9,
  "shots_fired": 500,
  "shots_hit": 210,
  "playtime_seconds": 9000
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "kills": 20,
  "deaths": 7,
  "wins": 6,
  "losses": 2,
  "damage_dealt": 7000,
  "damage_taken": 4000,
  "healing_done": 200,
  "headshots": 9,
  "shots_fired": 500,
  "shots_hit": 210,
  "playtime_seconds": 9000
}
```

### `PATCH /users/:id/play-stats`

Example input:

```json
{
  "kills": 21,
  "wins": 7
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "kills": 21,
  "deaths": 7,
  "wins": 7,
  "losses": 2,
  "damage_dealt": 7000,
  "damage_taken": 4000,
  "healing_done": 200,
  "headshots": 9,
  "shots_fired": 500,
  "shots_hit": 210,
  "playtime_seconds": 9000
}
```

### `GET /users/:id/loadouts`

Example request:

```bash
curl http://localhost:3000/users/local-dev-user/loadouts -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
[
  {
    "user_id": "local-dev-user",
    "loadout_id": 0,
    "slot_index": 0,
    "primary_gun_id": 101,
    "secondary_gun_id": 102,
    "knife_id": 103,
    "throwable_id": 104,
    "agent_id": 105
  }
]
```

### `POST /users/:id/loadouts`

Example input:

```json
{
  "loadout_id": 8,
  "slot_index": 8,
  "primary_gun_id": 101,
  "secondary_gun_id": 102,
  "knife_id": 103,
  "throwable_id": 104,
  "agent_id": 105
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "loadout_id": 8,
  "slot_index": 8,
  "primary_gun_id": 101,
  "secondary_gun_id": 102,
  "knife_id": 103,
  "throwable_id": 104,
  "agent_id": 105
}
```

### `PUT /users/:id/loadouts/:loadoutId`

Example input:

```json
{
  "secondary_gun_id": 130
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "loadout_id": 8,
  "slot_index": 8,
  "primary_gun_id": 101,
  "secondary_gun_id": 130,
  "knife_id": 103,
  "throwable_id": 104,
  "agent_id": 105
}
```

### `DELETE /users/:id/loadouts/:loadoutId`

Example request:

```bash
curl -X DELETE http://localhost:3000/users/local-dev-user/loadouts/8 -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```text
204 No Content
```

### `GET /users/:id/items`

Example request:

```bash
curl http://localhost:3000/users/local-dev-user/items -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```json
[
  {
    "user_id": "local-dev-user",
    "item_id": 101,
    "item_type": 1,
    "acquired_at": "2026-07-05T14:30:00.000Z",
    "first_owner_id": "local-dev-user"
  }
]
```

### `POST /users/:id/items`

Example input:

```json
{
  "item_type": "weapon",
  "acquired_at": "2026-07-05T14:30:00Z",
  "first_owner_id": "local-dev-user"
}
```

Example response:

```json
{
  "user_id": "local-dev-user",
  "item_id": 160,
  "item_type": 1,
  "acquired_at": "2026-07-05T14:30:00.000Z",
  "first_owner_id": "local-dev-user"
}
```

### `DELETE /users/:id/items/:itemId`

Example request:

```bash
curl -X DELETE http://localhost:3000/users/local-dev-user/items/160 -H "X-Dev-User-Id: local-dev-user"
```

Example response:

```text
204 No Content
```

### `GET /weapons`

Example request:

```bash
curl http://localhost:3000/weapons
```

Example response:

```json
[
  {
    "item_id": 101,
    "weapon_id": "M4A1",
    "skin_id": -1,
    "description": "Classic automatic rifle with balanced all-around performance.",
    "pattern_x": 0,
    "pattern_y": 0,
    "pattern_z": 0
  }
]
```

### `POST /weapons`

Example input:

```json
{
  "item_id": 201,
  "weapon_id": "AWM",
  "skin_id": -1,
  "description": "High-damage sniper rifle designed for decisive long-range hits.",
  "pattern_x": 0,
  "pattern_y": 0,
  "pattern_z": 0
}
```

Example response:

```json
{
  "item_id": 201,
  "weapon_id": "AWM",
  "skin_id": -1,
  "description": "High-damage sniper rifle designed for decisive long-range hits.",
  "pattern_x": 0,
  "pattern_y": 0,
  "pattern_z": 0
}
```

### `GET /weapons/:itemId`

Example request:

```bash
curl http://localhost:3000/weapons/201
```

Example response:

```json
{
  "item_id": 201,
  "weapon_id": "AWM",
  "skin_id": -1,
  "description": "High-damage sniper rifle designed for decisive long-range hits.",
  "pattern_x": 0,
  "pattern_y": 0,
  "pattern_z": 0
}
```

### `GET /melee`

Example request:

```bash
curl http://localhost:3000/melee
```

Example response:

```json
[
  {
    "item_id": 103,
    "melee_id": "Default CT",
    "skin_id": -1,
    "description": "Basic knife for close combat",
    "pattern_x": 0,
    "pattern_y": 0,
    "pattern_z": 0
  }
]
```

### `POST /melee`

Example input:

```json
{
  "item_id": 202,
  "melee_id": "Karambit",
  "skin_id": 55,
  "description": "Curved melee weapon.",
  "pattern_x": 0.2,
  "pattern_y": 0.4,
  "pattern_z": 0.6
}
```

Example response:

```json
{
  "item_id": 202,
  "melee_id": "Karambit",
  "skin_id": 55,
  "description": "Curved melee weapon.",
  "pattern_x": 0.2,
  "pattern_y": 0.4,
  "pattern_z": 0.6
}
```

### `GET /melee/:itemId`

Example request:

```bash
curl http://localhost:3000/melee/202
```

Example response:

```json
{
  "item_id": 202,
  "melee_id": "Karambit",
  "skin_id": 55,
  "description": "Curved melee weapon.",
  "pattern_x": 0.2,
  "pattern_y": 0.4,
  "pattern_z": 0.6
}
```

### `GET /throwables`

Example request:

```bash
curl http://localhost:3000/throwables
```

Example response:

```json
[
  {
    "item_id": 104,
    "throwable_id": "grenade",
    "description": "Basic grenade that goes boom"
  }
]
```

### `POST /throwables`

Example input:

```json
{
  "item_id": 203,
  "throwable_id": "smoke",
  "description": "Area denial grenade."
}
```

Example response:

```json
{
  "item_id": 203,
  "throwable_id": "smoke",
  "description": "Area denial grenade."
}
```

### `GET /throwables/:itemId`

Example request:

```bash
curl http://localhost:3000/throwables/203
```

Example response:

```json
{
  "item_id": 203,
  "throwable_id": "smoke",
  "description": "Area denial grenade."
}
```

### `GET /agents`

Example request:

```bash
curl http://localhost:3000/agents
```

Example response:

```json
[
  {
    "item_id": 105,
    "agent_id": "default",
    "description": "Default playable agent"
  }
]
```

### `POST /agents`

Example input:

```json
{
  "item_id": 204,
  "agent_id": "breacher",
  "description": "Frontline assault agent."
}
```

Example response:

```json
{
  "item_id": 204,
  "agent_id": "breacher",
  "description": "Frontline assault agent."
}
```

### `GET /agents/:itemId`

Example request:

```bash
curl http://localhost:3000/agents/204
```

Example response:

```json
{
  "item_id": 204,
  "agent_id": "breacher",
  "description": "Frontline assault agent."
}
```

## Scripts

```bash
npm run dev
npm run build
npm test
npm start
npm run db:generate
npm run db:migrate:dev
npm run db:migrate:deploy
npm run start:prod
```

## Production Notes

- `npm run start:prod` runs `prisma migrate deploy` before starting the server.
- The Compose backend service uses the same production startup path.
- Do not use `prisma migrate dev` for production rollout.
- Do not use `prisma db push` for production rollout.
- Do not use `prisma migrate reset` in production.

## Legacy SQL Migrations

The original SQL files under `database/migrations/` are intentionally kept for reference.

Prisma migration folders now mirror that history for deployment:

- `001_init`
- `002_firebase_uid_and_sync_ready`
- `003_agents_and_hydrated_inventory`
- `004_versioned_sync_and_play_stats`
- `005_skin_material_primary_key`
- `006_remove_skin_table_utc_and_float_patterns`
