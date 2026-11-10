import { getContainer } from '@/app/container'
import type { CharacterBuild, Gear, GearDetail } from '../../domain/CharacterBuild'
import type { CharacterRef } from '../../domain/CharacterDirectory'

/**
 * Cache em memória das consultas de build: abrir o mesmo personagem duas vezes
 * (ou o mesmo item) não bate de novo na API. A CDN da Vercel ainda guarda 5 min.
 * Erros não ficam no cache, para o "tentar de novo" funcionar.
 */
const builds = new Map<string, Promise<CharacterBuild | null>>()
const gears = new Map<string, Promise<GearDetail>>()

const refKey = (ref: CharacterRef) => `${ref.region}:${ref.serverId}:${ref.id}`

function cached<T>(map: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  let promise = map.get(key)
  if (!promise) {
    promise = load()
    map.set(key, promise)
    promise.catch(() => map.delete(key))
  }
  return promise
}

export function loadBuild(ref: CharacterRef): Promise<CharacterBuild | null> {
  return cached(builds, refKey(ref), () => getContainer().characterDirectory.build(ref))
}

export function loadGear(ref: CharacterRef, gear: Gear): Promise<GearDetail> {
  const key = `${refKey(ref)}:${gear.slot}:${gear.itemId}:${gear.enchantLevel}`
  return cached(gears, key, () => getContainer().characterDirectory.gear(ref, gear))
}

const GRADE_CLASS: Record<string, string> = {
  Common: 'grade-common',
  Rare: 'grade-rare',
  Legend: 'grade-legend',
  Unique: 'grade-unique',
  Epic: 'grade-epic',
  Special: 'grade-special',
  Mythic: 'grade-mythic',
}

/** Classe CSS da raridade (define --grade e --grade-ink). */
export function gradeClass(grade: string): string {
  return GRADE_CLASS[grade] ?? 'grade-common'
}
