import type { RaidApplication } from './RaidApplication'
import type { Sanctuary } from './Sanctuary'

export interface SanctuaryCatalog {
  /** Só os santuários abertos para aplicação. */
  listActive(): Promise<Sanctuary[]>
}

export interface RaidApplicationRepository {
  listByOwner(ownerId: string): Promise<RaidApplication[]>
  create(characterLinkId: string, sanctuaryId: string): Promise<RaidApplication>
  withdraw(applicationId: string): Promise<void>
}
