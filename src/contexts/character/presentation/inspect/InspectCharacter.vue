<script setup lang="ts">
import { PhArrowClockwise, PhWarningCircle } from '@phosphor-icons/vue'
import { computed, ref, shallowRef, watch } from 'vue'
import { errorMessage } from '@/shared/lib/errorMessage'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/presentation/ui/dialog'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/presentation/ui/tabs'
import type { Character } from '../../domain/Character'
import {
  groupGear,
  groupSkills,
  SKILL_CATEGORY_LABEL,
  titleCategoryLabel,
  type CharacterBuild,
} from '../../domain/CharacterBuild'
import { formatCombatPower, formatCombatPowerFull } from '../formatCombatPower'
import ClassIcon from '../components/ClassIcon.vue'
import { gradeClass, loadBuild } from './buildCache'
import GearSlot from './GearSlot.vue'

/**
 * Ficha do personagem com dados ao vivo do jogo. O conteúdo do slot padrão
 * vira o gatilho (um botão), e nada é buscado antes de abrir.
 */
const props = defineProps<{ character: Character }>()

const open = ref(false)
const build = shallowRef<CharacterBuild | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const missing = ref(false)

const ref_ = computed(() => ({
  region: props.character.region,
  serverId: props.character.serverId,
  id: props.character.id,
}))

async function load() {
  loading.value = true
  error.value = null
  try {
    const found = await loadBuild(ref_.value)
    build.value = found
    missing.value = !found
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen && !build.value) void load()
})

const gearGroups = computed(() => (build.value ? groupGear(build.value.equipment) : []))
/**
 * Duas colunas independentes, como a tela do jogo: armas e armadura de um lado,
 * acessórios, runas e arcanas do outro. (Grade de linhas deixava buracos.)
 */
const LEFT = new Set(['weapons', 'armor'])
const gearColumns = computed(() => [
  gearGroups.value.filter((g) => LEFT.has(g.id)),
  gearGroups.value.filter((g) => !LEFT.has(g.id)),
])
const skillGroups = computed(() => (build.value ? groupSkills(build.value.skills) : []))
const baseStats = computed(() => build.value?.stats.filter((s) => s.kind === 'base') ?? [])
const divineStats = computed(() => build.value?.stats.filter((s) => s.kind === 'divine') ?? [])

const number = new Intl.NumberFormat('pt-BR')
const summary = computed(() => {
  const c = props.character
  const itemLevel = build.value?.itemLevel ?? c.itemLevel
  return [c.className, c.serverName, `nível ${c.level}`, itemLevel ? `item level ${number.format(itemLevel)}` : null]
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>

    <DialogContent :class="cn(`faction-${character.faction}`, 'flex h-[min(90dvh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl')">
      <DialogHeader class="flex-none flex-row items-center gap-3 px-6 pt-6 pb-4 pr-12 text-left">
        <img
          v-if="character.portraitUrl"
          :src="character.portraitUrl"
          alt=""
          class="size-14 flex-none rounded-xl bg-faction-soft object-cover object-top"
        />
        <div class="min-w-0">
          <DialogTitle class="flex items-center gap-2 font-display text-3xl leading-none">
            <ClassIcon v-if="character.className" :class-name="character.className" />
            <span class="truncate">{{ character.name }}</span>
            <span
              v-if="character.combatPower"
              class="ml-1 text-xl text-muted-foreground tabular-nums"
              :title="`${formatCombatPowerFull(character.combatPower)} CP`"
            >
              {{ formatCombatPower(character.combatPower) }} CP
            </span>
          </DialogTitle>
          <DialogDescription class="mt-1">{{ summary }}</DialogDescription>
        </div>
      </DialogHeader>

      <!-- Skeleton com a mesma estrutura da aba de equipamento. -->
      <div v-if="loading" class="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label="Carregando equipamento">
        <Skeleton class="mx-6 mb-3 h-9 flex-none rounded-lg" />
        <div class="grid min-h-0 flex-1 gap-x-6 overflow-hidden border-t px-6 pt-4 sm:grid-cols-2">
          <div v-for="col in 2" :key="col" :class="cn('space-y-5', col === 2 && 'max-sm:hidden')">
            <section v-for="(rows, si) in col === 1 ? [2, 8] : [8, 2]" :key="si">
              <Skeleton class="mb-2.5 h-3 w-20" />
              <div v-for="r in rows" :key="r" class="flex items-center gap-3 p-1.5">
                <Skeleton class="size-11 flex-none rounded-md" />
                <div class="min-w-0 flex-1 space-y-1.5">
                  <Skeleton class="h-3 w-16" />
                  <Skeleton class="h-4" :style="{ width: `${55 + ((r * 37 + si * 13 + col * 7) % 35)}%` }" />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div v-else-if="error" role="alert" class="space-y-3 px-6 pb-6 text-sm">
        <p class="flex items-center gap-2 text-destructive-ink"><PhWarningCircle :size="18" /> {{ error }}</p>
        <Button variant="outline" size="sm" @click="load"><PhArrowClockwise /> Tentar de novo</Button>
      </div>

      <p v-else-if="missing" class="px-6 pb-6 text-sm text-muted-foreground">
        O jogo não encontrou este personagem. Ele pode ter sido renomeado, transferido ou excluído.
      </p>

      <Tabs v-else-if="build" default-value="gear" class="min-h-0 flex-1 gap-0">
        <TabsList class="mx-6 mb-3 w-auto flex-none">
          <TabsTrigger value="gear" class="px-1 text-[13px] sm:px-2 sm:text-sm">Equipamento</TabsTrigger>
          <TabsTrigger value="stats" class="px-1 text-[13px] sm:px-2 sm:text-sm">Atributos</TabsTrigger>
          <TabsTrigger value="skills" class="px-1 text-[13px] sm:px-2 sm:text-sm">Skills</TabsTrigger>
          <TabsTrigger value="daevanion" class="px-1 text-[13px] sm:px-2 sm:text-sm">Daevanion</TabsTrigger>
        </TabsList>

        <!-- Equipamento -->
        <TabsContent value="gear" class="scroll-thin min-h-0 overflow-y-auto border-t px-6 pt-4 pb-6 space-y-5">
          <p v-if="!build.equipment.length" class="text-sm text-muted-foreground">Nada equipado.</p>
          <div class="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <div v-for="(column, ci) in gearColumns" :key="ci" class="min-w-0 space-y-5">
              <section v-for="g in column" :key="g.id">
                <h3 class="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{{ g.label }}</h3>
                <ul>
                  <li v-for="item in g.items" :key="item.slot">
                    <GearSlot :gear="item" :character-ref="ref_" />
                  </li>
                </ul>
              </section>

              <template v-if="ci === 0">
                <section v-if="build.wing || build.pet">
                  <h3 class="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Asas e pet</h3>
                  <ul class="space-y-1">
                    <li v-if="build.wing" :class="cn(gradeClass(build.wing.grade), 'flex items-center gap-3 p-1.5')">
                      <img
                        v-if="build.wing.icon"
                        :src="build.wing.icon"
                        alt=""
                        class="size-11 rounded-md border-2 border-(--grade) bg-icon-well object-contain"
                      />
                      <span class="min-w-0">
                        <span class="block text-xs text-muted-foreground">Asas</span>
                        <span class="block truncate text-sm font-medium text-(--grade-ink)">
                          {{ build.wing.name }}<template v-if="build.wing.enchantLevel"> +{{ build.wing.enchantLevel }}</template>
                        </span>
                      </span>
                    </li>
                    <li v-if="build.pet" class="flex items-center gap-3 p-1.5">
                      <img
                        v-if="build.pet.icon"
                        :src="build.pet.icon"
                        alt=""
                        class="size-11 rounded-md bg-icon-well object-contain"
                      />
                      <span class="min-w-0">
                        <span class="block text-xs text-muted-foreground">Pet, nível {{ build.pet.level }}</span>
                        <span class="block truncate text-sm font-medium">{{ build.pet.name }}</span>
                      </span>
                    </li>
                  </ul>
                </section>
              </template>
            </div>
          </div>
          <p class="text-xs text-muted-foreground">Toque numa peça para ver atributos e pedras de mana.</p>
        </TabsContent>

        <!-- Atributos -->
        <TabsContent value="stats" class="scroll-thin min-h-0 overflow-y-auto border-t px-6 pt-4 pb-6 space-y-6">
          <section>
            <h3 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Atributos base</h3>
            <dl class="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div v-for="s in baseStats" :key="s.type" class="rounded-lg border bg-card/60 p-3">
                <dt class="text-xs text-muted-foreground">{{ s.name }}</dt>
                <dd class="font-display text-2xl leading-tight font-semibold tabular-nums">{{ s.value }}</dd>
                <dd v-for="e in s.effects" :key="e" class="text-xs text-muted-foreground">{{ e }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="divineStats.length">
            <h3 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Atributos divinos</h3>
            <dl class="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div v-for="s in divineStats" :key="s.type" class="rounded-lg border bg-card/60 p-3">
                <dt class="text-xs text-muted-foreground">{{ s.name }}</dt>
                <dd class="font-display text-2xl leading-tight font-semibold tabular-nums">{{ s.value }}</dd>
                <dd v-for="e in s.effects" :key="e" class="text-xs text-muted-foreground">{{ e }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="build.titles.length">
            <h3 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Títulos equipados</h3>
            <ul class="grid gap-2 sm:grid-cols-3">
              <li
                v-for="t in build.titles"
                :key="t.category"
                :class="cn(gradeClass(t.grade), 'rounded-lg border border-l-4 border-l-(--grade) bg-card/60 p-3')"
              >
                <p class="text-xs text-muted-foreground">{{ titleCategoryLabel(t.category) }}</p>
                <p class="font-medium text-(--grade-ink)">{{ t.name }}</p>
                <p v-for="e in t.effects" :key="e" class="text-xs text-muted-foreground">{{ e }}</p>
              </li>
            </ul>
          </section>
        </TabsContent>

        <!-- Skills -->
        <TabsContent value="skills" class="scroll-thin min-h-0 overflow-y-auto border-t px-6 pt-4 pb-6 space-y-5">
          <p v-if="!skillGroups.length" class="text-sm text-muted-foreground">Nenhuma skill aprendida.</p>
          <section v-for="g in skillGroups" :key="g.category">
            <h3 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {{ SKILL_CATEGORY_LABEL[g.category] }}
            </h3>
            <ul class="grid grid-cols-1 gap-1 sm:grid-cols-2">
              <li
                v-for="s in g.skills"
                :key="s.id"
                :class="cn('flex items-center gap-3 rounded-lg p-1.5', !s.equipped && g.category !== 'passive' && 'opacity-60')"
              >
                <img
                  v-if="s.icon"
                  :src="s.icon"
                  alt=""
                  loading="lazy"
                  :class="cn('size-10 flex-none rounded-md', s.equipped && 'ring-2 ring-faction')"
                />
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium">{{ s.name }}</span>
                  <span class="block text-xs text-muted-foreground">
                    Nível {{ s.level }}<template v-if="s.equipped && g.category !== 'passive'">, na barra</template>
                  </span>
                </span>
              </li>
            </ul>
          </section>
        </TabsContent>

        <!-- Daevanion -->
        <TabsContent value="daevanion" class="scroll-thin min-h-0 overflow-y-auto border-t px-6 pt-4 pb-6 space-y-3">
          <p v-if="!build.daevanion.length" class="text-sm text-muted-foreground">Nenhum tabuleiro aberto ainda.</p>
          <ul class="grid gap-2 sm:grid-cols-2">
            <li v-for="b in build.daevanion" :key="b.id" class="flex items-center gap-3 rounded-lg border bg-card/60 p-3">
              <img v-if="b.icon" :src="b.icon" alt="" class="size-10 flex-none" loading="lazy" />
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-2">
                  <p class="font-medium">{{ b.name }}</p>
                  <p class="text-sm text-muted-foreground tabular-nums">{{ b.openNodes }}/{{ b.totalNodes }}</p>
                </div>
                <div
                  class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  :aria-label="`${b.name}: ${b.openNodes} de ${b.totalNodes} nós`"
                  :aria-valuenow="b.openNodes"
                  :aria-valuemax="b.totalNodes"
                >
                  <div
                    class="h-full rounded-full bg-faction"
                    :style="{ width: `${b.totalNodes ? (b.openNodes / b.totalNodes) * 100 : 0}%` }"
                  />
                </div>
              </div>
            </li>
          </ul>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
