<script setup lang="ts">
import type { Character } from '@/contexts/character/domain/Character'
import CharacterCard from '@/contexts/character/presentation/components/CharacterCard.vue'
import { Button } from '@/shared/presentation/ui/button'

// Dados fictícios só para visualizar os componentes (rota disponível apenas em dev).
const characters: Character[] = [
  {
    id: 'demo-1',
    name: 'Lyrandel',
    portraitUrl: 'https://profileimg.plaync.com/game_profile_images/aion2global/images?gameServerKey=1313&charKey=369576644421273464',
    faction: 'elyos',
    className: 'Templar',
    level: 45,
    region: 'nae',
    serverId: 1101,
    serverName: 'Siel',
    combatPower: 204346,
    itemLevel: 1820,
    legionName: 'Aurora',
  },
  {
    id: 'demo-2',
    name: 'Vharkos',
    faction: 'asmodian',
    className: 'Sorcerer',
    level: 45,
    region: 'nae',
    serverId: 1102,
    serverName: 'Lumiel',
    combatPower: 189413,
    itemLevel: 1795,
    legionName: 'Nocturne',
  },
  {
    id: 'demo-3',
    name: 'Seraphine',
    faction: 'elyos',
    className: 'Cleric',
    level: 44,
    region: 'eu',
    serverId: 1311,
    serverName: 'Tahavatha',
    combatPower: 162008,
  },
  {
    id: 'demo-4',
    name: 'Morkhal',
    faction: 'asmodian',
    className: 'Chanter',
    level: 45,
    region: 'eu',
    serverId: 1312,
    serverName: 'Ariel',
    combatPower: 171250,
    itemLevel: 1760,
  },
]
</script>

<template>
  <div class="space-y-10">
    <header>
      <h1 class="font-display text-3xl font-bold">Componentes</h1>
      <p class="text-muted-foreground">Troque o tema no topo para comparar Elyos, Asmodian e Abyss.</p>
    </header>

    <section class="space-y-4">
      <h2 class="font-display text-xl font-semibold">Nameplate</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <CharacterCard :character="characters[0]!" role="Líder" footnote="Atualizado há 5 minutos" />
        <CharacterCard :character="characters[1]!" role="Seu personagem">
          <template #actions>
            <Button size="sm">Aplicar</Button>
          </template>
        </CharacterCard>
        <CharacterCard :character="characters[2]!" role="Ausente" inactive />
        <CharacterCard :character="characters[3]!" />
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="font-display text-xl font-semibold">Linha compacta (busca e party)</h2>
      <div class="grid max-w-md gap-2">
        <CharacterCard v-for="c in characters" :key="c.id" :character="c" size="sm" />
      </div>
    </section>
  </div>
</template>
