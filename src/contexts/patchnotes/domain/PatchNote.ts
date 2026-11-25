/** Patch note oficial do AION 2 (quadro "Atualizações" do site, no idioma da tela). */
export interface PatchNoteSummary {
  id: string
  title: string
  postedAt: Date
  /** Página do patch no site oficial. */
  url: string
  imageUrl: string | null
}

/** Célula de tabela do patch (mudanças de classe, recompensas, preços); o texto pode ter várias linhas. */
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
  /** Subtítulo (ex.: "Santuário"); null = tópicos soltos da seção. */
  title: string | null
  items: PatchItem[]
}

export interface PatchSection {
  title: string
  groups: PatchGroup[]
}

export interface PatchNote extends PatchNoteSummary {
  sections: PatchSection[]
}

export interface PatchNotesRepository {
  list(limit?: number): Promise<PatchNoteSummary[]>
  get(id: string): Promise<PatchNote | null>
}

/** Quantos tópicos (com subtópicos) a seção tem. */
export function countItems(section: PatchSection): number {
  const count = (items: PatchItem[]): number => items.reduce((n, i) => n + 1 + count(i.children), 0)
  return section.groups.reduce((n, g) => n + count(g.items), 0)
}
