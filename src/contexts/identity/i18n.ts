import { defineMessages } from '@/shared/i18n/defineMessages'

/** Textos do contexto identity (chaves: 'identity.*'). */
export default defineMessages(
  {
    login: {
      title: 'Entrar no AbyssRaider',
      description: 'Usamos sua conta do Discord para identificar você nas parties e enviar avisos de raid.',
      /** {scope} = <code>identify</code> */
      scope: 'Pedimos apenas seu nome e avatar do Discord (escopo {scope}).',
      discord: 'Entrar com Discord',
      redirecting: 'Redirecionando…',
    },
    callback: {
      connecting: 'Conectando com o Discord…',
      failed: 'Não foi possível concluir o login.',
    },
    menu: {
      account: 'Conta de {name}',
      myCharacters: 'Meus personagens',
      signOut: 'Sair',
    },
  },
  {
    login: {
      title: 'Sign in to AbyssRaider',
      description: 'We use your Discord account to identify you in parties and send raid alerts.',
      scope: 'We only ask for your Discord name and avatar ({scope} scope).',
      discord: 'Sign in with Discord',
      redirecting: 'Redirecting…',
    },
    callback: {
      connecting: 'Connecting to Discord…',
      failed: "Couldn't complete the sign-in.",
    },
    menu: {
      account: "{name}'s account",
      myCharacters: 'My characters',
      signOut: 'Sign out',
    },
  },
  {
    login: {
      title: 'Inicia sesión en AbyssRaider',
      description: 'Usamos tu cuenta de Discord para identificarte en las parties y enviarte avisos de raid.',
      scope: 'Solo pedimos tu nombre y avatar de Discord (alcance {scope}).',
      discord: 'Iniciar sesión con Discord',
      redirecting: 'Redirigiendo…',
    },
    callback: {
      connecting: 'Conectando con Discord…',
      failed: 'No se pudo completar el inicio de sesión.',
    },
    menu: {
      account: 'Cuenta de {name}',
      myCharacters: 'Mis personajes',
      signOut: 'Cerrar sesión',
    },
  },
)
