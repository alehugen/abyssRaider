import { describe, expect, it } from 'vitest'
import { cleanTitle, discordEmbed, normalizeSummary, parsePatchHtml, type PatchNote } from './patchNotes.js'

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

  it('ignora a saudação, tabelas da loja, notas de rodapé e a despedida', () => {
    const visuais = sections[1]!.groups
    expect(visuais).toEqual([{ title: null, items: [{ text: '(Visual de Asa) Asas de Gato', children: [] }] }])
    expect(sections[2]!.groups[0]!.items.map((i) => i.text)).toEqual(['Foi corrigido o medidor de oxigênio.'])
    expect(JSON.stringify(sections)).not.toMatch(/Olá|29,99|Purple|Agradecemos/)
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
})
