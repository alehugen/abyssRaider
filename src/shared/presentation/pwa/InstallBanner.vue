<script setup lang="ts">
import { PhDeviceMobile, PhX } from '@phosphor-icons/vue'
import { computed, ref } from 'vue'
import { t } from '@/shared/i18n'
import { Button } from '@/shared/presentation/ui/button'
import InstallIosDialog from './InstallIosDialog.vue'
import { installAction, usePwaInstall } from './usePwaInstall'

/**
 * Convite para instalar antes do login (só no celular, só para quem não entrou).
 * No iPhone o app instalado não divide o login com o Safari: quem entra e depois
 * instala precisa entrar de novo.
 */
const STORAGE_KEY = 'abyssraider.installBanner.dismissed'

const install = installAction(usePwaInstall())
const iosHelp = ref(false)

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
const dismissed = ref(readDismissed())
const show = computed(() => install.visible.value && !dismissed.value)

function dismiss() {
  dismissed.value = true
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* sem storage: some só nesta visita */
  }
}

async function installApp() {
  if ((await install.run()) === 'manual') iosHelp.value = true
}
</script>

<template>
  <aside
    v-if="show"
    data-install-banner
    :aria-label="t('app.pwa.install.menu')"
    class="relative z-10 mb-6 flex items-start gap-3 rounded-2xl border border-primary/40 bg-card/95 p-4 shadow-card backdrop-blur md:hidden"
  >
    <span class="grid size-10 flex-none place-items-center rounded-xl bg-primary/15 text-primary-ink" aria-hidden="true">
      <PhDeviceMobile :size="22" />
    </span>
    <div class="min-w-0 flex-1 space-y-3">
      <div>
        <p class="font-semibold leading-snug">{{ t('app.pwa.install.banner.title') }}</p>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('app.pwa.install.banner.body') }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button class="h-10" data-action="install" @click="installApp">{{ t('app.pwa.install.banner.action') }}</Button>
        <Button variant="ghost" class="h-10" data-action="dismiss" @click="dismiss">
          {{ t('app.pwa.install.banner.dismiss') }}
        </Button>
      </div>
    </div>
    <Button
      variant="ghost"
      size="icon"
      class="-mt-1 -mr-1 size-9 flex-none text-muted-foreground"
      :aria-label="t('app.pwa.install.banner.dismiss')"
      @click="dismiss"
    >
      <PhX />
    </Button>
  </aside>
  <InstallIosDialog v-model:open="iosHelp" />
</template>
