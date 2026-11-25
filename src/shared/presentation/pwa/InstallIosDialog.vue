<script setup lang="ts">
import { PhExport, PhPlusSquare, PhCheckCircle } from '@phosphor-icons/vue'
import { t } from '@/shared/i18n'
import { Button } from '@/shared/presentation/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/presentation/ui/dialog'

/** iPhone/iPad não têm convite de instalação: o passo a passo pelo Safari. */
const open = defineModel<boolean>('open', { default: false })

const steps = [
  { icon: PhExport, key: 'step1' },
  { icon: PhPlusSquare, key: 'step2' },
  { icon: PhCheckCircle, key: 'step3' },
] as const
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle class="font-display text-2xl">{{ t('app.pwa.install.title') }}</DialogTitle>
        <DialogDescription>{{ t('app.pwa.install.description') }}</DialogDescription>
      </DialogHeader>
      <ol class="space-y-3">
        <li v-for="s in steps" :key="s.key" class="flex items-start gap-3">
          <span class="grid size-9 flex-none place-items-center rounded-lg bg-primary/15 text-primary-ink">
            <component :is="s.icon" :size="20" aria-hidden="true" />
          </span>
          <span class="pt-1.5 text-sm">{{ t(`app.pwa.install.${s.key}`) }}</span>
        </li>
      </ol>
      <DialogFooter>
        <Button class="h-11 w-full sm:w-auto" @click="open = false">{{ t('app.pwa.install.ok') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
