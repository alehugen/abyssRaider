import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

/**
 * Ícones do app instalado, gerados a partir de um único arquivo:
 *   npx pwa-assets-generator
 * Para trocar o ícone, substitua public/pwa-source.png (de preferência 512x512 ou maior) e rode de novo.
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Fundo do tema Abyss atrás do logo no ícone "maskable" (Android recorta em círculo/squircle) e no do iPhone.
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#020713' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#020713' } },
  },
  images: ['public/pwa-source.png'],
})
