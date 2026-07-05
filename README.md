# Chat Server API

Node.js + TypeScript backend API using Express, MySQL, and Firebase Authentication.

The database schema stays based on the ERD tables:

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

Firebase Authentication is the source of identity. `USER.id` and every `user_id` column use the Firebase UID string after migration `002_firebase_uid_and_sync_ready.sql`.

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
copy .env.example .env
```

Start MySQL:

```bash
docker compose up -d
```

Apply migrations in PowerShell:

```powershell
Get-Content .\database\migrations\001_init.sql | docker exec -i chat-server-mysql mysql -u chat_api -pchat_api_password chat_server
Get-Content .\database\migrations\002_firebase_uid_and_sync_ready.sql | docker exec -i chat-server-mysql mysql -u chat_api -pchat_api_password chat_server
Get-Content .\database\migrations\003_agents_and_hydrated_inventory.sql | docker exec -i chat-server-mysql mysql -u chat_api -pchat_api_password chat_server
Get-Content .\database\migrations\004_versioned_sync_and_play_stats.sql | docker exec -i chat-server-mysql mysql -u chat_api -pchat_api_password chat_server
Get-Content .\database\migrations\005_skin_material_primary_key.sql | docker exec -i chat-server-mysql mysql -u chat_api -pchat_api_password chat_server
Get-Content .\database\migrations\006_remove_skin_table_utc_and_float_patterns.sql | docker exec -i chat-server-mysql mysql -u chat_api -pchat_api_password chat_server
```

Start the backend:

```bash
npm run dev
```

The API listens on `http://localhost:3000` by default.

## Environment

`.env.example` contains:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=chat_api
DB_PASSWORD=chat_api_password
DB_NAME=chat_server
DB_CONNECTION_LIMIT=10

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

DEV_AUTH_BYPASS=true
DEV_AUTH_USER_ID=local-dev-user
ALLOW_DEV_USER_ROUTES=true
```

Production requests use:

```http
Authorization: Bearer <firebase_id_token>
```

Local development can use the dev bypass only when `NODE_ENV` is not `production`, `DEV_AUTH_BYPASS=true`, the request comes from localhost, and no `Authorization` header is present. If `Authorization: Bearer <firebase_id_token>` is sent, Firebase auth is always used.

## Auth Sync

Sync creates the current authenticated user and base template data if missing:

- `USER`
- empty `USER_SETTINGS`
- zeroed `USER_GENERIC_STATS`
- zeroed `USER_PLAY_STATS`
- five default `USER_LOADOUT` rows
- one owned `WEAPON` instance for each default weapon
- one owned `MELEE` instance for `Default CT`
- owned `THROWABLE` instances for `grenade` and `impact-grenade`
- one owned `AGENT` instance for `default`
- default loadout assignments for M4A1, 45 ACP, Default CT, Grenade, and Default Agent
- `user_versions` for versioned sync

The endpoint is idempotent and versioned:

```http
POST /auth/sync
```

cmd.exe curl example:

```bat
curl -X POST http://localhost:3000/auth/sync ^
  -H "Content-Type: application/json" ^
  -H "X-Dev-User-Id: local-dev-user" ^
  -d "{\"username\":\"Arda\",\"email\":\"arda@test.com\",\"versions\":{\"settings\":0,\"genericStats\":0,\"playStats\":0,\"loadout\":0,\"inventory\":0}}"
```

PowerShell example:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/auth/sync `
  -Headers @{ "X-Dev-User-Id" = "local-dev-user" } `
  -ContentType "application/json" `
  -Body '{"username":"Arda","email":"arda@test.com","versions":{"settings":0,"genericStats":0,"playStats":0,"loadout":0,"inventory":0}}'
```

Example response:

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
    "genericStats": {},
    "playStats": {},
    "loadout": [],
    "inventory": []
  }
}
```

If a client version matches the server version, that section is omitted from `data`. If all versions match, the response has `data: {}`. Inventory version mismatch returns the full hydrated inventory, not a delta.

## Protected `/me` Examples

Use the dev bypass header locally:

```powershell
$headers = @{ "X-Dev-User-Id" = "local-dev-user" }
```

Get the synced profile:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/me -Headers $headers
```

Get inventory:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/me/items -Headers $headers
```

Get settings:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/me/settings -Headers $headers
```

Update settings:

```powershell
Invoke-RestMethod `
  -Method Put `
  -Uri http://localhost:3000/me/settings `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"settings":{"volume":80,"language":"en"}}'
```

Get play stats:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/me/play-stats -Headers $headers
```

Patch play stats:

```powershell
Invoke-RestMethod `
  -Method Patch `
  -Uri http://localhost:3000/me/play-stats `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"kills":11,"wins":3}'
```

Patch generic stats:

```powershell
Invoke-RestMethod `
  -Method Patch `
  -Uri http://localhost:3000/me/generic-stats `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"xp":1400,"last_online":"2026-07-05"}'
```

Get loadouts:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/me/loadouts -Headers $headers
```

Add a weapon item:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/me/items `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"item_type":"weapon","details":{"weapon_id":"m4a1","skin_id":12,"description":"M4A1 Fade","pattern_x":0.125,"pattern_y":0.75,"pattern_z":0.5},"acquired_at":"2026-07-05T14:30:00Z"}'
```

Delete an inventory item:

```powershell
Invoke-RestMethod `
  -Method Delete `
  -Uri http://localhost:3000/me/items/123 `
  -Headers $headers
```

Expected after `POST /auth/sync`:

- `/me/items` returns hydrated default weapon, melee, throwable, and agent instances.
- `/me/settings` returns `{}` in the `settings` field.
- `/me/play-stats` returns zeroed stats.
- `/me/loadouts` returns five default loadouts with default item IDs assigned.
- vanilla weapon/melee items use `skin_id = -1`.

## Postman Checks

Use this local development header on protected requests:

```http
X-Dev-User-Id: local-dev-user
```

### 1. Sync

`POST http://localhost:3000/auth/sync`

Headers:

```http
X-Dev-User-Id: local-dev-user
Content-Type: application/json
```

Body:

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

Expected:

- user exists
- settings exists
- stats exist
- five loadouts exist
- default weapons exist
- `Default CT` exists
- `Grenade` exists
- `Impact Grenade` exists
- `Default Agent` exists
- loadouts have M4A1, 45 ACP, Default CT, Grenade, and Default Agent assigned

### 2. Current User

`GET http://localhost:3000/me`

Expected: returns complete current user data.

### 3. Hydrated Inventory

`GET http://localhost:3000/me/items`

Expected: returns:

```json
{
  "items": [
    {
      "user_id": "local-dev-user",
      "item_id": 123,
      "item_type": "weapon",
      "acquired_at": "2026-07-05T14:30:00.000Z",
      "first_owner_id": "local-dev-user",
      "kind": "weapon",
      "details": {
        "item_id": 123,
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

The same response includes melee, throwable, and agent items with `kind` values of `melee`, `throwable`, and `agent`.

### 4. Loadouts

`GET http://localhost:3000/me/loadouts`

Expected: returns five loadouts with default item IDs assigned. Loadout rows include:

```json
{
  "user_id": "local-dev-user",
  "loadout_id": 0,
  "slot_index": 0,
  "primary_gun_id": 123,
  "secondary_gun_id": 124,
  "knife_id": 125,
  "throwable_id": 126,
  "agent_id": 127
}
```

### 5. User Listing

`GET http://localhost:3000/users`

Expected in development:

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

Expected in production: `403` unless an admin role system is added later.

## Skin Model

Migration `006_remove_skin_table_utc_and_float_patterns.sql` removes the separate `SKIN` table/model.

- `WEAPON.skin_id` and `MELEE.skin_id` are item-level game identifiers.
- `skin_id = -1` means vanilla or no skin.
- `pattern_x`, `pattern_y`, and `pattern_z` are `FLOAT` columns for decimal pattern values.
- No API response includes `material_name`.

## Existing Development Routes

The existing `/users/:id` routes remain for local testing.

In production they require Firebase auth and only allow access when:

```text
req.auth.uid === req.params.id
```

In development they can be opened for localhost testing with:

```env
ALLOW_DEV_USER_ROUTES=true
```

## Scripts

```bash
npm run dev
npm run build
npm test
npm start
```
