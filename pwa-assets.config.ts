import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Black background behind the icon on iOS home screen / maskable icons.
    apple: { ...minimal2023Preset.apple, padding: 0.2, resizeOptions: { background: '#000000' } },
    maskable: { ...minimal2023Preset.maskable, padding: 0.2, resizeOptions: { background: '#000000' } },
  },
  images: ['public/logo.svg'],
})
