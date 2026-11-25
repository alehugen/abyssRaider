<script setup lang="ts">
import { PhBellRinging, PhCheckCircle, PhCircleNotch, PhInfo } from '@phosphor-icons/vue'
import { computed, watch } from 'vue'
import { t } from '@/shared/i18n'
import { Button } from '@/shared/presentation/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/presentation/ui/dialog'
import { Switch } from '@/shared/presentation/ui/switch'
import type { PushPreferences } from '../../domain/PushDevice'
import { usePushNotifications } from './usePushNotifications'

/** Ativar/desativar push neste aparelho e escolher o que recebe. */
const open = defineModel<boolean>('open', { default: false })

const push = usePushNotifications()
const status = push.status
const busy = push.busy

watch(open, (isOpen) => {
  if (isOpen) void push.refresh()
})

/** Situações em que não há o que ativar: só a explicação. */
const blockedMessage = computed(() => {
  const s = status.value
  return s === 'unsupported' || s === 'needsInstall' || s === 'unconfigured' || s === 'denied'
    ? t(`notifications.push.status.${s}`)
    : null
})

const TOGGLES: readonly (keyof PushPreferences)[] = ['raids', 'patchNotes']

function toggle(key: keyof PushPreferences, value: boolean) {
  void push.setPreferences({ ...push.preferences.value, [key]: value })
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="font-display text-2xl">{{ t('notifications.push.title') }}</DialogTitle>
        <DialogDescription>{{ t('notifications.push.description') }}</DialogDescription>
      </DialogHeader>

      <div v-if="status === 'loading'" class="flex items-center gap-2 text-sm text-muted-foreground">
        <PhCircleNotch class="animate-spin" aria-hidden="true" /> {{ t('common.actions.loading') }}
      </div>

      <p v-else-if="blockedMessage" role="status" class="flex gap-2 rounded-xl bg-muted p-3 text-sm" data-push="blocked">
        <PhInfo class="mt-0.5 flex-none text-muted-foreground" aria-hidden="true" />
        <span>{{ blockedMessage }}</span>
      </p>

      <template v-else>
        <!-- As opções só aparecem depois de ativar: antes, os botões ligados mas travados confundem. -->
        <template v-if="status === 'on'">
          <p role="status" class="flex items-center gap-1.5 text-sm text-success-ink">
            <PhCheckCircle weight="fill" aria-hidden="true" /> {{ t('notifications.push.on') }}
          </p>
          <fieldset class="space-y-3">
            <legend class="mb-1 text-sm font-medium">{{ t('notifications.push.what') }}</legend>
            <label v-for="key in TOGGLES" :key="key" class="flex items-start justify-between gap-4">
              <span>
                <span class="block text-sm">{{ t(`notifications.push.${key}.label`) }}</span>
                <span class="block text-xs text-muted-foreground">{{ t(`notifications.push.${key}.hint`) }}</span>
              </span>
              <Switch
                :model-value="push.preferences.value[key]"
                :disabled="busy"
                :data-push-toggle="key"
                @update:model-value="(v: boolean) => toggle(key, v)"
              />
            </label>
          </fieldset>
        </template>
        <p v-else class="text-sm">{{ t('notifications.push.offHint') }}</p>

        <p class="text-xs text-muted-foreground">{{ t('notifications.push.perDevice') }}</p>
      </template>

      <p v-if="push.error.value" role="alert" class="text-sm text-destructive-ink">{{ push.error.value }}</p>

      <DialogFooter>
        <Button
          v-if="status === 'off'"
          class="h-11 w-full sm:w-auto"
          :disabled="busy"
          data-action="enable"
          @click="push.enable()"
        >
          <PhCircleNotch v-if="busy" class="animate-spin" aria-hidden="true" />
          <PhBellRinging v-else aria-hidden="true" />
          {{ t('notifications.push.enable') }}
        </Button>
        <Button
          v-else-if="status === 'on'"
          variant="outline"
          class="h-11 w-full sm:w-auto"
          :disabled="busy"
          data-action="disable"
          @click="push.disable()"
        >
          {{ t('notifications.push.disable') }}
        </Button>
        <Button v-else variant="outline" class="h-11 w-full sm:w-auto" @click="open = false">
          {{ t('common.actions.close') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
