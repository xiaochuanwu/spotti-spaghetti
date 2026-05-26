# Spotti Spaghetti - Agent Instructions

## Project Overview
Spotti Spaghetti is a client-side Spotify playlist workbench for exporting, restoring, comparing, and analyzing playlists. It runs entirely in the browser using Spotify PKCE OAuth and does not require a backend server.

## Tech Stack
- **Frontend Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Dependencies**: JSZip, FileSaver
- **Data Storage**: IndexedDB (for local export history), sessionStorage (tokens), localStorage (preferences)
- **Deployment**: Static hosting / Docker with Nginx

## Key Features
- Export/Restore playlists to/from CSV (ZIP support for multiple)
- Virtual "Liked Songs" playlist support
- Local export snapshots with comparison, JSON import/export
- Playlist analysis/stats (track, artist, album, genre, duration, popularity, etc.)
- Read-only Spotify Now Playing panel
- Multi-language (EN/ZH), Light/Dark themes

## Development Guide
- **Install**: `npm ci`
- **Dev Server**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Test**: `npm run test` (uses Node's native test runner)

## Agent Guidelines
- **No Backend**: This is a pure client-side application. Any data persistence must happen in the browser (IndexedDB, local/session storage).
- **Environment Variables**: Spotify OAuth requires `VITE_SPOTIFY_CLIENT_ID` defined in `.env`.
- **Styling**: Use Tailwind CSS for all styling.
- **Provider Abstraction**: Keep music service integrations modular. Currently, Spotify is the only provider, but the architecture should support adding others (like Apple Music) in the future.
