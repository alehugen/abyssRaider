import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthRepository } from '@/contexts/identity/domain/AuthRepository'
import type { User } from '@/contexts/identity/domain/User'
import { mapSupabaseUser } from './mapSupabaseUser'

export class SupabaseAuthRepository implements AuthRepository {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async getCurrentUser(): Promise<User | null> {
    // getSession aguarda a inicialização do cliente, que troca o ?code= do OAuth (PKCE).
    const { data, error } = await this.client.auth.getSession()
    if (error) throw error
    return data.session ? mapSupabaseUser(data.session.user) : null
  }

  async signInWithDiscord(redirectTo: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo, scopes: 'identify' },
    })
    if (error) throw error
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut()
    if (error) throw error
  }

  onChange(listener: (user: User | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      listener(session ? mapSupabaseUser(session.user) : null)
    })
    return () => data.subscription.unsubscribe()
  }
}
