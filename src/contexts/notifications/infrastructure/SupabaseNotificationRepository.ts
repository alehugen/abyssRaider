import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppNotification, NotificationKind, NotificationRepository } from '../domain/Notification'

interface Row {
  id: number
  kind: NotificationKind
  party_id: string | null
  data: AppNotification['data'] | null
  created_at: string
  read_at: string | null
}

const COLUMNS = 'id, kind, party_id, data, created_at, read_at'

const toNotification = (r: Row): AppNotification => ({
  id: r.id,
  kind: r.kind,
  partyId: r.party_id,
  data: r.data ?? {},
  createdAt: new Date(r.created_at),
  readAt: r.read_at ? new Date(r.read_at) : null,
})

export class SupabaseNotificationRepository implements NotificationRepository {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async list(userId: string, limit = 30): Promise<AppNotification[]> {
    const { data, error } = await this.client
      .from('notifications')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data as Row[]).map(toNotification)
  }

  async markRead(ids: readonly number[]): Promise<void> {
    if (!ids.length) return
    const { error } = await this.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', [...ids])
    if (error) throw error
  }

  async markAllRead(userId: string): Promise<void> {
    const { error } = await this.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
    if (error) throw error
  }

  subscribe(userId: string, onNew: (n: AppNotification) => void): () => void {
    const channel = this.client
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => onNew(toNotification(payload.new as Row)),
      )
      .subscribe()
    return () => void this.client.removeChannel(channel)
  }
}
