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
- `SKIN`

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

Local development can use the dev bypass only when `NODE_ENV` is not `production`, `DEV_AUTH_BYPASS=true`, and the request comes from localhost.

## Auth Sync

Sync creates the current authenticated user and base template data if missing:

- `USER`
- empty `USER_SETTINGS`
- zeroed `USER_GENERIC_STATS`
- zeroed `USER_PLAY_STATS`
- five default `USER_LOADOUT` rows
- vanilla `SKIN` with `skin_id = 0`
- one owned `WEAPON` instance for each default weapon
- one owned `MELEE` instance for `Default CT`
- owned `THROWABLE` instances for `grenade` and `impact-grenade`
- one owned `AGENT` instance for `default`
- default loadout assignments for M4A1, 45 ACP, Default CT, Grenade, and Default Agent

The endpoint is idempotent:

```http
POST /auth/sync
```

cmd.exe curl example:

```bat
curl -X POST http://localhost:3000/auth/sync ^
  -H "Content-Type: application/json" ^
  -H "X-Dev-User-Id: local-dev-user" ^
  -d "{\"username\":\"Arda\",\"email\":\"arda@test.com\"}"
```

PowerShell example:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/auth/sync `
  -Headers @{ "X-Dev-User-Id" = "local-dev-user" } `
  -ContentType "application/json" `
  -Body '{"username":"Arda","email":"arda@test.com"}'
```

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

Get loadouts:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/me/loadouts -Headers $headers
```

Expected after `POST /auth/sync`:

- `/me/items` returns hydrated default weapon, melee, throwable, and agent instances.
- `/me/settings` returns `{}` in the `settings` field.
- `/me/play-stats` returns zeroed stats.
- `/me/loadouts` returns five default loadouts with default item IDs assigned.
- `SKIN` contains vanilla skin id `0`.

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
  "email": "arda@test.com"
}
```

Expected:

- user exists
- settings exists
- stats exist
- five loadouts exist
- vanilla skin exists
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
      "item_type": 1,
      "acquired_at": "2026-07-05",
      "first_owner_id": "local-dev-user",
      "kind": "weapon",
      "details": {
        "item_id": 123,
        "weapon_id": "M4A1",
        "skin_id": 0,
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
npm start
```
