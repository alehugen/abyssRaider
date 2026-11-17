/**
 * Patch notes do AION 2 (quadro "Atualizações" do site oficial, em português).
 *
 * A comunidade da NCSOFT tem uma API pública em JSON (a mesma que o site usa):
 *   lista:  .../board/update_pt/article/search/moreArticle?moreSize=10&moreDirection=BEFORE
 *   artigo: .../board/update_pt/article/{id}  (o corpo vem em HTML)
 * Aqui o HTML vira uma árvore simples (seções > grupos > tópicos) para a aba do
 * app e para o resumo que vai ao Discord.
 */
import { AionApiError } from './aion.js'

const BOARD_URL = 'https://api-global-community.plaync.com/aion2_global/board/update_pt/article'
const VIEW_URL = 'https://aion2.plaync.com/pt-br/board/update/view?articleId='

export interface PatchNoteSummary {
  id: string
  title: string
  postedAt: string
  url: string
  imageUrl: string | null
}

export interface PatchItem {
  text: string
  children: PatchItem[]
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

export function normalizeSummary(raw: RawArticle): PatchNoteSummary | null {
  if (typeof raw?.id !== 'string' || typeof raw.title !== 'string') return null
  const postedAt = raw.timestamps?.postedAt ?? raw.timestamps?.createdAt
  return {
    id: raw.id,
    title: cleanTitle(raw.title),
    postedAt: typeof postedAt === 'string' ? postedAt : new Date(0).toISOString(),
    url: VIEW_URL + raw.id,
    // A miniatura da lista é recortada; a imagem cheia é o mesmo arquivo em /download/.
    imageUrl:
      typeof raw.thumbnailUrl === 'string' && raw.thumbnailUrl
        ? raw.thumbnailUrl.replace('/download_thumbnail/', '/download/')
        : null,
  }
}

/** "[Aviso] Notas da Atualização | 11 nov" -> "Notas da Atualização | 11 nov" */
export function cleanTitle(title: string): string {
  return decodeEntities(title).replace(/^\s*\[aviso\]\s*/i, '').replace(/\s+/g, ' ').trim()
}

export async function listPatchNotes(limit: number): Promise<PatchNoteSummary[]> {
  const size = Math.min(Math.max(limit, 1), 20)
  const raw = (await getJson(`${BOARD_URL}/search/moreArticle?moreSize=${size}&moreDirection=BEFORE`)) as {
    contentList?: RawArticle[]
  }
  return (raw.contentList ?? []).map(normalizeSummary).filter((x): x is PatchNoteSummary => !!x)
}

export async function getPatchNote(id: string): Promise<PatchNote> {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new AionApiError('Patch note inválido.', 400)
  const raw = (await getJson(`${BOARD_URL}/${id}`)) as {
    article?: { contentMeta?: RawArticle; content?: { content?: unknown } }
  }
  const summary = raw.article?.contentMeta ? normalizeSummary(raw.article.contentMeta) : null
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
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

const clean = (s: string) => s.replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Texto que não é novidade: notas de rodapé da loja, rótulos de tabela, despedida. */
const NOISE = /^(\*|※)|^detalhes do (conteúdo do )?produto$|^(agradecemos|obrigad[oa])\b/i

function firstImage(html: string): string | null {
  const m = /<img[^>]+src="([^"]+)"/i.exec(html)
  return m ? decodeEntities(m[1]!) : null
}

/**
 * O editor do site gera blocos `<div data-contents-type="text">`, listas `<ul><li>`
 * aninhadas e tabelas (preços da loja). Regras:
 *  - bloco todo em negrito entre colchetes ("[Conteúdo & Sistemas]") abre uma seção;
 *  - bloco todo em negrito sem colchetes ("Santuário") abre um grupo;
 *  - `<li>` é um tópico, filho do `<li>` de fora;
 *  - texto solto dentro de uma seção vira tópico; antes da primeira seção (o "Olá")
 *    é ignorado, assim como as tabelas.
 */
export function parsePatchHtml(html: string): PatchSection[] {
  const sections: PatchSection[] = []
  let section: PatchSection | null = null
  let group: PatchGroup | null = null
  /** Último tópico em cada profundidade (0 = tópico de primeiro nível). */
  let path: PatchItem[] = []

  let ulDepth = 0
  let tableDepth = 0
  let strongDepth = 0
  let text = ''
  let strongText = ''
  /** Um `<li>` aberto ainda sem texto: o próximo bloco cria o tópico. */
  let liPending = false
  let liDepth = 0

  const ensureGroup = (): PatchGroup | null => {
    if (!section) return null
    if (!group) {
      group = { title: null, items: [] }
      section.groups.push(group)
    }
    return group
  }

  const addItem = (raw: string, depth: number) => {
    const value = raw.replace(/^[·•\-–]\s*/, '')
    if (!value || NOISE.test(value)) return
    const g = ensureGroup()
    if (!g) return
    const item: PatchItem = { text: value, children: [] }
    const parent = depth > 0 ? path[Math.min(depth, path.length) - 1] : undefined
    if (parent) parent.children.push(item)
    else g.items.push(item)
    path = [...path.slice(0, depth), item]
  }

  const flush = () => {
    const value = clean(text)
    const bold = clean(strongText)
    text = ''
    strongText = ''
    if (!value) return

    if (liDepth > 0) {
      if (liPending) {
        addItem(value, liDepth - 1)
        liPending = false
      } else {
        const last = path[liDepth - 1]
        if (last) last.text = `${last.text} ${value}`
        else addItem(value, liDepth - 1)
      }
      return
    }

    if (bold && bold === value) {
      const bracket = /^\[(.+)\]$/.exec(value)
      if (bracket) {
        section = { title: clean(bracket[1]!), groups: [] }
        sections.push(section)
        group = null
        path = []
        return
      }
      if (section) {
        group = { title: value, items: [] }
        section.groups.push(group)
        path = []
        return
      }
    }
    if (section) addItem(value, 0)
  }

  const re = /<(\/?)([a-z0-9]+)\b[^>]*?(\/?)>|([^<]+)/gi
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[4] != null) {
      if (tableDepth > 0) continue
      const t = decodeEntities(m[4])
      text += t
      if (strongDepth > 0) strongText += t
      continue
    }
    const closing = m[1] === '/'
    const tag = m[2]!.toLowerCase()
    if (tag === 'table') {
      if (!closing) flush()
      tableDepth += closing ? -1 : 1
      continue
    }
    if (tableDepth > 0) continue

    switch (tag) {
      case 'strong':
      case 'b':
        strongDepth += closing ? -1 : 1
        break
      case 'br':
        text += ' '
        break
      case 'div':
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

  // Seções e grupos vazios (ex.: só tabela) saem.
  return sections
    .map((s) => ({ ...s, groups: s.groups.filter((g) => g.items.length || g.title) }))
    .filter((s) => s.groups.length)
}

// ---------------------------------------------------------------- Discord

const MAX_DESCRIPTION = 3900
const MAX_ITEM = 220

const shorten = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

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
      for (const item of g.items) {
        if (!push(`• ${shorten(item.text, MAX_ITEM)}`)) skipped++
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
