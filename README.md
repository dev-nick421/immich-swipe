# Immich Swipe

Swipe right to keep photos, swipe left to delete them -> just like a dating app, but for immich!

Made with:
![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-06B6D4?logo=tailwindcss)

## Features

- 🖼️ **Random Photo Review** — Shows random photos from your Immich library one at a time
- 👆 **Swipe Gestures** — Swipe right to keep, swipe left to delete (works on mobile and desktop)
- 🔘 **Button Controls** — Prefer buttons? Use the keep/delete buttons instead
- ⌨️ **Keyboard Support** — Use arrow keys (←/→) on desktop
- 🌙 **Dark/Light Mode** — Toggle between dark and light themes
- 📊 **Session Stats** — Track how many photos you've kept vs deleted
- ⚡ **Preloading** — Next photo is preloaded for instant transitions
- 🔒 **No Backend Required** — Connects directly to Immich via API

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
immich-swipe/
├── src/
│   ├── components/       # Vue components
│   ├── composables/      # Vue composables (useImmich, useSwipe)
│   ├── router/           # Vue Router
│   ├── stores/           # Pinia stores (auth, ui)
│   ├── types/            # TypeScript types
│   └── views/            # Page components
├── docker-compose.yml    # Docker Compose config
├── Dockerfile            # Multi-stage build
├── nginx.conf            # Nginx config for production
└── package.json
```

## Required Immich API Permissions

Create an API key in Immich (Account Settings → API Keys) with (at least):

- `asset.read` — View photos
- `asset.delete` — Delete photos (moves to trash)

## License

MIT
