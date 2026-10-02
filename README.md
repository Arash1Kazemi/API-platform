# API Platform

Your own private catalog of API models, prices and quality scores. It runs on your server.

- **API**: NestJS + SQLite (one file, easy to back up). In `apps/api`.
- **Website**: Next.js. In `apps/web`. It shows the price-vs-quality chart, tables, a cost planner and edit pages.
- **Starting data**: the 60 fal.ai models from the first research (`api-value-map/`), loaded automatically on first start.

## What you can do

| Page | Use |
|---|---|
| Overview | Best-value models per category, and how old the prices are |
| Category page | Chart + sortable table, search, CSV / JSON download |
| Cost planner | Choose models and monthly volume, see cost vs budget, save plans |
| Edit data | Add, change, delete models and categories (any provider, any kind of job) |
| Refresh prices | Compare your stored fal prices with fal's live prices; apply the safe ones |

**Best value** means: no other scored model in the same category is at least as good *and* at least as cheap.

## Run it on your computer (development)

You need Node 22 or newer.

```bash
npm install
cp apps/api/.env.example apps/api/.env      # then edit the values
npm run db:push -w apps/api                 # creates the database file
npm run dev:api                             # API on http://localhost:4000
npm run dev:web                             # website on http://localhost:3000
```

Open the website. There is no login.
(On some Windows PCs port 3000 is reserved. Use `PORT=3200 npm run dev:web` in that case.)

## Put it on your server (Docker)

On the server you need Docker and Docker Compose.

```bash
git clone <your repo> api-platform && cd api-platform     # or copy the folder
cp .env.example .env
nano .env            # set WEB_PORT (and FAL_KEY only if you want price refresh)
docker compose up -d --build
```

- The website listens on `127.0.0.1:WEB_PORT` (set in `.env`). The API stays private inside Docker.
- Your data is in the `data/` folder next to `docker-compose.yml`. **Back up this folder.**
- Put a reverse proxy with https in front (Caddy or nginx). Example `Caddyfile`:

  ```
  prices.example.com {
      reverse_proxy localhost:3000
  }
  ```
- Update later: `git pull && docker compose up -d --build`. Your data is kept.

## Use it from your own code

No key or login is needed.

```bash
# best-value image models
curl "https://prices.example.com/api/models?category=t2i&bestValue=true"

# everything as CSV
curl "https://prices.example.com/api/export?format=csv" -o models.csv
```

Main endpoints (all open):

| Method | Path | What |
|---|---|---|
| GET | `/categories` | Categories with counts and best-value ids |
| GET | `/models` | Filters: `category, provider, maker, q, ranked, bestValue, maxPrice, minElo` |
| GET | `/models/:id`, `/models/:id/history` | One model; its price history |
| POST / PATCH / DELETE | `/models`, `/models/:id` | Change data |
| POST / PATCH / DELETE | `/categories`, `/categories/:id` | Same for categories |
| GET | `/export?format=csv\|json&category=` | Download |
| POST | `/pricing/refresh-fal?apply=true` | Compare / update fal prices (needs `FAL_KEY`) |
| GET, PUT, DELETE | `/plans`, `/plans/:id` | Saved cost plans |

Each model in a response has `price` (the real price per unit), `chartPrice` (what the chart uses: video is per minute),
`bestValue` (`true`, `false`, or `null` if it has no score) and `beatenBy`.

## Adding another provider or kind of data

No code needed. On **Edit data → Edit categories** make a category (for example "Language models", unit
"USD per 1M tokens"), then add models with their own `provider` name. Scores only compare inside a category.

## Good to know

- Prices and scores go stale. The Overview shows when each category was last checked.
- "Refresh prices" only changes models that have one price tier and an exact (non-estimate) price. Others are
  marked "review" so you decide.
- **There is no login.** Anyone who can open the website can read, change and delete data. That is on purpose.
  Back up the `data/` folder. If you later want a password or team accounts, that can be added back.
- `api-value-map/` is the first research folder (static page + build scripts). It is no longer needed to run the
  platform. Keep it or delete it.

## Tests

```bash
npm test        # checks the best-value rule
```
