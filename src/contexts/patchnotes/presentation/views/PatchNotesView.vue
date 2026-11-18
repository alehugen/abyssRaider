<script setup lang="ts">
import { PhArrowClockwise, PhArrowSquareOut, PhWarningCircle } from '@phosphor-icons/vue'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getContainer } from '@/app/container'
import { currentLocale, t } from '@/shared/i18n'
import { dateFormat } from '@/shared/i18n/format'
import { APP_TIME_ZONE } from '@/shared/lib/brasilia'
import { errorMessage } from '@/shared/lib/errorMessage'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/ui/button'
import { Skeleton } from '@/shared/presentation/ui/skeleton'
import { countItems, type PatchNote, type PatchNoteSummary } from '../../domain/PatchNote'
import PatchItemList from '../components/PatchItemList.vue'

const repo = getContainer().patchNotesRepository
const route = useRoute()
const router = useRouter()

const list = shallowRef<PatchNoteSummary[]>([])
const note = shallowRef<PatchNote | null>(null)
const loadingList = ref(true)
const loadingNote = ref(false)
const error = ref<string | null>(null)

const selectedId = computed(() => (route.params.id ? String(route.params.id) : (list.value[0]?.id ?? null)))

const day = (d: Date) => dateFormat({ day: 'numeric', month: 'short', timeZone: APP_TIME_ZONE }).format(d)
const fullDate = (d: Date) => dateFormat({ dateStyle: 'long', timeZone: APP_TIME_ZONE }).format(d)
/** "Notas da Atualização | 3 nov (PST) / 4 nov (CET)" -> "3 nov (PST) / 4 nov (CET)" */
const shortTitle = (title: string) => title.split('|').slice(1).join('|').trim() || title

async function loadList() {
  loadingList.value = true
  error.value = null
  try {
    list.value = await repo.list(12)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loadingList.value = false
  }
}

let seq = 0
async function loadNote(id: string | null) {
  if (!id) return
  const mine = ++seq
  loadingNote.value = true
  error.value = null
  try {
    const found = await repo.get(id)
    if (mine !== seq) return
    note.value = found
    if (!found) error.value = t('patchnotes.view.gone')
  } catch (e) {
    if (mine === seq) error.value = errorMessage(e)
  } finally {
    if (mine === seq) loadingNote.value = false
  }
}

onMounted(loadList)
watch(selectedId, (id) => void loadNote(id), { immediate: true })

// Cada idioma é um quadro diferente no site (ids diferentes): ao trocar, volta para
// o patch mais recente e recarrega a lista no novo idioma.
watch(currentLocale, () => {
  seq++ // descarta um artigo que ainda estava carregando no idioma anterior
  list.value = []
  note.value = null
  if (route.params.id) void router.replace({ name: 'patch-notes' })
  void loadList()
})

function retry() {
  if (!list.value.length) void loadList()
  else void loadNote(selectedId.value)
}

function select(id: string) {
  void router.replace({ name: 'patch-notes', params: { id } })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="space-y-8">
    <header class="space-y-2">
      <h1 class="font-display text-4xl leading-tight font-bold">{{ t('patchnotes.view.title') }}</h1>
      <p class="max-w-prose text-muted-foreground">{{ t('patchnotes.view.intro') }}</p>
    </header>

    <div class="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <!-- Atualizações: coluna no desktop, faixa rolável no celular -->
      <nav :aria-label="t('patchnotes.view.updates')" class="lg:sticky lg:top-20 lg:self-start">
        <div v-if="loadingList" class="flex gap-2 overflow-hidden lg:flex-col">
          <Skeleton v-for="i in 5" :key="i" class="h-14 w-40 flex-none rounded-xl lg:w-full" />
        </div>
        <ol v-else class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          <li v-for="(n, i) in list" :key="n.id" class="flex-none">
            <button
              type="button"
              :aria-current="n.id === selectedId ? 'page' : undefined"
              :class="
                cn(
                  'flex w-44 flex-col rounded-xl border px-3 py-2 text-left transition-colors lg:w-full',
                  n.id === selectedId
                    ? 'border-primary/60 bg-primary/10'
                    : 'border-transparent hover:border-border hover:bg-muted/50',
                )
              "
              @click="select(n.id)"
            >
              <span class="font-display text-lg leading-tight font-semibold">{{ day(n.postedAt) }}</span>
              <span class="truncate text-xs text-muted-foreground">
                {{ i === 0 ? t('patchnotes.view.latest') : shortTitle(n.title) }}
              </span>
            </button>
          </li>
        </ol>
      </nav>

      <div class="min-w-0">
        <div v-if="error" role="alert" class="space-y-3 rounded-2xl border border-dashed p-6 text-sm">
          <p class="flex items-center gap-2 text-destructive-ink"><PhWarningCircle :size="18" /> {{ error }}</p>
          <Button size="sm" variant="outline" @click="retry"><PhArrowClockwise /> {{ t('common.actions.retry') }}</Button>
        </div>

        <div v-else-if="loadingNote || loadingList" class="space-y-4" aria-busy="true">
          <Skeleton class="aspect-[1920/622] w-full rounded-2xl" />
          <Skeleton class="h-8 w-2/3" />
          <Skeleton v-for="i in 6" :key="i" class="h-4" :style="{ width: `${55 + ((i * 23) % 40)}%` }" />
        </div>

        <article v-else-if="note" class="space-y-8">
          <header class="space-y-4">
            <img
              src="/patch-notes-banner.jpg"
              alt=""
              width="1920"
              height="622"
              class="aspect-[1920/622] w-full rounded-2xl border object-cover"
            />
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 class="font-display text-3xl leading-tight font-bold">{{ note.title }}</h2>
                <p class="mt-1 text-sm text-muted-foreground">{{ t('patchnotes.view.postedOn', { date: fullDate(note.postedAt) }) }}</p>
              </div>
              <Button variant="outline" size="sm" as-child>
                <a :href="note.url" target="_blank" rel="noopener noreferrer">
                  <PhArrowSquareOut /> {{ t('patchnotes.view.readOfficial') }}
                </a>
              </Button>
            </div>
            <nav v-if="note.sections.length > 1" :aria-label="t('patchnotes.view.sections')" class="flex flex-wrap gap-2">
              <a
                v-for="(s, i) in note.sections"
                :key="i"
                :href="`#secao-${i}`"
                class="rounded-full border px-3 py-1 text-sm hover:bg-muted"
              >
                {{ s.title }} <span class="text-muted-foreground tabular-nums">{{ countItems(s) }}</span>
              </a>
            </nav>
          </header>

          <p v-if="!note.sections.length" class="text-muted-foreground">
            {{ t('patchnotes.view.unparsed') }}
            <a :href="note.url" target="_blank" rel="noopener noreferrer" class="underline">{{
              t('patchnotes.view.readOfficialInline')
            }}</a>.
          </p>

          <section
            v-for="(s, i) in note.sections"
            :id="`secao-${i}`"
            :key="i"
            class="scroll-mt-24 space-y-5 border-t pt-6"
          >
            <h3 class="font-display text-2xl font-semibold">{{ s.title }}</h3>
            <div v-for="(g, j) in s.groups" :key="j" class="space-y-3">
              <h4 v-if="g.title" class="font-semibold text-primary-ink">{{ g.title }}</h4>
              <PatchItemList :items="g.items" />
            </div>
          </section>
        </article>
      </div>
    </div>
  </div>
</template>
