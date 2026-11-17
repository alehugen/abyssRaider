/**
 * Junta os textos de todos os contextos: messages[idioma][namespace].
 * Cada contexto tem o seu `i18n.ts`; o namespace é a chave abaixo.
 */
import app from '@/app/i18n'
import character from '@/contexts/character/i18n'
import identity from '@/contexts/identity/i18n'
import notifications from '@/contexts/notifications/i18n'
import party from '@/contexts/party/i18n'
import patchnotes from '@/contexts/patchnotes/i18n'
import scheduling from '@/contexts/scheduling/i18n'
import common from './common'
import type { ContextMessages } from './defineMessages'

const modules: Record<string, ContextMessages<Record<string, unknown>>> = {
  common,
  app,
  identity,
  character,
  party,
  scheduling,
  notifications,
  patchnotes,
}

const build = (locale: 'pt-BR' | 'en' | 'es') =>
  Object.fromEntries(Object.entries(modules).map(([ns, m]) => [ns, m[locale]]))

export const messages = { 'pt-BR': build('pt-BR'), en: build('en'), es: build('es') }
