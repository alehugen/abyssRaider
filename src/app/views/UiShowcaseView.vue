<script setup lang="ts">
import type { Character } from '@/contexts/character/domain/Character'
import CharacterCard from '@/contexts/character/presentation/components/CharacterCard.vue'
import InspectCharacter from '@/contexts/character/presentation/inspect/InspectCharacter.vue'
import AvailabilityDialog from '@/contexts/scheduling/presentation/components/AvailabilityDialog.vue'
import PartySummaryCard from '@/contexts/party/presentation/components/PartySummaryCard.vue'
import type { PartySummary } from '@/contexts/party/domain/Party'
import PartyNotificationsDialog from '@/contexts/party/presentation/components/PartyNotificationsDialog.vue'
import ScheduleRaidDialog from '@/contexts/scheduling/presentation/components/ScheduleRaidDialog.vue'
import { nextSlotStart } from '@/contexts/scheduling/domain/Availability'
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

// Personagem real (dados públicos da API do jogo) para testar o inspecionar.
const inspectSample: Character = {
  id: 'XhMV1CTzq462ZgV191XmXDNgrXceXZxkUvAWjgwVVRc=',
  name: 'Lu',
  faction: 'asmodian',
  className: 'Gladiator',
  level: 45,
  region: 'eu',
  serverId: 2323,
  serverName: 'Tassin',
  combatPower: 160013,
}

// Sugestões de exemplo para o diálogo de agendar.
const scheduleOptions = [
  { date: nextSlotStart({ weekday: 3, start: 19 * 60 }), detail: '8 de 10 livres' },
  { date: nextSlotStart({ weekday: 4, start: 20 * 60 }), detail: '7 de 10 livres' },
  { date: nextSlotStart({ weekday: 6, start: 15 * 60 }), detail: '6 de 10 livres' },
]

// Cards da lista de parties (arte do santuário + líder em destaque).
const LUDRA_ART = 'https://fizz-download.playnccdn.com/download/v2/buckets/conti-upload/files/1a1a3b9ac4e-b936c323-6cbb-4357-9c39-9367df642465'
const partySamples: PartySummary[] = [
  { leaderCharacterName: 'BOOMSHAKALAK', leaderClassName: 'Cleric', acceptedCount: 4, myStatus: 'leader' },
  { leaderCharacterName: 'Lyrandel', leaderClassName: 'Templar', acceptedCount: 9, myStatus: 'accepted' },
].map((x, i) => ({
  ...x,
  party: {
    id: `demo-${i}`,
    name: i ? 'Ludra de sábado' : 'Ludra',
    sanctuary: { id: 'ludra', name: 'Abyssal Forge: Ludra', minItemLevel: 2800, groupSize: 10, imageUrl: LUDRA_ART },
    leaderId: 'x',
    leaderCharacterLinkId: 'y',
    region: 'la',
    faction: i ? 'elyos' : 'asmodian',
    createdAt: new Date(),
    routine: { days: [3, 4], time: '19:00', timeZone: 'America/Sao_Paulo' },
  },
})) as PartySummary[]
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

    <section class="space-y-4">
      <h2 class="font-display text-xl font-semibold">Inspecionar (API real)</h2>
      <InspectCharacter :character="inspectSample">
        <Button id="inspect-demo" variant="outline">Inspecionar {{ inspectSample.name }}</Button>
      </InspectCharacter>
    </section>

    <section class="space-y-4">
      <h2 class="font-display text-xl font-semibold">Disponibilidade (editor)</h2>
      <AvailabilityDialog>
        <Button id="availability-demo" variant="outline">Editar disponibilidade</Button>
      </AvailabilityDialog>
    </section>

    <section id="schedule-demo" class="space-y-4">
      <h2 class="font-display text-xl font-semibold">Agendar raid da semana</h2>
      <ScheduleRaidDialog :options="scheduleOptions" />
    </section>

    <section id="party-cards" class="max-w-4xl space-y-3">
      <h2 class="font-display text-xl font-semibold">Cards de party</h2>
      <PartySummaryCard v-for="p in partySamples" :key="p.party.id" :item="p" />
    </section>

    <section id="notify-demo" class="space-y-4">
      <h2 class="font-display text-xl font-semibold">Avisos no Discord</h2>
      <PartyNotificationsDialog party-id="00000000-0000-0000-0000-000000000000">
        <Button variant="outline">Avisos no Discord</Button>
      </PartyNotificationsDialog>
    </section>
  </div>
</template>
