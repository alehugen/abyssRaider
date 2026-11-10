import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { User } from '@/contexts/identity/domain/User'

type DiscordMetadata = {
  provider_id?: string
  sub?: string
  full_name?: string
  name?: string
  avatar_url?: string
  custom_claims?: { global_name?: string }
}

/** Converte o usuário do Supabase (login via Discord) no User do domínio. */
export function mapSupabaseUser(user: SupabaseUser): User {
  const meta = (user.user_metadata ?? {}) as DiscordMetadata
  const displayName =
    meta.custom_claims?.global_name || meta.full_name || meta.name || user.email?.split('@')[0] || 'Daeva'

  return {
    id: user.id,
    discordId: meta.provider_id ?? meta.sub ?? null,
    displayName,
    avatarUrl: meta.avatar_url ?? null,
  }
}
