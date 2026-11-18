import { defineMessages } from '@/shared/i18n/defineMessages'

/** Textos do contexto patchnotes (chaves: 'patchnotes.*'). */
export default defineMessages(
  {
    view: {
      title: 'Patch notes',
      intro: 'O que mudou em cada atualização do AION 2, organizado a partir das notas oficiais da NCSOFT.',
      updates: 'Atualizações',
      latest: 'Mais recente',
      postedOn: 'Publicado em {date}',
      readOfficial: 'Ler no site oficial',
      readOfficialInline: 'Leia no site oficial',
      sections: 'Seções do patch',
      unparsed: 'Não deu para organizar este patch.',
      gone: 'Esse patch note não existe mais no site oficial.',
    },
    errors: {
      http: 'Erro {status} ao buscar os patch notes',
    },
  },
  {
    view: {
      title: 'Patch notes',
      intro: "What changed in each AION 2 update, organized from NCSOFT's official notes.",
      updates: 'Updates',
      latest: 'Latest',
      postedOn: 'Posted on {date}',
      readOfficial: 'Read on the official site',
      readOfficialInline: 'Read it on the official site',
      sections: 'Patch sections',
      unparsed: "Couldn't organize this patch.",
      gone: 'This patch note is no longer on the official site.',
    },
    errors: {
      http: 'Error {status} while fetching the patch notes',
    },
  },
  {
    view: {
      title: 'Notas del parche',
      intro: 'Qué cambió en cada actualización de AION 2, organizado a partir de las notas oficiales de NCSOFT.',
      updates: 'Actualizaciones',
      latest: 'Más reciente',
      postedOn: 'Publicado el {date}',
      readOfficial: 'Leer en el sitio oficial',
      readOfficialInline: 'Léelo en el sitio oficial',
      sections: 'Secciones del parche',
      unparsed: 'No se pudo organizar este parche.',
      gone: 'Esta nota de parche ya no existe en el sitio oficial.',
    },
    errors: {
      http: 'Error {status} al obtener las notas del parche',
    },
  },
)
