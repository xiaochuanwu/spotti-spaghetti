# Spotti Spaghetti

A client-side Spotify playlist workbench for exporting, restoring, comparing, and analyzing your playlists.

Spotti Spaghetti uses Spotify PKCE OAuth directly in the browser. It does not need a backend server for normal use.

## Features

- Export one playlist to CSV
- Export all playlists, or selected playlists, to a ZIP of CSV files
- Include a virtual "Liked Songs" playlist
- Restore a new Spotify playlist from an exported CSV
- Keep local export snapshots for playlist history, diffs, and two-snapshot comparison
- Analyze a selected export snapshot from local history
- Show track, artist, album, genre, label, duration, popularity, explicit, release year, decade, discovery, and popularity-range stats
- Export, delete, or clear local export history
- Support Chinese and English, light and dark themes, search, grid/list views, and playlist preview

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

The app requests scopes for reading playlists and saved tracks. Restoring playlists also needs playlist modification scopes.

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

Spotify tokens are stored in `sessionStorage`. Preferences and batch retry state are stored in `localStorage`. Export history, comparisons, and local history exports use only this browser's IndexedDB data. No playlist data is sent to an application backend.

## License

MIT
