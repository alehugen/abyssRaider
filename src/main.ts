import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from '@/app/App.vue'
import { router } from '@/app/router'
// Fontes no próprio app (precache do service worker): só o alfabeto latino (pt, en, es).
import '@fontsource/noto-sans/latin-400.css'
import '@fontsource/noto-sans/latin-500.css'
import '@fontsource/noto-sans/latin-600.css'
import '@fontsource/noto-sans/latin-700.css'
import '@fontsource/noto-serif/latin-600.css'
import '@fontsource/noto-serif/latin-700.css'
import '@/app/styles/main.css'
import { applyHtmlLang, i18n } from '@/shared/i18n'
import { usePwaInstall } from '@/shared/presentation/pwa/usePwaInstall'
import { usePwaUpdate } from '@/shared/presentation/pwa/usePwaUpdate'

applyHtmlLang()
// Antes de montar: o convite de instalação do navegador pode chegar logo na carga.
usePwaInstall()
// Service worker: em `npm run dev` o plugin não registra nada (devOptions desligado).
usePwaUpdate(registerSW)
createApp(App).use(createPinia()).use(router).use(i18n).mount('#app')
