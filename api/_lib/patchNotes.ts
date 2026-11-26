/**
 * Patch notes do AION 2 (quadro "Atualizações" do site oficial).
 *
 * A comunidade da NCSOFT tem uma API pública em JSON (a mesma que o site usa), com
 * um quadro por idioma (update_pt, update_en, update_es):
 *   lista:  .../board/update_pt/article/search/moreArticle?moreSize=10&moreDirection=BEFORE
 *   artigo: .../board/update_pt/article/{id}  (o corpo vem em HTML)
 * Aqui o HTML vira uma árvore simples (seções > grupos > tópicos) para a aba do
 * app e para o resumo que vai ao Discord.
 */
import { AionApiError } from './aion.js'

/** Idiomas dos quadros de patch notes (os mesmos do app). O Discord usa sempre pt-BR. */
export const PATCH_LANGS = ['pt-BR', 'en', 'es'] as const
export type PatchLang = (typeof PATCH_LANGS)[number]

const BOARDS: Record<PatchLang, { alias: string; site: string }> = {
  'pt-BR': { alias: 'update_pt', site: 'pt-br' },
  en: { alias: 'update_en', site: 'en-us' },
  // O site em espanhol fica em /es-es (es-mx redireciona para a home em inglês).
  es: { alias: 'update_es', site: 'es-es' },
}

/** Idioma vindo da query (?lang=); qualquer outro valor cai no português. */
export function parsePatchLang(value: unknown): PatchLang {
  return PATCH_LANGS.find((l) => l === value) ?? 'pt-BR'
}

export const boardUrl = (lang: PatchLang = 'pt-BR') =>
  `https://api-global-community.plaync.com/aion2_global/board/${BOARDS[lang].alias}/article`

export const viewUrl = (lang: PatchLang = 'pt-BR') =>
  `https://aion2.plaync.com/${BOARDS[lang].site}/board/update/view?articleId=`

export interface PatchNoteSummary {
  id: string
  title: string
  postedAt: string
  url: string
  imageUrl: string | null
}

/** Célula de tabela; o texto pode ter várias linhas (separadas por quebra de linha). */
export interface PatchTableCell {
  text: string
  header?: boolean
  rowSpan?: number
  colSpan?: number
}

export interface PatchItem {
  /** Vazio quando o tópico é só uma tabela. */
  text: string
  children: PatchItem[]
  /** Rótulo ("Período do evento", nome da classe): os filhos são o conteúdo dele. */
  label?: boolean
  table?: PatchTableCell[][]
}

export interface PatchGroup {
  /** Subtítulo em negrito (ex.: "Santuário"); null = tópicos soltos da seção. */
  title: string | null
  items: PatchItem[]
}

export interface PatchSection {
  /** Título entre colchetes (ex.: "Conteúdo & Sistemas"). */
  title: string
  groups: PatchGroup[]
}

export interface PatchNote extends PatchNoteSummary {
  sections: PatchSection[]
}

// ---------------------------------------------------------------- HTTP

async function getJson(url: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (compatible; AbyssRaider)' },
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    throw new AionApiError('Não foi possível buscar os patch notes no site do AION 2. Tente de novo.', 502)
  }
  if (res.status === 404) throw new AionApiError('Patch note não encontrado.', 404)
  if (!res.ok) throw new AionApiError(`O site do AION 2 está com problema (erro ${res.status}). Tente mais tarde.`, 502)
  try {
    return await res.json()
  } catch {
    throw new AionApiError('O site do AION 2 respondeu algo inesperado (manutenção?). Tente mais tarde.', 502)
  }
}

type RawArticle = {
  id?: unknown
  title?: unknown
  thumbnailUrl?: unknown
  timestamps?: { postedAt?: unknown; createdAt?: unknown }
}

export function normalizeSummary(raw: RawArticle, lang: PatchLang = 'pt-BR'): PatchNoteSummary | null {
  if (typeof raw?.id !== 'string' || typeof raw.title !== 'string') return null
  const postedAt = raw.timestamps?.postedAt ?? raw.timestamps?.createdAt
  return {
    id: raw.id,
    title: cleanTitle(raw.title),
    postedAt: typeof postedAt === 'string' ? postedAt : new Date(0).toISOString(),
    url: viewUrl(lang) + raw.id,
    // A miniatura da lista é recortada; a imagem cheia é o mesmo arquivo em /download/.
    imageUrl:
      typeof raw.thumbnailUrl === 'string' && raw.thumbnailUrl
        ? raw.thumbnailUrl.replace('/download_thumbnail/', '/download/')
        : null,
  }
}

/** "[Aviso] Notas da Atualização | 11 nov" -> "Notas da Atualização | 11 nov" (en: "[Notice]") */
export function cleanTitle(title: string): string {
  return decodeEntities(title).replace(/^\s*\[(aviso|notice)\]\s*/i, '').replace(/\s+/g, ' ').trim()
}

export async function listPatchNotes(limit: number, lang: PatchLang = 'pt-BR'): Promise<PatchNoteSummary[]> {
  const size = Math.min(Math.max(limit, 1), 20)
  const raw = (await getJson(`${boardUrl(lang)}/search/moreArticle?moreSize=${size}&moreDirection=BEFORE`)) as {
    contentList?: RawArticle[]
  }
  return (raw.contentList ?? []).map((a) => normalizeSummary(a, lang)).filter((x): x is PatchNoteSummary => !!x)
}

export async function getPatchNote(id: string, lang: PatchLang = 'pt-BR'): Promise<PatchNote> {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new AionApiError('Patch note inválido.', 400)
  const raw = (await getJson(`${boardUrl(lang)}/${id}`)) as {
    article?: { contentMeta?: RawArticle; content?: { content?: unknown } }
  }
  const summary = raw.article?.contentMeta ? normalizeSummary(raw.article.contentMeta, lang) : null
  const html = raw.article?.content?.content
  if (!summary || typeof html !== 'string') throw new AionApiError('Patch note não encontrado.', 404)
  return { ...summary, imageUrl: firstImage(html) ?? summary.imageUrl, sections: parsePatchHtml(html) }
}

// ---------------------------------------------------------------- HTML -> árvore

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      // Fora do Unicode, fromCodePoint lança e derrubava o patch inteiro: fica como veio.
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

const clean = (s: string) => s.replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Texto que não é novidade: notas de rodapé da loja, rótulos de tabela, despedida (pt, en, es). */
const NOISE =
  /^\*|^detalhes do (conteúdo do )?produto$|^(agradecemos|obrigad[oa])\b|^product (content )?details$|^thank(s| you)\b|^detalles del (contenido del )?producto$|^gracias\b/i

function firstImage(html: string): string | null {
  const m = /<img[^>]+src="([^"]+)"/i.exec(html)
  return m ? decodeEntities(m[1]!) : null
}

const attr = (attrs: string, name: string): string | null => {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs)
  return m ? m[1]! : null
}

/** Uma célula sendo lida: linhas de texto e quanto dele está em negrito. */
interface CellDraft {
  text: string
  bold: string
  rowSpan: number
  colSpan: number
}

function finishTable(rows: CellDraft[][]): PatchTableCell[][] | null {
  const lines = (s: string) =>
    s
      .split('\n')
      .map(clean)
      .filter(Boolean)
      .join('\n')
  const table = rows
    .map((row) =>
      row.map((c) => ({
        text: lines(c.text),
        bold: clean(c.bold.replace(/\n/g, ' ')),
        rowSpan: c.rowSpan,
        colSpan: c.colSpan,
      })),
    )
    .filter((row) => row.some((c) => c.text))
  if (!table.length) return null

  // Primeira linha é cabeçalho quando está toda em negrito, ou quando são rótulos curtos
  // de uma linha só ("Categoria | Recompensa | Quantidade").
  // Cabeçalho: uma linha de título ocupando a largura toda ("(15 dias)") e/ou a linha
  // de rótulos, toda em negrito ou só com rótulos curtos ("Categoria | Recompensa | Quantidade").
  const isCaption = (row: (typeof table)[number]) => row.length === 1 && row[0]!.colSpan > 1
  const isLabels = (row: (typeof table)[number]) =>
    row.every((c) => c.rowSpan === 1) &&
    (row.every((c) => !c.text || c.bold === c.text.replace(/\n/g, ' ')) ||
      row.every((c) => !c.text.includes('\n') && c.text.length <= 40))
  let headerRows = 0
  if (table.length > 1 && isCaption(table[0]!)) headerRows = 1
  if (table.length > headerRows + 1 && isLabels(table[headerRows]!)) headerRows++

  return table.map((row, i) =>
    row.map((c) => ({
      text: c.text,
      ...(i < headerRows ? { header: true } : {}),
      ...(c.rowSpan > 1 ? { rowSpan: c.rowSpan } : {}),
      ...(c.colSpan > 1 ? { colSpan: c.colSpan } : {}),
    })),
  )
}

/**
 * O editor do site gera blocos `<div data-contents-type="text">`, listas `<ul><li>`
 * aninhadas e tabelas. Há dois formatos:
 *
 * Antigo (só negrito):
 *  - bloco todo em negrito entre colchetes ("[Conteúdo & Sistemas]") abre uma seção;
 *  - bloco todo em negrito sem colchetes ("Santuário") abre um grupo.
 *
 * Novo (com títulos `<h1>`/`<h2>`/`<h3>` e um índice no topo, que é ignorado):
 *  - `<h1>` abre uma seção e `<h2>` um grupo;
 *  - `<h3>` e blocos todos em negrito ("Período do evento") viram rótulos: o que vem
 *    depois fica dentro deles, até o próximo rótulo ou título.
 *
 * Nos dois: `<li>` é um tópico, filho do `<li>` de fora; quebras de linha dentro de
 * um bloco viram subtópicos; tabelas (mudanças de classe, recompensas, preços) são
 * mantidas como tabela; texto antes da primeira seção (o "Olá") é ignorado.
 */
export function parsePatchHtml(html: string): PatchSection[] {
  const headingMode = /<h[1-3]\b/i.test(html)
  const sections: PatchSection[] = []
  let section: PatchSection | null = null
  let group: PatchGroup | null = null
  /** No formato novo: a seção já tem um `<h2>` (negrito vira rótulo, não grupo). */
  let sectionHasH2 = false
  /** Último tópico em cada profundidade (0 = tópico de primeiro nível). */
  let path: PatchItem[] = []
  /** Profundidade a partir da qual entra o conteúdo (1 dentro de um rótulo). */
  let base = 0
  /** Profundidade dos rótulos em negrito (1 dentro de um `<h3>`). */
  let labelDepth = 0

  let ulDepth = 0
  let strongDepth = 0
  let heading = 0
  let tocDepth = 0
  let text = ''
  let strongText = ''
  /** Um `<li>` aberto ainda sem texto: o próximo bloco cria o tópico. */
  let liPending = false
  let liDepth = 0

  let tableDepth = 0
  let rows: CellDraft[][] = []
  let cell: CellDraft | null = null

  const ensureGroup = (): PatchGroup | null => {
    if (!section) return null
    if (!group) {
      group = { title: null, items: [] }
      section.groups.push(group)
    }
    return group
  }

  const attach = (item: PatchItem, depth: number): boolean => {
    const g = ensureGroup()
    if (!g) return false
    const parent = depth > 0 ? path[Math.min(depth, path.length) - 1] : undefined
    if (parent) parent.children.push(item)
    else g.items.push(item)
    path = [...path.slice(0, Math.min(depth, path.length)), item]
    return true
  }

  const addItem = (raw: string, depth: number, label = false): PatchItem | null => {
    const value = raw.replace(/^[·•■\-–]\s*/, '')
    if (!value || NOISE.test(value)) return null
    const item: PatchItem = label ? { text: value, children: [], label: true } : { text: value, children: [] }
    return attach(item, depth) ? item : null
  }

  /** Abre um rótulo: o que vier depois entra nele. */
  const addLabel = (value: string, depth: number) => {
    path = path.slice(0, depth)
    const item = addItem(value.replace(/^\[(.+)\]$/, '$1'), depth, true)
    base = item ? depth + 1 : depth
  }

  const openSection = (title: string) => {
    section = { title, groups: [] }
    sections.push(section)
    group = null
    sectionHasH2 = false
    path = []
    base = 0
    labelDepth = 0
  }

  const openGroup = (title: string) => {
    if (!section) return
    group = { title, items: [] }
    section.groups.push(group)
    path = []
    base = 0
    labelDepth = 0
  }

  const flush = () => {
    const lines = text.split('\n').map(clean).filter(Boolean)
    const value = lines.join(' ')
    const bold = clean(strongText.replace(/\n/g, ' '))
    const level = heading
    text = ''
    strongText = ''
    heading = 0
    if (!value) return

    if (level === 1) {
      openSection(clean(value.replace(/^\[(.+)\]$/, '$1')))
      return
    }
    if (level === 2) {
      openGroup(value)
      sectionHasH2 = true
      return
    }
    if (level >= 3) {
      if (!section) return
      labelDepth = 0
      addLabel(value, 0)
      labelDepth = base
      return
    }

    /** Linhas depois da primeira (quebras `<br>`) viram subtópicos do item. */
    /**
     * Linhas depois da primeira (quebras `<br>`): dentro do item quando ele termina
     * em ":" ("Período de venda:"), senão ao lado dele (duas datas, PST e CET).
     */
    const rest = (item: PatchItem | null | undefined, depth: number) => {
      if (!item) return
      const inside = item.text.endsWith(':')
      for (const line of lines.slice(1)) addItem(line, inside ? depth + 1 : depth)
      path = path.slice(0, depth + 1)
    }

    // "■ Período do evento" sem negrito também é rótulo no formato novo.
    const marker = /^■/.test(value) && lines.length === 1 && !value.endsWith(':') && value.length <= 80

    if (liDepth > 0) {
      const depth = liDepth - 1 + base
      if (liPending) {
        liPending = false
        rest(addItem(lines[0]!, depth), depth)
      } else {
        const last = path[depth]
        if (last) {
          last.text = `${last.text} ${lines[0]}`
          rest(last, depth)
        } else rest(addItem(lines[0]!, depth), depth)
      }
      return
    }

    // Observações ("※ ...", "* ...") nunca são rótulo, mesmo em negrito.
    if (((bold && bold === value) || (headingMode && marker)) && !/^[※*]/.test(value)) {
      if (headingMode) {
        if (!section) return
        if (!sectionHasH2 && !/^\[.+\]$/.test(value)) openGroup(value.replace(/^■\s*/, ''))
        else addLabel(value, labelDepth)
        return
      }
      const bracket = /^\[(.+)\]$/.exec(value)
      if (bracket) {
        openSection(clean(bracket[1]!))
        return
      }
      if (section) {
        openGroup(value)
        return
      }
    }
    if (section) rest(addItem(lines[0]!, base), base)
  }

  const re = /<(\/?)([a-z0-9]+)\b([^>]*?)\/?>|([^<]+)/gi
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const closing = m[1] === '/'
    const tag = m[2]?.toLowerCase() ?? ''

    // Índice do topo (links para os títulos): já está no próprio texto.
    if (tocDepth > 0) {
      if (tag === 'div') tocDepth += closing ? -1 : 1
      continue
    }

    if (m[4] != null) {
      const t = decodeEntities(m[4])
      if (cell) {
        cell.text += t
        if (strongDepth > 0) cell.bold += t
      } else if (tableDepth === 0) {
        text += t
        if (strongDepth > 0) strongText += t
      }
      continue
    }

    if (tag === 'table') {
      if (!closing) {
        if (tableDepth++ === 0) {
          flush()
          rows = []
          cell = null
        }
        continue
      }
      if (--tableDepth > 0) continue
      const table = section ? finishTable(rows) : null
      if (table) {
        const depth = liDepth > 0 ? liDepth + base : base
        attach({ text: '', children: [], table }, depth)
        path = path.slice(0, depth)
      }
      rows = []
      cell = null
      continue
    }

    if (tableDepth > 0) {
      if (tableDepth > 1) continue // tabela dentro de tabela: só o texto entra
      switch (tag) {
        case 'tr':
          if (!closing) rows.push([])
          break
        case 'td':
        case 'th':
          if (closing) cell = null
          else {
            cell = {
              text: '',
              bold: '',
              rowSpan: Number(attr(m[3]!, 'rowspan')) || 1,
              colSpan: Number(attr(m[3]!, 'colspan')) || 1,
            }
            if (!rows.length) rows.push([])
            rows[rows.length - 1]!.push(cell)
          }
          break
        case 'strong':
        case 'b':
          strongDepth += closing ? -1 : 1
          break
        case 'br':
        case 'div':
        case 'p':
          if (cell && (tag === 'br' || closing)) {
            cell.text += '\n'
            cell.bold += '\n'
          }
          break
      }
      continue
    }

    switch (tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        flush()
        if (!closing) heading = Number(tag[1])
        else heading = 0
        if (!closing) {
          // O texto do título é tratado no fechamento.
          text = ''
          strongText = ''
        }
        break
      case 'strong':
      case 'b':
        strongDepth += closing ? -1 : 1
        break
      case 'br':
        text += '\n'
        strongText += '\n'
        break
      case 'div':
        if (!closing && attr(m[3]!, 'data-contents-type') === 'toc') {
          flush()
          tocDepth = 1
        } else if (closing) flush()
        break
      case 'p':
        if (closing) flush()
        break
      case 'ul':
      case 'ol':
        flush()
        ulDepth += closing ? -1 : 1
        break
      case 'li':
        flush()
        if (closing) {
          // Volta para o <li> de fora (texto depois da sublista continua nele).
          liDepth = Math.max(ulDepth - 1, 0)
          liPending = false
        } else {
          liDepth = ulDepth
          liPending = true
        }
        break
    }
  }
  flush()

  // Seções e grupos vazios saem.
  return sections
    .map((s) => ({ ...s, groups: s.groups.filter((g) => g.items.length || g.title) }))
    .filter((s) => s.groups.length)
}

// ---------------------------------------------------------------- Discord

const MAX_DESCRIPTION = 3900
const MAX_ITEM = 220

const shorten = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

/**
 * Tópicos de primeiro nível para o resumo. Um rótulo sozinho ("Período do evento")
 * não diz nada: entra o conteúdo dele ("Período do evento: 25 nov – 9 dez"), só a primeira linha, para caber
 * o patch todo. Tabelas ficam só no app e no site.
 */
function summaryTexts(items: PatchItem[]): string[] {
  return items.flatMap((item) => {
    if (item.table) return []
    if (!item.label) return [item.text]
    const first = item.children.find((c) => !c.table && !c.label)
    if (first) return [`${item.text}: ${first.text}`]
    // Rótulo só com tabela ("Recompensas do evento") não diz nada sem ela.
    return item.children.length ? [] : [item.text]
  })
}

/**
 * Embed do Discord com os principais pontos: cada seção, seus grupos e os
 * tópicos de primeiro nível (os detalhes ficam no link do site oficial).
 * Respeita o limite de 4096 caracteres da descrição. `bannerUrl` (o banner do
 * AbyssRaider) substitui a imagem do post do site.
 */
export function discordEmbed(note: PatchNote, bannerUrl?: string): Record<string, unknown> {
  const image = bannerUrl ?? note.imageUrl
  const lines: string[] = []
  let size = 0
  let skipped = 0

  const push = (line: string): boolean => {
    if (size + line.length + 1 > MAX_DESCRIPTION) return false
    lines.push(line)
    size += line.length + 1
    return true
  }

  for (const s of note.sections) {
    if (!push(`\n__**${s.title}**__`)) {
      skipped += s.groups.reduce((n, g) => n + Math.max(1, g.items.length), 0)
      continue
    }
    for (const g of s.groups) {
      if (g.title && !push(`**${g.title}**`)) {
        skipped += Math.max(1, g.items.length)
        continue
      }
      for (const text of summaryTexts(g.items)) {
        if (!push(`• ${shorten(text, MAX_ITEM)}`)) skipped++
      }
    }
  }

  let description = lines.join('\n').trim()
  description += skipped
    ? `\n\n…e mais ${skipped} ${skipped === 1 ? 'tópico' : 'tópicos'}. [Ler completo no site oficial](${note.url})`
    : `\n\n[Ler completo no site oficial](${note.url})`

  return {
    title: shorten(`📜 ${note.title}`, 256),
    url: note.url,
    color: 0xc9a227,
    description,
    ...(image ? { image: { url: image } } : {}),
    footer: { text: 'AION 2 · Atualizações (site oficial)' },
    timestamp: note.postedAt,
  }
}
