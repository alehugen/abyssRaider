<script setup lang="ts">
import { PhMagnifyingGlass, PhSword } from '@phosphor-icons/vue'
import { onMounted, ref } from 'vue'
import DiscordLoginButton from '@/contexts/identity/presentation/components/DiscordLoginButton.vue'
import { useAuthStore } from '@/contexts/identity/presentation/useAuthStore'
import { Button } from '@/shared/presentation/ui/button'

const auth = useAuthStore()

/** Wallpaper animado do site oficial do Aion 2 (CDN da NCSOFT, ~7 MB, com cache). */
const WALLPAPER = 'https://vod.plaync.com/Aion2/260930/cm_bg_pc.mp4'

const video = ref<HTMLVideoElement | null>(null)
const ready = ref(false)

onMounted(() => {
  // Com "reduzir movimento" o vídeo fica parado no primeiro quadro.
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduce) void video.value?.play().catch(() => {})
})
</script>

<template>
  <!-- Hero de ponta a ponta: escapa do container do layout. -->
  <section class="relative -mt-8 left-1/2 w-screen -translate-x-1/2 overflow-hidden">
    <video
      ref="video"
      :src="WALLPAPER"
      muted
      loop
      playsinline
      preload="metadata"
      aria-hidden="true"
      class="absolute inset-0 size-full object-cover transition-opacity duration-1000"
      :class="ready ? 'opacity-100' : 'opacity-0'"
      @loadeddata="ready = true"
    />
    <div
      class="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0.12_0.03_260/0.55),oklch(0.12_0.03_260/0.25)_45%,var(--background))]"
      aria-hidden="true"
    />

    <div class="relative mx-auto flex min-h-[78dvh] max-w-6xl flex-col items-center justify-center px-4 py-24 text-center">
      <h1
        class="max-w-3xl font-display text-5xl leading-[1.1] font-bold text-balance text-white drop-shadow-[0_2px_16px_rgb(0_0_0/0.6)] sm:text-6xl"
      >
        Organize suas raids de Aion 2
      </h1>
      <p class="mt-5 max-w-xl text-lg text-balance text-white/85 drop-shadow-[0_1px_8px_rgb(0_0_0/0.6)]">
        Entre com o Discord, vincule seu personagem e encontre uma party para o próximo santuário.
      </p>

      <div class="mt-9 flex flex-wrap justify-center gap-3">
        <template v-if="auth.isAuthenticated">
          <Button size="lg" as-child class="shadow-lg shadow-glow">
            <RouterLink :to="{ name: 'find-parties' }">
              <PhMagnifyingGlass :size="20" />
              Buscar parties
            </RouterLink>
          </Button>
          <Button size="lg" variant="outline" as-child class="border-white/30 bg-black/30 text-white backdrop-blur hover:bg-black/50 hover:text-white">
            <RouterLink to="/me">
              <PhSword :size="20" />
              Meus personagens
            </RouterLink>
          </Button>
        </template>
        <DiscordLoginButton v-else-if="auth.status === 'anonymous'" next="/me" size="lg" class="shadow-lg" />
      </div>
    </div>
  </section>
</template>
