import { defineMessages } from '@/shared/i18n/defineMessages'

/**
 * Textos do app (layout, home, primeiros passos, 404) e dos componentes de
 * shared/presentation (tema). Chaves: 'app.*'.
 */
export default defineMessages(
  {
    nav: {
      main: 'Principal',
      characters: 'Personagens',
      parties: 'Parties',
      players: 'Jogadores',
      schedule: 'Agenda',
      patchNotes: 'Patch notes',
      signIn: 'Entrar',
      /** Barra inferior do celular: nomes curtos para caber em 360px. */
      short: { characters: 'Chars', patchNotes: 'Patches' },
    },
    pwa: {
      update: { message: 'Nova versão do AbyssRaider disponível.', action: 'Atualizar', later: 'Agora não' },
      offline: 'Sem conexão. Você pode navegar, mas carregar e salvar dados precisa de internet.',
      install: {
        menu: 'Instalar app',
        banner: {
          title: 'Vai usar no celular? Instale o app antes de entrar',
          body: 'Abre em tela cheia, recebe notificações de raid e você faz login uma vez só, já no app.',
          action: 'Instalar',
          dismiss: 'Agora não',
        },
        title: 'Instalar o AbyssRaider',
        description: 'No iPhone e no iPad, a instalação é pelo Safari. Se abriu pelo Discord ou outro app, abra o link no Safari antes:',
        step1: 'Toque em Compartilhar (o quadrado com a seta para cima).',
        step2: 'Escolha "Adicionar à Tela de Início".',
        step3: 'Toque em "Adicionar". O app abre direto da tela inicial, em tela cheia.',
        ok: 'Entendi',
      },
    },
    footer: {
      disclaimer:
        'AbyssRaider é um projeto de fãs, sem vínculo com a NCSOFT. Aion 2, seus ícones, imagens e vídeos são marcas e conteúdos da NCSOFT Corporation.',
      developedBy: 'Desenvolvido por',
    },
    home: {
      title: 'Organize suas raids de Aion 2',
      subtitle: 'Entre com o Discord, vincule seu personagem e encontre uma party para o próximo santuário.',
      findParties: 'Buscar parties',
      myCharacters: 'Meus personagens',
    },
    onboarding: {
      title: 'Primeiros passos',
      intro:
        'Dois passos rápidos e você já pode entrar em parties: os líderes veem seu personagem e o AbyssRaider sugere o melhor horário para o grupo.',
      stepsLabel: 'Etapas',
      steps: {
        character: 'Vincular personagem',
        availability: 'Disponibilidade',
      },
      done: 'concluído',
      step1: {
        title: '1. Vincule seu personagem',
        hint: 'Busque pelo nome no seu servidor. Classe, CP e item level vêm do site oficial do Aion 2.',
        linked: 'Vinculado',
        more: 'Outros personagens dá para vincular depois, em Personagens.',
      },
      step2: {
        title: '2. Quando você costuma jogar?',
        locked: 'Liberado depois de vincular o personagem.',
        hint: 'Marque os dias e as faixas de horário em que você costuma poder fazer raid, no {tz}. Dá para mudar quando quiser, em Personagens.',
        submit: 'Concluir e ir para as parties',
      },
    },
    notFound: {
      title: 'Perdido no Abyss',
      text: 'Esta página não existe.',
      home: 'Voltar para o início',
    },
    theme: {
      label: 'Tema',
      current: 'Tema: {name}',
      selected: 'atual',
      system: 'Sistema',
      systemHint: 'Claro: Elyos, escuro: Asmodian',
      elyos: 'Luz, ouro e céu azul',
      asmodian: 'Sombra, violeta e carmesim',
      abyss: 'O vazio entre os mundos',
    },
  },
  {
    nav: {
      main: 'Main',
      characters: 'Characters',
      parties: 'Parties',
      players: 'Players',
      schedule: 'Schedule',
      patchNotes: 'Patch notes',
      signIn: 'Sign in',
      /** Barra inferior do celular: nomes curtos para caber em 360px. */
      short: { characters: 'Chars', patchNotes: 'Patches' },
    },
    pwa: {
      update: { message: 'A new version of AbyssRaider is available.', action: 'Update', later: 'Not now' },
      offline: "You're offline. You can browse, but loading and saving data needs internet.",
      install: {
        menu: 'Install app',
        banner: {
          title: 'Using your phone? Install the app before signing in',
          body: 'It opens full screen, gets raid notifications and you sign in only once, right in the app.',
          action: 'Install',
          dismiss: 'Not now',
        },
        title: 'Install AbyssRaider',
        description: 'On iPhone and iPad, install it from Safari. If you opened it from Discord or another app, open the link in Safari first:',
        step1: 'Tap Share (the square with an arrow pointing up).',
        step2: 'Choose "Add to Home Screen".',
        step3: 'Tap "Add". The app opens straight from your home screen, full screen.',
        ok: 'Got it',
      },
    },
    footer: {
      disclaimer:
        'AbyssRaider is a fan project, not affiliated with NCSOFT. Aion 2 and its icons, images and videos are trademarks and content of NCSOFT Corporation.',
      developedBy: 'Built by',
    },
    home: {
      title: 'Organize your Aion 2 raids',
      subtitle: 'Sign in with Discord, link your character and find a party for the next sanctuary.',
      findParties: 'Find parties',
      myCharacters: 'My characters',
    },
    onboarding: {
      title: 'Getting started',
      intro:
        'Two quick steps and you can join parties: leaders see your character and AbyssRaider suggests the best time for the group.',
      stepsLabel: 'Steps',
      steps: {
        character: 'Link character',
        availability: 'Availability',
      },
      done: 'done',
      step1: {
        title: '1. Link your character',
        hint: 'Search by name on your server. Class, CP and item level come from the official Aion 2 site.',
        linked: 'Linked',
        more: 'You can link other characters later, in Characters.',
      },
      step2: {
        title: '2. When do you usually play?',
        locked: 'Unlocks after you link your character.',
        hint: 'Mark the days and time ranges when you can usually raid, in {tz}. You can change it anytime, in Characters.',
        submit: 'Finish and go to parties',
      },
    },
    notFound: {
      title: 'Lost in the Abyss',
      text: "This page doesn't exist.",
      home: 'Back to home',
    },
    theme: {
      label: 'Theme',
      current: 'Theme: {name}',
      selected: 'current',
      system: 'System',
      systemHint: 'Light: Elyos, dark: Asmodian',
      elyos: 'Light, gold and blue sky',
      asmodian: 'Shadow, violet and crimson',
      abyss: 'The void between worlds',
    },
  },
  {
    nav: {
      main: 'Principal',
      characters: 'Personajes',
      parties: 'Parties',
      players: 'Jugadores',
      schedule: 'Agenda',
      patchNotes: 'Parches',
      signIn: 'Entrar',
      /** Barra inferior do celular: nomes curtos para caber em 360px. */
      short: { characters: 'PJs', patchNotes: 'Parches' },
    },
    pwa: {
      update: { message: 'Hay una nueva versión de AbyssRaider disponible.', action: 'Actualizar', later: 'Ahora no' },
      offline: 'Sin conexión. Puedes navegar, pero cargar y guardar datos necesita internet.',
      install: {
        menu: 'Instalar app',
        banner: {
          title: '¿Lo usarás en el celular? Instala la app antes de entrar',
          body: 'Se abre en pantalla completa, recibe notificaciones de raid e inicias sesión una sola vez, ya en la app.',
          action: 'Instalar',
          dismiss: 'Ahora no',
        },
        title: 'Instalar AbyssRaider',
        description: 'En iPhone y iPad, se instala desde Safari. Si lo abriste desde Discord u otra app, abre el enlace en Safari antes:',
        step1: 'Toca Compartir (el cuadrado con una flecha hacia arriba).',
        step2: 'Elige "Agregar a pantalla de inicio".',
        step3: 'Toca "Agregar". La app se abre directo desde tu pantalla de inicio, en pantalla completa.',
        ok: 'Entendido',
      },
    },
    footer: {
      disclaimer:
        'AbyssRaider es un proyecto de fans, sin vínculo con NCSOFT. Aion 2, sus íconos, imágenes y videos son marcas y contenidos de NCSOFT Corporation.',
      developedBy: 'Desarrollado por',
    },
    home: {
      title: 'Organiza tus raids de Aion 2',
      subtitle: 'Entra con Discord, vincula tu personaje y encuentra una party para el próximo santuario.',
      findParties: 'Buscar parties',
      myCharacters: 'Mis personajes',
    },
    onboarding: {
      title: 'Primeros pasos',
      intro:
        'Dos pasos rápidos y ya puedes unirte a parties: los líderes ven tu personaje y AbyssRaider sugiere el mejor horario para el grupo.',
      stepsLabel: 'Pasos',
      steps: {
        character: 'Vincular personaje',
        availability: 'Disponibilidad',
      },
      done: 'completado',
      step1: {
        title: '1. Vincula tu personaje',
        hint: 'Búscalo por nombre en tu servidor. La clase, el CP y el item level vienen del sitio oficial de Aion 2.',
        linked: 'Vinculado',
        more: 'Puedes vincular otros personajes después, en Personajes.',
      },
      step2: {
        title: '2. ¿Cuándo sueles jugar?',
        locked: 'Se habilita después de vincular el personaje.',
        hint: 'Marca los días y las franjas horarias en que sueles poder hacer raid, en {tz}. Puedes cambiarlo cuando quieras, en Personajes.',
        submit: 'Terminar e ir a las parties',
      },
    },
    notFound: {
      title: 'Perdido en el Abismo',
      text: 'Esta página no existe.',
      home: 'Volver al inicio',
    },
    theme: {
      label: 'Tema',
      current: 'Tema: {name}',
      selected: 'actual',
      system: 'Sistema',
      systemHint: 'Claro: Elyos, oscuro: Asmodian',
      elyos: 'Luz, oro y cielo azul',
      asmodian: 'Sombra, violeta y carmesí',
      abyss: 'El vacío entre los mundos',
    },
  },
)
