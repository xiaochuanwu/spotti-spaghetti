# Spotti Spaghetti

A client-side Spotify playlist workbench for exporting, restoring, comparing, and analyzing your playlists.

Spotti Spaghetti uses Spotify PKCE OAuth directly in the browser. It does not need a backend server for normal use.

## Features

- Export one playlist to CSV
- Export all playlists, or selected playlists, to a ZIP of CSV files, with cancellation and failed-item retry support
- Include a virtual "Liked Songs" playlist
- Restore a new Spotify playlist from an exported CSV, preserving duplicate tracks by default with optional URI dedupe
- Keep local export snapshots for playlist history, diffs, two-snapshot comparison, JSON import/export, and one-click playlist restore
- Analyze a selected export snapshot from local history
- Show track, artist, album, genre, label, duration, popularity, explicit, release year, decade, discovery, and popularity-range stats
- Export, delete, or clear local export history
- Show a read-only Spotify Now Playing panel with cover art, track metadata, progress, ISRC, and manual/automatic refresh
- Preview playlist tracks with paged loading
- Export platform-neutral fields including provider, provider track ID, provider playlist ID, and ISRC
- Use a provider abstraction layer internally; Spotify is the only registered provider today
- Support Chinese and English, light and dark themes, search, and grid/list views

## CSV schema

CSV exports remain compatible with older Spotti Spaghetti CSV files. Older files without the newer platform-neutral columns can still be imported for Spotify playlist restore.

Current columns:

- `Track URI`: Spotify track URI when available, for example `spotify:track:...`
- `Track Name`
- `Album Name`
- `Artist Name(s)`: comma-separated artist names
- `Release Date`
- `Duration (ms)`
- `Popularity`
- `Explicit`: `Yes`, `No`, or blank
- `Added By`
- `Added At`
- `Genres`: comma-separated genres
- `Record Label`
- `Provider`: source platform identifier, currently `spotify`
- `Provider Track ID`: source platform track identifier
- `Provider Playlist ID`: source platform playlist identifier
- `ISRC`: International Standard Recording Code from Spotify `external_ids.isrc` when available

## Tech Stack

- React + Vite
- Tailwind CSS
- Spotify Web API
- JSZip + FileSaver
- IndexedDB for local export history

## Getting Started

Install dependencies:

```bash
npm ci
```

Create local environment config:

```bash
cp .env.example .env
```

Set your Spotify Client ID:

```text
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
```

Start the dev server:

```bash
npm run dev
```

## Spotify App Setup

In the Spotify Developer Dashboard, add your site origin as a redirect URI.

For local development:

```text
http://localhost:5173/
http://127.0.0.1:5173/
```

The Vite dev and preview servers bind to `0.0.0.0`, so both local origins are available. If you use both during OAuth testing, add both redirect URIs in Spotify.

For production:

```text
https://your-domain.example/
```

The app requests scopes for reading playlists, saved tracks, and the current playback item. Restoring playlists also needs playlist modification scopes.

Current Spotify scopes:

- `playlist-read-private`
- `playlist-read-collaborative`
- `user-library-read`
- `user-read-currently-playing`: used only by the read-only Now Playing panel
- `playlist-modify-private`
- `playlist-modify-public`

## Scripts

```bash
npm run lint
npm run test
npm run build
npm run preview
npm audit --audit-level=high
```

CI runs `npm ci`, lint, tests, and build. The audit step is included as a non-blocking high-severity signal.

## Deployment

Any static hosting provider that supports Vite apps works: Vercel, Netlify, Cloudflare Pages, GitHub Pages, object storage/CDN, or a simple Nginx container.

A Dockerfile and Nginx config are included:

```bash
docker build --build-arg VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id_here -t spotti-spaghetti .
docker run --rm -p 8080:80 spotti-spaghetti
```

`VITE_SPOTIFY_CLIENT_ID` is a Vite build-time value. If omitted, the image still builds, but Spotify login cannot start until the app is rebuilt with a client ID. `.env` is not copied into the image.

## Privacy / Local data

Spotify tokens are stored in `sessionStorage` with an absolute expiration time based on Spotify's `expires_in` response. Preferences and batch retry state are stored in `localStorage`. Export history, comparisons, imported history JSON, and local history exports use only this browser's IndexedDB data.

Normal Spotify export, restore, history, preview, Now Playing, and insight workflows still run entirely in the browser and do not need an application backend. No playlist data is sent to an application backend by the current app.

## Roadmap

- Harden the provider abstraction as more music services are added.
- Add a separate backend/serverless branch only when Apple Music support begins. That backend will be limited to server-side Apple Music developer token signing so private keys, Team ID, and Key ID never enter the frontend bundle.
- Add Apple Music import/export through the platform-neutral model, with ISRC-first matching and manual review for uncertain matches.

## License

MIT
