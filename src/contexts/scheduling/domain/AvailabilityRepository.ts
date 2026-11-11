import type { Region } from '@/contexts/character/domain/Character'
import type { TimeWindow } from './Availability'

export interface AvailabilityRepository {
  listByOwner(ownerId: string): Promise<TimeWindow[]>
  /** Disponibilidade de várias contas (membros de uma party). Quem não preencheu não aparece no mapa. */
  listByOwners(ownerIds: readonly string[]): Promise<Map<string, TimeWindow[]>>
  /** Substitui toda a disponibilidade da conta logada. */
  save(windows: readonly TimeWindow[]): Promise<void>
  /** Faixas anônimas de todos os jogadores com personagem na região (as duas facções). */
  demand(region: Region): Promise<TimeWindow[]>
}
