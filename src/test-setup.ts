/** Testes rodam em pt-BR (o jsdom diz que o navegador é en-US) e com o i18n instalado. */
import { config } from '@vue/test-utils'
import { i18n } from '@/shared/i18n'

i18n.global.locale.value = 'pt-BR'
config.global.plugins = [...(config.global.plugins ?? []), i18n]
