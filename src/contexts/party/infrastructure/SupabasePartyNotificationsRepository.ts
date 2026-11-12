import type { SupabaseClient } from '@supabase/supabase-js'
import { DomainError } from '@/shared/domain/DomainError'
import type {
  PartyNotifications,
  PartyNotificationsRepository,
  ReminderMinutes,
} from '../domain/PartyNotifications'

interface Row {
  webhook_url: string
  notify_scheduled: boolean
  notify_reminder: boolean
  notify_cancelled: boolean
  notify_requests: boolean
  reminder_minutes: number
}

function rethrow(error: { code?: string; message: string }): never {
  if (error.code === 'P0001') throw new DomainError('notifications.rule', error.message)
  if (error.code === '23514' && error.message.includes('webhook_url')) {
    throw new DomainError('notifications.url', 'Essa não é uma URL de webhook do Discord.')
  }
  throw error
}

export class SupabasePartyNotificationsRepository implements PartyNotificationsRepository {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async get(partyId: string): Promise<PartyNotifications | null> {
    const { data, error } = await this.client
      .from('party_notifications')
      .select('webhook_url, notify_scheduled, notify_reminder, notify_cancelled, notify_requests, reminder_minutes')
      .eq('party_id', partyId)
      .maybeSingle()
    if (error) rethrow(error)
    const r = data as Row | null
    return r
      ? {
          webhookUrl: r.webhook_url,
          scheduled: r.notify_scheduled,
          reminder: r.notify_reminder,
          cancelled: r.notify_cancelled,
          requests: r.notify_requests,
          reminderMinutes: r.reminder_minutes as ReminderMinutes,
        }
      : null
  }

  async save(partyId: string, s: PartyNotifications, appUrl: string): Promise<void> {
    const { error } = await this.client.from('party_notifications').upsert({
      party_id: partyId,
      webhook_url: s.webhookUrl.trim(),
      app_url: appUrl,
      notify_scheduled: s.scheduled,
      notify_reminder: s.reminder,
      notify_cancelled: s.cancelled,
      notify_requests: s.requests,
      reminder_minutes: s.reminderMinutes,
      updated_at: new Date().toISOString(),
    })
    if (error) rethrow(error)
  }

  async remove(partyId: string): Promise<void> {
    const { error } = await this.client.from('party_notifications').delete().eq('party_id', partyId)
    if (error) rethrow(error)
  }

  async test(partyId: string): Promise<void> {
    const { error } = await this.client.rpc('test_party_notifications', { p_party_id: partyId })
    if (error) rethrow(error)
  }

  async announce(partyId: string): Promise<number> {
    const { data, error } = await this.client.rpc('announce_party', { p_party_id: partyId })
    if (error) rethrow(error)
    return Number(data ?? 0)
  }
}
