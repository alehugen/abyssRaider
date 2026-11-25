<script setup lang="ts">
import { PhArrowClockwise, PhCircleNotch } from '@phosphor-icons/vue'
import { computed, ref } from 'vue'
import { t } from '@/shared/i18n'
import { Button } from '@/shared/presentation/ui/button'
import { usePwaUpdate } from './usePwaUpdate'

/**
 * "Nova versão disponível": aparece quando sai um build novo. Nunca recarrega sozinho;
 * se a pessoa ignorar, a versão nova entra na próxima abertura do app.
 * `aboveNav`: no celular com a barra inferior, fica logo acima dela.
 */
defineProps<{ aboveNav?: boolean }>()

const pwa = usePwaUpdate()
const visible = computed(() => !!pwa?.needRefresh.value)
const updating = ref(false)

async function update() {
  updating.value = true
  await pwa?.update()
}
</script>

<template>
  <div
    v-if="visible"
    role="status"
    :class="[
      'fixed inset-x-4 z-40 mx-auto flex max-w-md flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card p-3 text-sm shadow-lg md:bottom-safe',
      aboveNav ? 'bottom-nav' : 'bottom-safe',
    ]"
  >
    <p class="min-w-0 flex-1 basis-48 font-medium">{{ t('app.pwa.update.message') }}</p>
    <div class="flex flex-none gap-2">
      <Button data-action="later" variant="ghost" size="sm" class="h-10" @click="pwa?.dismiss()">
        {{ t('app.pwa.update.later') }}
      </Button>
      <Button data-action="update" size="sm" class="h-10" :disabled="updating" @click="update">
        <PhCircleNotch v-if="updating" class="animate-spin" />
        <PhArrowClockwise v-else />
        {{ t('app.pwa.update.action') }}
      </Button>
    </div>
  </div>
</template>
