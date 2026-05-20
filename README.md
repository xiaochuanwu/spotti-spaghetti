# Spotti Spaghetti

A client-side Spotify playlist workbench for exporting, restoring, comparing, and analyzing your playlists.

Spotti Spaghetti uses Spotify PKCE OAuth directly in the browser. It does not need a backend server for normal use.

## Features

- Export one playlist to CSV
- Export all playlists to a ZIP of CSV files
- Include a virtual "Liked Songs" playlist
- Restore a new Spotify playlist from an exported CSV
- Keep local export snapshots for playlist history and diffs
- Analyze a selected export snapshot from local history
- Show track, artist, album, genre, label, duration, popularity, explicit, release year, decade, and discovery stats
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
```

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
```

## Deployment

Any static hosting provider that supports Vite apps works: Vercel, Netlify, Cloudflare Pages, GitHub Pages, object storage/CDN, or a simple Nginx container.

A Dockerfile and Nginx config are included:

```bash
docker build --build-arg VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id_here -t spotti-spaghetti .
docker run --rm -p 8080:80 spotti-spaghetti
```

## Privacy

Spotify tokens are stored in `sessionStorage`. Preferences and batch retry state are stored in `localStorage`. Export history is stored locally in IndexedDB. No playlist data is sent to an application backend.

## License

MIT
