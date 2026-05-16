# Deployment — Render.com

This is a pure client-side Vite/Svelte app — there's no backend. Static-site hosting on Render.com works without modifications.

## Quick path (with blueprint)

1. Push the repo to GitHub (or GitLab).
2. In Render, **New +** → **Blueprint** → connect the repo.
3. Render reads [`render.yaml`](../render.yaml) and provisions a static site:
   - Build command: `npm install && npm run build`
   - Publish directory: `./dist`
   - Cache headers: hashed assets are long-cached; `index.html` is no-cache so new deploys take effect immediately.
4. The site auto-deploys on every push to the default branch.

## Quick path (manual, no blueprint)

If you'd rather configure via Render's dashboard:

1. **New +** → **Static Site** → connect the repo.
2. **Build Command:** `npm install && npm run build`
3. **Publish Directory:** `./dist`
4. Deploy.

## Things to verify after the first deploy

- The exercise page renders (AlphaTab loads its font from `/font/` — confirm by toggling **Notation** ON and rolling an exercise).
- The metronome ticks audibly (browsers may suspend the AudioContext until first user interaction — clicking **Start** is enough).
- Settings persist across reloads (the side panel's choices should survive a hard refresh — they're in `localStorage` under `bass-practice:settings:v4`).

## Things that DON'T need extra config

- **No SPA redirects.** The app is a single page; there's no client-side routing yet. If routing is added later, add a `_redirects` file or a Render header rule (`/*  /index.html  200`).
- **No environment variables.** Everything runs in the browser; no API keys, no backend URL.
- **No build-time secrets.** `dist/` is fully public.

## Bundle size note

The current production build emits a single ~1.2 MB JS chunk (alphaTab is the bulk). If load time becomes a concern, split AlphaTab into a separate chunk via `build.rollupOptions.output.manualChunks` — but for a personal practice app, it's fine.

## Mobile / LAN access during development

`vite.config.ts` already sets `server.host: true`, so `npm run dev` binds to all interfaces. Find the LAN URL printed in the Vite output (e.g. `http://192.168.x.x:5173/`) and open it from a phone on the same Wi-Fi. The deployed Render URL works on any network.
