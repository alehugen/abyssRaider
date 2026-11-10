<script setup lang="ts">
import { PhCircleNotch } from '@phosphor-icons/vue'
import { ref, shallowRef, watch } from 'vue'
import { errorMessage } from '@/shared/lib/errorMessage'
import { cn } from '@/shared/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/presentation/ui/popover'
import { enchantLabel, slotLabel, type Gear, type GearDetail } from '../../domain/CharacterBuild'
import type { CharacterRef } from '../../domain/CharacterDirectory'
import { gradeClass, loadGear } from './buildCache'

const props = defineProps<{ gear: Gear; characterRef: CharacterRef }>()

const open = ref(false)
const detail = shallowRef<GearDetail | null>(null)
const error = ref<string | null>(null)

// O detalhe só é buscado quando a pessoa abre a peça.
watch(open, async (isOpen) => {
  if (!isOpen || detail.value) return
  error.value = null
  try {
    detail.value = await loadGear(props.characterRef, props.gear)
  } catch (e) {
    error.value = errorMessage(e)
  }
})
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        :class="
          cn(
            gradeClass(gear.grade),
            'group flex w-full min-w-0 items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-accent',
          )
        "
        :aria-label="`${slotLabel(gear.slotName)}: ${gear.name} ${enchantLabel(gear)}`"
      >
        <span
          class="relative grid size-11 flex-none place-items-center overflow-hidden rounded-md border-2 border-(--grade) bg-[oklch(0.22_0.02_260)]"
        >
          <img v-if="gear.icon" :src="gear.icon" alt="" loading="lazy" class="size-full object-contain" />
          <span
            v-if="gear.enchantLevel"
            class="absolute right-0 bottom-0 rounded-tl bg-black/75 px-1 text-[10px] leading-4 font-bold text-white tabular-nums"
          >
            +{{ gear.enchantLevel }}
          </span>
        </span>
        <span class="min-w-0">
          <span class="block text-xs text-muted-foreground">{{ slotLabel(gear.slotName) }}</span>
          <span class="line-clamp-2 text-sm leading-snug font-medium break-words text-(--grade-ink)" :title="`${gear.name} ${enchantLabel(gear)}`.trim()">
            {{ gear.name }}
            <span v-if="enchantLabel(gear)" class="whitespace-nowrap tabular-nums">{{ enchantLabel(gear) }}</span>
          </span>
        </span>
      </button>
    </PopoverTrigger>

    <PopoverContent :class="cn(gradeClass(gear.grade), 'w-80 border-t-4 border-t-(--grade) p-0')" align="start">
      <div class="space-y-3 p-4 text-sm">
        <header>
          <p class="font-display text-lg leading-tight font-semibold text-(--grade-ink)">
            {{ gear.name }} <span v-if="enchantLabel(gear)" class="whitespace-nowrap tabular-nums">{{ enchantLabel(gear) }}</span>
          </p>
          <p v-if="detail" class="text-xs text-muted-foreground">
            {{ [detail.gradeName, detail.category, detail.level ? `nível ${detail.level}` : null].filter(Boolean).join(' · ') }}
            <template v-if="detail.maxEnchantLevel"> · encantamento máx. +{{ detail.maxEnchantLevel }}</template>
          </p>
        </header>

        <p v-if="error" role="alert" class="text-destructive">{{ error }}</p>
        <p v-else-if="!detail" class="flex items-center gap-2 text-muted-foreground">
          <PhCircleNotch class="animate-spin" /> Carregando detalhes…
        </p>

        <template v-else>
          <dl v-if="detail.mainStats.length" class="space-y-1">
            <div v-for="s in detail.mainStats" :key="s.name" class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ s.name }}</dt>
              <dd class="font-medium tabular-nums">
                {{ s.value }}<span v-if="s.extra" class="ml-1 text-success">(+{{ s.extra }})</span>
              </dd>
            </div>
          </dl>

          <section v-if="detail.subStats.length" class="border-t pt-3">
            <h4 class="mb-1 text-xs font-semibold text-muted-foreground">Atributos adicionais</h4>
            <dl class="space-y-1">
              <div v-for="s in detail.subStats" :key="s.name" class="flex justify-between gap-3">
                <dt>{{ s.name }}</dt>
                <dd class="font-medium tabular-nums">{{ s.value }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="detail.skills.length" class="border-t pt-3">
            <h4 class="mb-1 text-xs font-semibold text-muted-foreground">Skills do item</h4>
            <ul class="space-y-1">
              <li v-for="k in detail.skills" :key="k.name" class="flex items-center gap-2">
                <img v-if="k.icon" :src="k.icon" alt="" class="size-6 rounded" loading="lazy" />
                {{ k.name }} <span class="text-muted-foreground">nv. {{ k.level }}</span>
              </li>
            </ul>
          </section>

          <section v-if="detail.manastones.length" class="border-t pt-3">
            <h4 class="mb-1 text-xs font-semibold text-muted-foreground">Pedras de mana</h4>
            <ul class="space-y-1">
              <li
                v-for="(m, i) in detail.manastones"
                :key="i"
                :class="cn(gradeClass(m.grade), 'flex items-center justify-between gap-3')"
              >
                <span class="flex items-center gap-2">
                  <span class="size-2 rounded-full bg-(--grade)" aria-hidden="true" />{{ m.name }}
                </span>
                <span class="font-medium tabular-nums">{{ m.value }}</span>
              </li>
            </ul>
          </section>
        </template>
      </div>
    </PopoverContent>
  </Popover>
</template>
