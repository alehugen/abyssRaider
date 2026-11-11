import { APP_TIME_ZONE } from '@/shared/lib/brasilia'

/**
 * Notificação dentro do app. O banco guarda só o tipo e os dados; o texto é
 * montado aqui (horários sempre no horário de Brasília).
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

const when = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

function raidTime(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : when.format(d).replace(' às ', ', às ')
}

export function describeNotification(n: AppNotification): NotificationView {
  const party = n.data.party_name ?? 'a party'
  const char = n.data.character_name ?? 'Um jogador'
  const link = n.partyId ? `/parties/${n.partyId}` : null
  switch (n.kind) {
    case 'invite_received':
      return {
        title: `Convite para ${party}`,
        body: `${n.data.leader_name ?? 'O líder'} convidou ${n.data.character_name ?? 'você'}. Aceite ou recuse na página da party.`,
        tone: 'invite',
        link,
      }
    case 'invite_accepted':
      return { title: `${char} aceitou o convite`, body: `Agora faz parte de ${party}.`, tone: 'success', link }
    case 'request_received':
      return { title: `${char} pediu para entrar`, body: `Em ${party}. Aceite ou recuse na página da party.`, tone: 'invite', link }
    case 'request_accepted':
      return { title: `Você entrou em ${party}`, body: `O líder aceitou ${n.data.character_name ?? 'seu personagem'}.`, tone: 'success', link }
    case 'request_declined':
      return {
        title: 'Pedido recusado',
        body: `O líder de ${party} recusou ${n.data.character_name ?? 'seu personagem'}.`,
        tone: 'warning',
        link,
      }
    case 'raid_scheduled': {
      const at = raidTime(n.data.starts_at)
      return {
        title: `Raid marcada em ${party}`,
        body: [at && `${at} (horário de Brasília). Confirme sua presença.`, n.data.note && `“${n.data.note}”`]
          .filter(Boolean)
          .join(' '),
        tone: 'raid',
        link,
      }
    }
    case 'party_deleted':
      return {
        title: `${party} foi excluída`,
        body: 'O líder encerrou a party. As raids marcadas nela foram canceladas.',
        tone: 'cancel',
        link: null,
      }
    case 'raid_cancelled': {
      const at = raidTime(n.data.starts_at)
      return {
        title: `Raid cancelada em ${party}`,
        body: at ? `A raid de ${at} foi cancelada.` : 'Uma raid foi cancelada.',
        tone: 'cancel',
        link,
      }
    }
  }
}

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

/** "agora", "há 5 minutos", "há 3 horas", "ontem", "há 4 dias". */
export function timeAgo(date: Date, now = new Date()): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'agora'
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
