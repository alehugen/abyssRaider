import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from '@/app/App.vue'
import { router } from '@/app/router'
import '@/app/styles/main.css'
import { applyHtmlLang, i18n } from '@/shared/i18n'

applyHtmlLang()
createApp(App).use(createPinia()).use(router).use(i18n).mount('#app')
