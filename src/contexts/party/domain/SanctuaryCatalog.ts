import type { Sanctuary } from './Sanctuary'

export interface SanctuaryCatalog {
  /** Só os santuários ativos (os que aceitam parties). */
  listActive(): Promise<Sanctuary[]>
}
