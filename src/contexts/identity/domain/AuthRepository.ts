import type { User } from './User'

/** Porta de autenticação. A implementação concreta fica em infrastructure/. */
export interface AuthRepository {
  /** Resolve a sessão atual (inclusive a troca do código OAuth no retorno do Discord). */
  getCurrentUser(): Promise<User | null>
  /** Redireciona o navegador para o login do Discord. */
  signInWithDiscord(redirectTo: string): Promise<void>
  signOut(): Promise<void>
  /** Notifica mudanças de sessão (login, logout, refresh). Retorna a função para cancelar. */
  onChange(listener: (user: User | null) => void): () => void
}
