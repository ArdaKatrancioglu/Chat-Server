# Chat Server API

Node.js + TypeScript backend API using Express and MySQL.

The database schema is defined in `database/migrations/001_init.sql` and keeps the ERD table and column names unchanged.

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Start MySQL:

```bash
docker compose up -d
```

Run the SQL migration:

```bash
docker compose exec -T mysql mysql -u chat_api -pchat_api_password chat_server < database/migrations/001_init.sql
```

Start the API in development mode:

```bash
npm run dev
```

The API listens on `http://localhost:3000` by default.

## Scripts

```bash
npm run dev
npm run build
npm start
```

## Example Requests

Health:

```bash
curl http://localhost:3000/health
```

Create a user:

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"id":1,"username":"arda","email":"arda@example.com"}'
```

Get a user:

```bash
curl http://localhost:3000/users/1
```

Update a user:

```bash
curl -X PATCH http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"username":"arda2"}'
```

Set user settings:

```bash
curl -X PUT http://localhost:3000/users/1/settings \
  -H "Content-Type: application/json" \
  -d '{"settings":{"volume":80,"language":"en"}}'
```

Set generic stats:

```bash
curl -X PUT http://localhost:3000/users/1/generic-stats \
  -H "Content-Type: application/json" \
  -d '{"created_at":"2026-07-05","last_online":"2026-07-05","xp":1200}'
```

Set play stats:

```bash
curl -X PUT http://localhost:3000/users/1/play-stats \
  -H "Content-Type: application/json" \
  -d '{"kills":10,"deaths":3,"matches_played":4,"wins":2,"losses":2,"damage_dealt":1500,"damage_taken":900,"healing_done":120,"headshots":4,"headshot_rate":0.4,"shots_fired":100,"shots_hit":38,"playtime_seconds":3600}'
```

Patch play stats:

```bash
curl -X PATCH http://localhost:3000/users/1/play-stats \
  -H "Content-Type: application/json" \
  -d '{"kills":11,"wins":3}'
```

Create a loadout:

```bash
curl -X POST http://localhost:3000/users/1/loadouts \
  -H "Content-Type: application/json" \
  -d '{"loadout_id":1,"slot_index":0,"primary_gun_id":100,"secondary_gun_id":101,"knife_id":200,"throwable_id":300}'
```

Create a user item:

```bash
curl -X POST http://localhost:3000/users/1/items \
  -H "Content-Type: application/json" \
  -d '{"item_id":100,"item_type":1,"acquired_at":"2026-07-05","first_owner_id":1}'
```

Create a weapon:

```bash
curl -X POST http://localhost:3000/weapons \
  -H "Content-Type: application/json" \
  -d '{"item_id":100,"weapon_id":"rifle_01","skin_id":10,"description":"Starter rifle","pattern_x":1,"pattern_y":2,"pattern_z":3}'
```

Create a melee item:

```bash
curl -X POST http://localhost:3000/melee \
  -H "Content-Type: application/json" \
  -d '{"item_id":200,"melee_id":"knife_01","skin_id":10,"description":"Starter knife","pattern_x":1,"pattern_y":2,"pattern_z":3}'
```

Create a throwable:

```bash
curl -X POST http://localhost:3000/throwables \
  -H "Content-Type: application/json" \
  -d '{"item_id":300,"throwable_id":"grenade_01","description":"Starter grenade"}'
```

Create a skin:

```bash
curl -X POST http://localhost:3000/skins \
  -H "Content-Type: application/json" \
  -d '{"skin_id":10,"material_name":1,"finish_name":2}'
```
