/** Erro de regra de negócio. `code` é estável e pode ser traduzido na UI. */
export class DomainError extends Error {
  readonly code: string

  constructor(code: string, message?: string) {
    super(message ?? code)
    this.name = 'DomainError'
    this.code = code
  }
}
