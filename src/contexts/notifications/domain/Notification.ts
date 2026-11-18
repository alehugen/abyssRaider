import { t } from '@/shared/i18n'
import { dateFormat, relativeFormat } from '@/shared/i18n/format'
import { APP_TIME_ZONE, tzLabel } from '@/shared/lib/brasilia'

/**
 * Notificação dentro do app. O banco guarda só o tipo e os dados; o texto é
 * montado aqui, no idioma da tela (horários sempre no horário de Brasília).
 */
export type NotificationKind =
  | 'invite_received'
  | 'invite_accepted'
  | 'request_received'
  | 'request_accepted'
  | 'request_declined'
  | 'raid_scheduled'
  | 'raid_cancelled'
  | 'party_deleted'
  | 'raid_reminder'

export interface NotificationData {
  party_name?: string
  character_name?: string
  leader_name?: string
  /** ISO */
  starts_at?: string
  note?: string
}

export interface AppNotification {
  id: number
  kind: NotificationKind
  partyId: string | null
  data: NotificationData
  createdAt: Date
  readAt: Date | null
}

export type NotificationTone = 'invite' | 'success' | 'warning' | 'raid' | 'cancel'

export interface NotificationView {
  title: string
  body: string
  tone: NotificationTone
  /** Rota de destino ao clicar (a party). */
  link: string | null
}

function raidTime(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const opts = { timeZone: APP_TIME_ZONE } as const
  return t('notifications.raidAt', {
    date: dateFormat({ ...opts, weekday: 'long', day: 'numeric', month: 'long' }).format(d),
    time: dateFormat({ ...opts, hour: '2-digit', minute: '2-digit' }).format(d),
  })
}

/** Corpo das notificações de raid marcada/lembrete: horário e recado. */
function raidBody(n: AppNotification): string {
  const at = raidTime(n.data.starts_at)
  return [at && t('notifications.kinds.raidBody', { at, tz: tzLabel() }), n.data.note && `“${n.data.note}”`]
    .filter(Boolean)
    .join(' ')
}

/** Texto no idioma da tela (montado na hora de exibir). */
export function describeNotification(n: AppNotification): NotificationView {
  const party = n.data.party_name ?? t('notifications.fallback.party')
  const char = n.data.character_name ?? t('notifications.fallback.player')
  const yourChar = n.data.character_name ?? t('notifications.fallback.yourCharacter')
  const link = n.partyId ? `/parties/${n.partyId}` : null
  const k = 'notifications.kinds'
  switch (n.kind) {
    case 'invite_received': {
      const leader = n.data.leader_name ?? t('notifications.fallback.leader')
      return {
        title: t(`${k}.inviteReceived.title`, { party }),
        body: n.data.character_name
          ? t(`${k}.inviteReceived.body`, { leader, character: n.data.character_name })
          : t(`${k}.inviteReceived.bodyYou`, { leader }),
        tone: 'invite',
        link,
      }
    }
    case 'invite_accepted':
      return {
        title: t(`${k}.inviteAccepted.title`, { character: char }),
        body: t(`${k}.inviteAccepted.body`, { party }),
        tone: 'success',
        link,
      }
    case 'request_received':
      return {
        title: t(`${k}.requestReceived.title`, { character: char }),
        body: t(`${k}.requestReceived.body`, { party }),
        tone: 'invite',
        link,
      }
    case 'request_accepted':
      return {
        title: t(`${k}.requestAccepted.title`, { party }),
        body: t(`${k}.requestAccepted.body`, { character: yourChar }),
        tone: 'success',
        link,
      }
    case 'request_declined':
      return {
        title: t(`${k}.requestDeclined.title`),
        body: t(`${k}.requestDeclined.body`, { party, character: yourChar }),
        tone: 'warning',
        link,
      }
    case 'raid_scheduled':
      return { title: t(`${k}.raidScheduled.title`, { party }), body: raidBody(n), tone: 'raid', link }
    case 'raid_reminder':
      return { title: t(`${k}.raidReminder.title`, { party }), body: raidBody(n), tone: 'raid', link }
    case 'party_deleted':
      return {
        title: t(`${k}.partyDeleted.title`, { party }),
        body: t(`${k}.partyDeleted.body`),
        tone: 'cancel',
        link: null,
      }
    case 'raid_cancelled': {
      const at = raidTime(n.data.starts_at)
      return {
        title: t(`${k}.raidCancelled.title`, { party }),
        body: at ? t(`${k}.raidCancelled.body`, { at }) : t(`${k}.raidCancelled.bodyNoDate`),
        tone: 'cancel',
        link,
      }
    }
  }
}

/** "agora", "há 5 minutos", "há 3 horas", "ontem", "há 4 dias". */
export function timeAgo(date: Date, now = new Date()): string {
  const relative = relativeFormat()
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return t('notifications.now')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return relative.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  return relative.format(-Math.round(hours / 24), 'day')
}

export interface NotificationRepository {
  list(userId: string, limit?: number): Promise<AppNotification[]>
  markRead(ids: readonly number[]): Promise<void>
  markAllRead(userId: string): Promise<void>
  /** Avisa quando chega uma nova (tempo real). Devolve a função para parar. */
  subscribe(userId: string, onNew: (n: AppNotification) => void): () => void
}
