# Gyms: real places, check-ins and meeting people who train there

Added 2026-11-09. Gym check-in now points at a real place instead of typed text, and
members at the same gym can find each other and send Spotter requests.

## What the user sees

- **Social → Gym.** First visit: "Find your gym" opens the picker. After a home gym is set
  the card shows one big "I'm at <home gym>" button plus "Somewhere else".
- **Picker** (`components/GymPicker.tsx`, sheet `sheet-gym-picker`): search box
  (`input-gym-search`), "Near me" (`button-gym-near-me`, uses the phone's location),
  result rows `pick-gym-<placeId>` with name, address, distance and a chip with the
  number of Corpus members who call it home. Attribution line under the list
  ("Powered by Google" or "Map data from OpenStreetMap contributors").
- **Checked in:** name, address, time, "Check out". Below it **Here now** (people checked
  in at the same gym in the last 3 h) and **Trains at <gym>** (people whose home gym it
  is). Each row has Add (`button-add-spotter-<username>`) / Requested / Spotter.
- **Home gym card** (`card-home-gym`): Set/Change, plus the toggle **Let people at my gym
  find me** (`toggle-gym-visible`). The same toggle is in Profile → Account. Profile's
  Home gym field opens the picker in live mode (`button-profile-gym-pick`).
- First check-in also sets the home gym when none is set.

## Data

- `gyms` table: `id, provider ('google'|'osm'), place_id, name, address, lat, lng`,
  unique on `(provider, place_id)`. RLS policy `corpus_server` like the other tables.
- `users.home_gym_id` → `gyms.id` (on delete set null), `users.gym_visible` (default true).
- `users.gym_checkin` JSON gains `gymId`. Free-text check-ins (no `gymId`) still work.
- Index on `(gym_checkin->>'gymId')` and `home_gym_id`.

## Server

- `GET /api/gyms/search?q=&lat=&lng=` → `{ provider, results: [{ provider, placeId, name,
  address, lat, lng, distanceKm?, members }] }`. Per-user rate limit 90/min.
- `POST /api/gym/checkin { place, setHome? }` (`place` is a search result or `{ id }`);
  legacy `{ gym: "text" }` still accepted.
- `DELETE /api/gym/checkin`.
- `PUT /api/me/home-gym { place | null }` → `/api/me` shape plus `gym`.
- `PATCH /api/me { gymVisible }`.
- `GET /api/gym` → `{ me, gym, home, visible, provider, here[], members[], friends[] }`.
  `here`/`members` only include users with `gym_visible` and the same `is_demo` flag,
  and carry `friend`, `pending ('in'|'out'|null)`, `split`, `streak`, `homeHere`.

## Places providers (`server/places.ts`)

- **Google Places (New)** when a key is configured: Autocomplete for typed names
  (10k free/month), Nearby Search for "Near me" (5k free), Place Details once per new
  gym to store coordinates (10k free). Monthly caps in code stop calls before paid usage.
  Key comes from the hosting credential proxy (`CUSTOM_CRED_PLACES_GOOGLEAPIS_COM_*`) or
  `GOOGLE_PLACES_KEY`. Never shipped to the browser.
- **OpenStreetMap / Nominatim** fallback when there is no key or Google fails: one
  request per second, filtered to fitness/sports centres or gym-named businesses.
  Coverage is thin in small towns.
- Results cached in memory for 6 h.

## Privacy

Privacy page updated: other members at the same gym see name, split and streak unless
the toggle is off; search text and approximate location go to the provider via our
server and are not stored.
