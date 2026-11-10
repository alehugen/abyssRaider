/** Usuário autenticado do AbyssRaider (conta Discord). */
export interface User {
  /** id interno (auth.users.id / profiles.id). */
  id: string
  /** Snowflake do Discord. */
  discordId: string | null
  displayName: string
  avatarUrl: string | null
}

export function userInitials(user: Pick<User, 'displayName'>): string {
  return user.displayName.trim().slice(0, 2).toUpperCase() || '??'
}
