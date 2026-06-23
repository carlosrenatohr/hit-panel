import { defineConfig } from 'astro/config'
import preact from '@astrojs/preact'
import tailwind from '@astrojs/tailwind'

// Static SPA: the panel renders client-side (client:only) and talks to InsForge directly with the
// signed-in user's JWT. No SSR/secrets at the edge — it deploys as static assets to Cloudflare Pages.
export default defineConfig({
  integrations: [preact(), tailwind()],
  output: 'static',
})
