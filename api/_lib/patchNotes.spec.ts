import { describe, expect, it } from 'vitest'
import {
  boardUrl,
  decodeEntities,
  cleanTitle,
  discordEmbed,
  normalizeSummary,
  parsePatchHtml,
  parsePatchLang,
  viewUrl,
  type PatchNote,
} from './patchNotes.js'

const t = (s: string) => `<div data-contents-type="text">${s}</div>`

// Trecho no formato do editor do site oficial (patch de 11 nov).
const HTML = [
  t('<div class="fr-image"><img src="https://x/banner.jpg" class="fe-image"></div>'),
  t('<strong>Olá, aqui é a equipe do AION 2.</strong>'),
  t('Confira a atualização desta semana.'),
  t('<strong>[Conteúdo &amp; Sistemas]</strong>'),
  t('​'),
  t('<strong>Santuário</strong>'),
  '<ul><li>' + t('A Reforja Abissal: Ludra (Normal) será ajustada.'),
  '<ul><li>' + t('O limite de tempo será aumentado de 1 hora para 2 horas.') + '</li>',
  '<li>' + t('As recompensas serão melhoradas.'),
  '<ul><li>' + t('A taxa passa de 30% para 100%.') + '</li></ul></li></ul></li></ul>',
  '<ul><li>' + t('A Reforja Abissal: Ludra (Difícil) será ajustada.') + '</li></ul>',
  t('<strong>Abismo</strong>'),
  '<ul><li>' + t('Mais Pontos do Abismo no Piso Superior.&nbsp;') + '</li></ul>',
  t('<strong>[Novos Visuais]</strong>'),
  '<ul><li>' + t('(Visual de Asa) Asas de Gato') + '<ul><li>' + t('Detalhes do Produto') + '</li></ul></li></ul>',
  '<table><tbody><tr><td>' + t('<strong>Preço</strong>') + '</td><td>' + t('$29,99') + '</td></tr></tbody></table>',
  t('* Os preços são baseados na Loja Purple.'),
  t('<strong>[Correções]</strong>'),
  t('Foi corrigido o medidor de oxigênio.'),
  t('Agradecemos.'),
].join('')

// Formato novo (patch de 25 nov): índice no topo, títulos <h1>/<h2>/<h3>, rótulos e tabelas.
const td = (s: string, attrs = '') => `<td${attrs}>${t(s)}</td>`
const NEW_HTML = [
  t('Hello, this is AION 2.'),
  '<div data-contents-type="toc" contenteditable="false"><div><ol><li>' +
    t('<a href="#a">[Content &amp; Systems]</a>') +
    '<ol><li>' + t('<a href="#b">Stigma</a>') + '</li></ol></li></ol></div></div>',
  '<h1 id="a"><strong>[Content &amp; Systems]</strong></h1>',
  '<h2 id="b"><strong>Stigma</strong></h2>',
  '<ul><li>' + t('You will now be able to equip up to 5 Stigma Skills.') + '</li></ul>',
  '<h2><strong>Class Changes</strong></h2>',
  '<h3>Templar</h3>',
  '<div><table><tbody><tr>' + td('<strong>Skill Name</strong>') + td('<strong>Changes</strong>') + '</tr>',
  '<tr>' + td('Judgment') + td('PvP damage -5%.<br>Specialty 3 -10%.') + '</tr></tbody></table></div>',
  '<h1><strong>[Event]</strong></h1>',
  '<h2><strong>1. Bountiful Dawn</strong></h2>',
  t('<strong>Event Schedule</strong>'),
  t('- Nov 25 – Dec 15 (PST)<br>- Nov 25 – Dec 16 (CET)'),
  t('<strong>Event Rewards</strong>'),
  '<div><table><tbody><tr>' + td('Category') + td('Rewards') + '</tr>',
  '<tr>' + td('Day 1', ' rowspan="2"') + td('Spiritstone') + '</tr><tr>' + td('Fogus') + '</tr></tbody></table></div>',
  t('※ Progress resets daily.'),
  '<h2><strong>2. Twitch Drops</strong></h2>',
  t('■ Event Period'),
  t('- Nov 25 – Dec 9'),
  t('<strong>■ Available from: [Shop]</strong>'),
  t('■ Sales Period: <br>- Nov 25 – Dec 1'),
  '<h1><strong>[Other Improvements and Bug Fixes]</strong></h1>',
  t('<strong>Fixes</strong>'),
  '<ul><li>' + t('A targeting issue will be fixed.') + '</li></ul>',
  t('Thank you.'),
].join('')

describe('patch notes no formato novo (títulos h1/h2/h3)', () => {
  const sections = parsePatchHtml(NEW_HTML)

  it('usa h1 como seção e h2 como grupo, sem repetir o índice', () => {
    expect(sections.map((s) => s.title)).toEqual(['Content & Systems', 'Event', 'Other Improvements and Bug Fixes'])
    expect(sections[0]!.groups.map((g) => g.title)).toEqual(['Stigma', 'Class Changes'])
    expect(sections[0]!.groups[0]!.items).toEqual([{ text: 'You will now be able to equip up to 5 Stigma Skills.', children: [] }])
    // Sem h2 na seção, o negrito volta a ser grupo.
    expect(sections[2]!.groups).toEqual([{ title: 'Fixes', items: [{ text: 'A targeting issue will be fixed.', children: [] }] }])
  })

  it('h3 vira rótulo com a tabela de mudanças da classe dentro', () => {
    const [templar] = sections[0]!.groups[1]!.items
    expect(templar).toEqual({
      text: 'Templar',
      label: true,
      children: [
        {
          text: '',
          children: [],
          table: [
            [{ text: 'Skill Name', header: true }, { text: 'Changes', header: true }],
            [{ text: 'Judgment' }, { text: 'PvP damage -5%.\nSpecialty 3 -10%.' }],
          ],
        },
      ],
    })
  })

  it('negrito e "■" viram rótulos; linhas com <br> ficam lado a lado ou dentro de "…:"', () => {
    const [dawn, twitch] = sections[1]!.groups
    const [schedule, rewards, note] = dawn!.items
    expect(schedule).toEqual({
      text: 'Event Schedule',
      label: true,
      children: [
        { text: 'Nov 25 – Dec 15 (PST)', children: [] },
        { text: 'Nov 25 – Dec 16 (CET)', children: [] },
      ],
    })
    expect(rewards!.children[0]!.table).toEqual([
      [{ text: 'Category', header: true }, { text: 'Rewards', header: true }],
      [{ text: 'Day 1', rowSpan: 2 }, { text: 'Spiritstone' }],
      [{ text: 'Fogus' }],
    ])
    // Observação com ※ continua aparecendo.
    expect(rewards!.children[1]).toEqual({ text: '※ Progress resets daily.', children: [] })
    expect(note).toBeUndefined()

    expect(twitch!.items[0]).toEqual({ text: 'Event Period', label: true, children: [{ text: 'Nov 25 – Dec 9', children: [] }] })
    expect(twitch!.items[1]).toEqual({
      text: 'Available from: [Shop]',
      label: true,
      children: [{ text: 'Sales Period:', children: [{ text: 'Nov 25 – Dec 1', children: [] }] }],
    })
    expect(JSON.stringify(sections)).not.toMatch(/Hello|Thank you/)
  })

  it('no Discord, o rótulo leva o conteúdo junto e a tabela fica de fora', () => {
    const note: PatchNote = {
      id: 'abc',
      title: 'Patch Notes | Nov. 25',
      postedAt: '2026-11-25T08:00:00.000Z',
      url: 'https://x/abc',
      imageUrl: null,
      sections,
    }
    const description = String(discordEmbed(note).description)
    expect(description).toContain(
      '• Event Schedule: Nov 25 – Dec 15 (PST)\n• Event Rewards: ※ Progress resets daily.\n**2. Twitch Drops**',
    )
    expect(description).toContain('**Class Changes**')
    expect(description).not.toMatch(/Templar|Judgment|Dec 16/)
  })
})

describe('patch notes (HTML do site oficial)', () => {
  const sections = parsePatchHtml(HTML)

  it('separa seções [entre colchetes], grupos em negrito e tópicos aninhados', () => {
    expect(sections.map((s) => s.title)).toEqual(['Conteúdo & Sistemas', 'Novos Visuais', 'Correções'])
    const [santuario, abismo] = sections[0]!.groups
    expect(santuario!.title).toBe('Santuário')
    expect(santuario!.items.map((i) => i.text)).toEqual([
      'A Reforja Abissal: Ludra (Normal) será ajustada.',
      'A Reforja Abissal: Ludra (Difícil) será ajustada.',
    ])
    const normal = santuario!.items[0]!
    expect(normal.children.map((i) => i.text)).toEqual([
      'O limite de tempo será aumentado de 1 hora para 2 horas.',
      'As recompensas serão melhoradas.',
    ])
    expect(normal.children[1]!.children[0]!.text).toBe('A taxa passa de 30% para 100%.')
    expect(abismo).toEqual({ title: 'Abismo', items: [{ text: 'Mais Pontos do Abismo no Piso Superior.', children: [] }] })
  })

  it('mantém as tabelas e ignora a saudação, notas de rodapé e a despedida', () => {
    const visuais = sections[1]!.groups
    expect(visuais).toEqual([
      {
        title: null,
        items: [
          { text: '(Visual de Asa) Asas de Gato', children: [] },
          { text: '', children: [], table: [[{ text: 'Preço' }, { text: '$29,99' }]] },
        ],
      },
    ])
    expect(sections[2]!.groups[0]!.items.map((i) => i.text)).toEqual(['Foi corrigido o medidor de oxigênio.'])
    expect(JSON.stringify(sections)).not.toMatch(/Olá|Purple|Agradecemos/)
  })

  it('resume no embed do Discord só o primeiro nível, com link para o site', () => {
    const note: PatchNote = {
      id: 'abc',
      title: 'Notas da Atualização | 11 nov',
      postedAt: '2026-11-11T08:57:58.346Z',
      url: 'https://aion2.plaync.com/pt-br/board/update/view?articleId=abc',
      imageUrl: 'https://x/banner.jpg',
      sections,
    }
    const embed = discordEmbed(note) as { title: string; description: string; image: { url: string } }
    expect(embed.title).toBe('📜 Notas da Atualização | 11 nov')
    expect(embed.image.url).toBe('https://x/banner.jpg')
    expect(embed.description).toContain('__**Conteúdo & Sistemas**__\n**Santuário**\n• A Reforja Abissal: Ludra (Normal)')
    expect(embed.description).not.toContain('30% para 100%')
    expect(embed.description).toMatch(/\[Ler completo no site oficial\]\(https:\/\/aion2\.plaync\.com.+abc\)$/)
    const banner = discordEmbed(note, 'https://app/patch-notes-banner.jpg') as { image: { url: string } }
    expect(banner.image.url).toBe('https://app/patch-notes-banner.jpg')
  })

  it('corta o resumo no limite do Discord e diz quantos tópicos ficaram de fora', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ text: `Tópico ${i} `.padEnd(150, 'x'), children: [] }))
    const note: PatchNote = {
      id: 'big',
      title: 'Grande',
      postedAt: '2026-11-11T00:00:00Z',
      url: 'https://site/big',
      imageUrl: null,
      sections: [{ title: 'Tudo', groups: [{ title: null, items: many }] }],
    }
    const { description } = discordEmbed(note) as { description: string }
    expect(description.length).toBeLessThanOrEqual(4096)
    expect(description).toMatch(/…e mais \d+ tópicos\. \[Ler completo no site oficial\]/)
  })

  it('limpa título e usa a imagem cheia no lugar da miniatura', () => {
    expect(cleanTitle(' [Aviso] Notas da Atualização |  3 nov (PST)')).toBe('Notas da Atualização | 3 nov (PST)')
    expect(
      normalizeSummary({
        id: '6af42e16d33ba31396c0925e',
        title: '[Aviso] Notas',
        thumbnailUrl: 'https://cdn/lg/file/AION/download_thumbnail/abc',
        timestamps: { postedAt: '2026-11-11T08:57:58.346Z' },
      }),
    ).toEqual({
      id: '6af42e16d33ba31396c0925e',
      title: 'Notas',
      postedAt: '2026-11-11T08:57:58.346Z',
      url: 'https://aion2.plaync.com/pt-br/board/update/view?articleId=6af42e16d33ba31396c0925e',
      imageUrl: 'https://cdn/lg/file/AION/download/abc',
    })
  })

  it('escolhe o quadro e o link do site pelo idioma (padrão: português)', () => {
    expect(boardUrl()).toBe('https://api-global-community.plaync.com/aion2_global/board/update_pt/article')
    expect(boardUrl('en')).toContain('/board/update_en/article')
    expect(boardUrl('es')).toContain('/board/update_es/article')
    expect(viewUrl('en')).toBe('https://aion2.plaync.com/en-us/board/update/view?articleId=')
    expect(viewUrl('es')).toBe('https://aion2.plaync.com/es-es/board/update/view?articleId=')
    expect(parsePatchLang('es')).toBe('es')
    expect(parsePatchLang('fr')).toBe('pt-BR')
    expect(parsePatchLang(null)).toBe('pt-BR')
    expect(normalizeSummary({ id: 'abc', title: '[Notice] Patch Notes | Nov. 11' }, 'en')).toMatchObject({
      title: 'Patch Notes | Nov. 11',
      url: 'https://aion2.plaync.com/en-us/board/update/view?articleId=abc',
    })
  })

  it('ignora o ruído também em inglês e espanhol', () => {
    const html = [
      t('<strong>Hello, this is AION 2.</strong>'),
      t('<strong>[Promotion]</strong>'),
      '<ul><li>' + t('(Wings Skin) Cat Wings') + '<ul><li>' + t('Product Content Details') + '</li></ul></li></ul>',
      '<ul><li>' + t('(Apariencia de alas) Alas de gato') + '<ul><li>' + t('Detalles del contenido del producto') + '</li></ul></li></ul>',
      t('Thank you and see you in-game!'),
      t('Gracias.'),
    ].join('')
    const [promo] = parsePatchHtml(html)
    expect(promo!.title).toBe('Promotion')
    expect(promo!.groups[0]!.items).toEqual([
      { text: '(Wings Skin) Cat Wings', children: [] },
      { text: '(Apariencia de alas) Alas de gato', children: [] },
    ])
  })
})

describe('decodeEntities', () => {
  it('entidade numérica fora do Unicode fica como está (antes derrubava o patch inteiro)', () => {
    expect(decodeEntities('a &#1114112; b &#x110000; &#233;')).toBe('a &#1114112; b &#x110000; é')
  })
})
