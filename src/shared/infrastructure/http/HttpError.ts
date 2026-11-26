/** Erro da nossa API (/api): a mensagem vem em português e o errorMessage traduz. */
export class HttpError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}
