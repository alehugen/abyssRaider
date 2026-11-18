import { t } from '@/shared/i18n'

/**
 * Avisos da party num canal do Discord, via webhook. Quem envia é o banco
 * (pg_net + pg_cron); aqui só fica a configuração, que só o líder vê.
 */
export interface PartyNotifications {
  webhookUrl: string
  /** Raid marcada (menciona os membros). */
  scheduled: boolean
  /** Lembrete antes da raid (menciona quem não respondeu). */
  reminder: boolean
  cancelled: boolean
  /** Novo pedido para entrar. */
  requests: boolean
  reminderMinutes: ReminderMinutes
}

/** `label` é getter: texto no idioma da tela, lido na hora de exibir. */
const reminder = <const V extends number>(value: V) => ({
  value,
  get label() {
    return t(`party.notifications.reminderOptions.${value}`)
  },
})

export const REMINDER_OPTIONS = [reminder(30), reminder(60), reminder(180), reminder(1440)] as const

export type ReminderMinutes = (typeof REMINDER_OPTIONS)[number]['value']

export const DEFAULT_NOTIFICATIONS: Omit<PartyNotifications, 'webhookUrl'> = {
  scheduled: true,
  reminder: true,
  cancelled: true,
  requests: true,
  reminderMinutes: 60,
}

/** Mesma regra do banco: só URLs de webhook do Discord. */
export function isDiscordWebhook(url: string): boolean {
  return /^https:\/\/(ptb\.|canary\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.trim())
}

export interface PartyNotificationsRepository {
  /** null quando a party não tem avisos configurados. */
  get(partyId: string): Promise<PartyNotifications | null>
  /** appUrl: endereço do app, usado nos links das mensagens. */
  save(partyId: string, settings: PartyNotifications, appUrl: string): Promise<void>
  remove(partyId: string): Promise<void>
  /** Manda uma mensagem de teste para o canal. */
  test(partyId: string): Promise<void>
  /** Posta a party no canal e marca os convidados que não responderam. Devolve quantos foram marcados. */
  announce(partyId: string): Promise<number>
}
