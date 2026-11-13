import { readFileSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// GitHub Pages serves the app from /<repository>/; the deploy workflow passes BASE_PATH.
const base = process.env.BASE_PATH ?? '/parkflung/'

// Sky colour at the top of the home screen: splash screen and browser chrome before the CSS loads.
const SKY = '#8fd0f5'

// GitHub Pages answers unknown paths with 404.html: a copy of the app there keeps any link working.
function githubPagesFallback(): Plugin {
  return {
    name: 'parkflung:github-pages-fallback',
    apply: 'build',
    async writeBundle({ dir = 'dist' }) {
      await copyFile(resolve(dir, 'index.html'), resolve(dir, '404.html'))
    },
  }
}

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      // The app asks before switching to a new version (src/components/UpdatePrompt.tsx).
      registerType: 'prompt',
      includeManifestIcons: false,
      manifest: {
        id: base,
        name: 'ParkFlung',
        short_name: 'ParkFlung',
        description: 'Cinque domande: più la risposta è rara, più avanzi lungo il sentiero.',
        lang: 'it',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: SKY,
        theme_color: SKY,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything is precached: the game works offline from the first launch.
        globPatterns: ['**/*.{js,css,html,png,ico,woff2}'],
        globIgnores: ['404.html', 'icon-source.webp'],
        cleanupOutdatedCaches: true,
      },
    }),
    githubPagesFallback(),
  ],
})
