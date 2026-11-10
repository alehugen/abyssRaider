<script setup lang="ts">
import { computed } from 'vue'
import type { Character, CharacterSummary } from '@/contexts/character/domain/Character'
import { cn } from '@/shared/lib/utils'
import { vGlare } from '@/shared/presentation/directives/glare'
import ClassIcon from './ClassIcon.vue'

/** Aceita o personagem completo ou só o resumo da busca (sem classe/CP). */
type CardCharacter = CharacterSummary & Partial<Pick<Character, 'className' | 'combatPower' | 'itemLevel' | 'legionName'>>

const props = withDefaults(
  defineProps<{
    character: CardCharacter
    /** Rótulo pequeno acima do nome (ex.: "Líder", "Tank", "Seu personagem"). */
    role?: string
    /** Visual apagado: ausente, recusou a raid, etc. */
    inactive?: boolean
    /**
     * md = nameplate: retrato grande e faixa de atributos.
     * sm = linha compacta, sem moldura, para listas (busca, membros da party).
     */
    size?: 'md' | 'sm'
    /** Linha discreta no rodapé do nameplate (ex.: "Atualizado há 5 min"). */
    footnote?: string
  }>(),
  { size: 'md', inactive: false },
)

const number = new Intl.NumberFormat('pt-BR')
const initials = computed(() => props.character.name.slice(0, 2).toUpperCase())
const factionLabel = computed(() => (props.character.faction === 'elyos' ? 'Elyos' : 'Asmodian'))

/** "Siel, legião Aurora" */
const location = computed(() => {
  const c = props.character
  return c.legionName ? `${c.serverName}, legião ${c.legionName}` : c.serverName
})

const stats = computed(() => {
  const c = props.character
  return [
    { label: 'CP', value: c.combatPower, primary: true },
    { label: 'Item level', value: c.itemLevel, primary: false },
    { label: 'Nível', value: c.level, primary: false },
  ]
    .filter((s): s is { label: string; value: number; primary: boolean } => s.value != null)
    .map((s) => ({ ...s, text: number.format(s.value) }))
})

const ariaLabel = computed(() =>
  [props.character.name, props.character.className, `nível ${props.character.level}`, props.character.serverName, factionLabel.value]
    .filter(Boolean)
    .join(', '),
)
</script>

<template>
  <!-- Nameplate -->
  <article
    v-if="size === 'md'"
    v-glare
    :class="
      cn(
        `faction-${character.faction}`,
        'relative isolate flex min-h-36 overflow-hidden rounded-2xl bg-card text-card-foreground shadow-card',
        inactive && 'opacity-70',
      )
    "
    :aria-label="ariaLabel"
  >
    <!-- Retrato: os retratos oficiais têm fundo preto, então ele "derrete" no card. -->
    <div class="relative w-28 flex-none sm:w-36" aria-hidden="true">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_40%_45%,var(--faction-soft),transparent_70%)]" />
      <img
        v-if="character.portraitUrl"
        :src="character.portraitUrl"
        alt=""
        loading="lazy"
        :class="
          cn(
            'absolute inset-0 size-full object-cover object-top mask-r-from-55% mask-r-to-100%',
            inactive && 'grayscale',
          )
        "
      />
      <span v-else class="absolute inset-0 grid place-items-center font-display text-4xl font-bold text-faction-ink">
        {{ initials }}
      </span>
      <span class="absolute inset-y-0 left-0 w-0.75 bg-faction" />
    </div>

    <div class="flex min-w-0 flex-1 flex-col justify-between gap-3 py-4 pr-4 pl-1 sm:pr-5">
      <div class="min-w-0 pr-20">
        <p v-if="role" class="text-xs font-semibold text-faction-ink">{{ role }}</p>
        <div class="flex min-w-0 items-center gap-2">
          <ClassIcon v-if="character.className" :class-name="character.className" />
          <h3
            :class="
              cn('truncate font-display text-[28px] leading-none font-semibold', inactive && 'text-muted-foreground')
            "
          >
            {{ character.name }}
          </h3>
        </div>
        <p class="mt-1.5 truncate text-sm text-muted-foreground">{{ location }}</p>
      </div>

      <dl class="flex flex-wrap items-end gap-x-5 gap-y-2">
        <div v-for="s in stats" :key="s.label" class="flex flex-col-reverse">
          <dt class="text-xs text-muted-foreground">{{ s.label }}</dt>
          <dd
            :class="
              cn(
                'font-display leading-none font-semibold tabular-nums',
                s.primary ? 'text-2xl text-foreground' : 'text-xl text-foreground/85',
              )
            "
          >
            {{ s.text }}
          </dd>
        </div>
        <p v-if="footnote" class="basis-full text-xs text-muted-foreground sm:ml-auto sm:basis-auto">{{ footnote }}</p>
      </dl>

      <div v-if="$slots.footer" class="border-t border-border/60 pt-3">
        <slot name="footer" />
      </div>
    </div>

    <div v-if="$slots.actions" class="absolute top-2.5 right-2.5 z-2 flex items-center gap-0.5">
      <slot name="actions" />
    </div>
  </article>

  <!-- Linha compacta -->
  <div
    v-else
    :class="cn(`faction-${character.faction}`, 'flex items-center gap-3 py-2.5', inactive && 'opacity-70')"
    :aria-label="ariaLabel"
    role="group"
  >
    <span
      class="relative size-11 flex-none overflow-hidden rounded-lg bg-faction-soft ring-2 ring-faction/70"
      aria-hidden="true"
    >
      <img
        v-if="character.portraitUrl"
        :src="character.portraitUrl"
        alt=""
        loading="lazy"
        :class="cn('size-full object-cover object-top', inactive && 'grayscale')"
      />
      <span v-else class="grid size-full place-items-center font-display font-bold text-faction-ink">{{ initials }}</span>
    </span>

    <div class="min-w-0 flex-1">
      <p class="flex items-center gap-1.5">
        <ClassIcon v-if="character.className" :class-name="character.className" size="sm" />
        <span class="truncate font-display text-lg leading-tight font-semibold">{{ character.name }}</span>
        <span v-if="role" class="flex-none text-xs font-semibold text-faction-ink">{{ role }}</span>
      </p>
      <p class="truncate text-[13px] text-muted-foreground">
        <span v-if="!character.className" class="mr-2 text-faction-ink">{{ factionLabel }}</span>
        <span>{{ character.serverName }}</span>
        <span class="ml-2">Nível {{ character.level }}</span>
        <span v-if="character.combatPower" class="ml-2 tabular-nums">{{ number.format(character.combatPower) }} CP</span>
      </p>
    </div>

    <div v-if="$slots.actions" class="flex flex-none items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
