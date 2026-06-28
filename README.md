# Floss Collection

A simple embroidery floss inventory manager with a Node.js API, SQLite database, and PatternFly React UI.

## Features

- Store floss by **number**, **type** (default DMC), and **quantity**
- Add, list, filter, subtract, and remove flosses via UI and REST API
- Duplicate floss (same number + type) increases quantity instead of creating a duplicate row
- Subtract quantity when using floss; depleting stock removes the entry (with confirmation)
- Destructive delete requires explicit confirmation in the UI and API
- Toast notifications for every action
- systemd unit for running as a daemon on Fedora Linux

## Quick start

### Development

```bash
npm install
npm run dev
```

- API: http://localhost:3000
- UI (dev): http://localhost:5173

### Production (Linux server)

```bash
npm install
npm run build
PORT=3000 npm start
```

Open http://your-server:3000 — the Node server serves both the API and the built UI.

### Fedora systemd daemon

From the project directory on the target server:

```bash
sudo ./scripts/install-systemd.sh
```

This script:

1. Installs Node.js/npm via `dnf` if needed
2. Creates a `floss-collection` system user
3. Deploys the app to `/opt/floss-collection`
4. Builds the UI and installs `/etc/floss-collection/env`
5. Enables and starts the `floss-collection.service` unit

Manage the service:

```bash
sudo systemctl status floss-collection
sudo systemctl restart floss-collection
journalctl -u floss-collection -f
```

Edit `/etc/floss-collection/env` to change `PORT` or other settings, then restart the service.

## API

All responses use this shape:

```json
{
  "success": true,
  "message": "Human-readable confirmation",
  "data": {}
}
```

### List / filter

`GET /api/flosses`

Query parameters (all optional):

| Parameter    | Description                    |
|-------------|--------------------------------|
| `number`    | Partial match on floss number  |
| `type`      | Partial match on floss type    |
| `minQuantity` | Minimum quantity filter      |

### Add (or update quantity)

`POST /api/flosses`

```json
{
  "number": "310",
  "type": "DMC",
  "quantity": 2
}
```

If `number` + `type` already exists, quantity is increased.

### Subtract quantity

`PATCH /api/flosses/:id/subtract`

```json
{
  "quantity": 1
}
```

Reduces stock by the given amount. If the subtraction would use all remaining stock, include confirmation:

```bash
curl -X PATCH 'http://localhost:3000/api/flosses/1/subtract?confirm=true' \
  -H 'Content-Type: application/json' \
  -d '{"quantity": 5, "confirm": true}'
```

### Remove entire entry

`DELETE /api/flosses/:id?confirm=true`

Also accepts `{ "confirm": true }` in the JSON body. Without confirmation, the request is rejected.

## Data

SQLite database file: `data/floss.db` (created automatically on first run).

When installed via systemd, the database lives at `/opt/floss-collection/data/floss.db`.

## Environment

| Variable   | Default | Description        |
|-----------|---------|--------------------|
| `PORT`    | `3000`  | Server listen port |
| `NODE_ENV`| —       | Set to `production` to serve the built UI |
