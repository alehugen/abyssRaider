/**
 * Notificações push neste aparelho (celular ou computador). Cada aparelho
 * escolhe o que recebe; o texto chega no idioma salvo para ele.
 */
export interface PushPreferences {
  /** Raid marcada, cancelada e lembretes. */
  raids: boolean
  /** Patch notes novos do AION 2. */
  patchNotes: boolean
}

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = { raids: true, patchNotes: true }

export interface PushDevice {
  /** Endereço do serviço de push do navegador (identifica o aparelho). */
  endpoint: string
  p256dh: string
  auth: string
  locale: string
  preferences: PushPreferences
}

export interface PushDeviceRepository {
  /** Este aparelho na conta logada, ou null se não está ativado nela. */
  find(endpoint: string): Promise<{ locale: string; preferences: PushPreferences } | null>
  save(device: PushDevice): Promise<void>
  remove(endpoint: string): Promise<void>
}
