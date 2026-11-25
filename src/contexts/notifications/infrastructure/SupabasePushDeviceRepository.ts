import type { SupabaseClient } from '@supabase/supabase-js'
import type { PushDevice, PushDeviceRepository, PushPreferences } from '../domain/PushDevice'

interface Row {
  locale: string
  raids: boolean
  patch_notes: boolean
}

/** Tabela push_subscriptions: lê direto (RLS: só as suas); grava pelas funções push_subscribe/push_unsubscribe. */
export class SupabasePushDeviceRepository implements PushDeviceRepository {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async find(endpoint: string): Promise<{ locale: string; preferences: PushPreferences } | null> {
    const { data, error } = await this.client
      .from('push_subscriptions')
      .select('locale, raids, patch_notes')
      .eq('endpoint', endpoint)
      .maybeSingle()
    if (error) throw error
    const row = data as Row | null
    return row ? { locale: row.locale, preferences: { raids: row.raids, patchNotes: row.patch_notes } } : null
  }

  async save(device: PushDevice): Promise<void> {
    const { error } = await this.client.rpc('push_subscribe', {
      p_endpoint: device.endpoint,
      p_p256dh: device.p256dh,
      p_auth: device.auth,
      p_locale: device.locale,
      p_raids: device.preferences.raids,
      p_patch_notes: device.preferences.patchNotes,
    })
    if (error) throw error
  }

  async remove(endpoint: string): Promise<void> {
    const { error } = await this.client.rpc('push_unsubscribe', { p_endpoint: endpoint })
    if (error) throw error
  }
}
