import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { vercelApiDev } from './scripts/vite-vercel-api.ts'

/**
 * PWA: instalável, com aviso de versão nova a cada build e a interface abrindo offline.
 * Dados (Supabase e /api) nunca passam pelo cache do service worker: sem dado velho nem de outra conta.
 */
const pwa = VitePWA({
  registerType: 'prompt', // nunca recarrega sozinho: o app mostra "Nova versão disponível"
  injectRegister: false, // registrado em src/main.ts (usePwaUpdate)
  manifest: {
    id: '/',
    name: 'AbyssRaider',
    short_name: 'AbyssRaider',
    description: 'Organize raids de Aion 2: vincule seu personagem, monte parties e marque a agenda.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#020713',
    background_color: '#020713',
    categories: ['games', 'social'],
    icons: [
      { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [
      { src: 'screenshots/narrow.jpg', sizes: '390x844', type: 'image/jpeg', form_factor: 'narrow', label: 'AbyssRaider no celular' },
      { src: 'screenshots/wide.jpg', sizes: '1280x720', type: 'image/jpeg', form_factor: 'wide', label: 'AbyssRaider no computador' },
    ],
  },
  workbox: {
    cleanupOutdatedCaches: true,
    globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,webp,woff2}'],
    globIgnores: ['screenshots/**', 'pwa-source.png'],
    navigateFallback: 'index.html',
    // /api (Vercel) é dado: vai sempre à rede.
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      {
        // Fontes do Google: a interface continua com a tipografia certa sem rede.
        urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
      },
    ],
  },
  // Para testar o service worker com `npm run dev`, troque para true. O teste final é sempre build + preview.
  devOptions: { enabled: false },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // A integração Supabase da Vercel cria NEXT_PUBLIC_SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.
  // Usamos esses nomes como fallback para não precisar duplicar variáveis na Vercel.
  // Só valores PÚBLICOS entram aqui — nunca exponha secret/service_role no front.
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || ''

  return {
    plugins: [vue(), tailwindcss(), vercelApiDev(), pwa],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseKey),
    },
  }
})
