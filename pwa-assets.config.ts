import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Run `npm run icons` after changing public/icon-source.webp; the PNGs are committed.
// The picture is full-bleed sky, so no padding: the palm and the P sign fill the icon.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/icon-source.webp'],
})
