/**
 * Mensagens que chegam prontas em português do banco (P0001), da nossa API (/api) e
 * de DomainError. O banco e a API continuam em pt-BR (o Discord também); aqui elas
 * são traduzidas para o idioma da tela. Cada '%' é um valor variável (nome, número)
 * e é repassado na mesma ordem.
 *
 * Mensagem nova no banco ou na API: acrescente aqui. Sem tradução, a tela mostra o
 * original em português.
 */
import { currentLocale } from './index'

type Entry = readonly [pt: string, en: string, es: string]

const ENTRIES: readonly Entry[] = [
  // ---- banco (raise exception) ----
  ['% já está na party.', '% is already in the party.', '% ya está en la party.'],
  ['% já foi convidado.', '% has already been invited.', '% ya fue invitado.'],
  ['% requer item level %.', '% requires item level %.', '% requiere item level %.'],
  ['A formação tem vaga ou membro inválido.', 'The lineup has an invalid slot or member.', 'La formación tiene un puesto o miembro inválido.'],
  [
    'A identidade do personagem (dono, região, servidor) não pode mudar.',
    "The character's identity (owner, region, server) can't change.",
    'La identidad del personaje (dueño, región, servidor) no puede cambiar.',
  ],
  ['A party já está completa (% vagas).', 'The party is already full (% slots).', 'La party ya está completa (% puestos).'],
  ['A party já está completa.', 'The party is already full.', 'La party ya está completa.'],
  ['Cada dia da recorrência tem um horário só.', 'Each day of the routine has only one time.', 'Cada día de la rutina tiene un solo horario.'],
  [
    'Configure os avisos no Discord (webhook do canal) antes de avisar.',
    'Set up Discord alerts (channel webhook) before announcing.',
    'Configura los avisos de Discord (webhook del canal) antes de avisar.',
  ],
  ['Convite não encontrado (pode ter sido cancelado).', 'Invite not found (it may have been cancelled).', 'Invitación no encontrada (puede haber sido cancelada).'],
  ['Disponibilidade inválida.', 'Invalid availability.', 'Disponibilidad inválida.'],
  ['Duas pessoas na mesma vaga.', 'Two people in the same slot.', 'Dos personas en el mismo puesto.'],
  ['Escolha um horário no futuro.', 'Pick a time in the future.', 'Elige un horario en el futuro.'],
  ['Essa mudança na party não é permitida.', "That party change isn't allowed.", 'Ese cambio en la party no está permitido.'],
  [
    'Esta party foi finalizada: ela fica só como histórico.',
    'This party is finished: it stays only as history.',
    'Esta party fue finalizada: queda solo como historial.',
  ],
  ['Esta party já foi finalizada.', 'This party is already finished.', 'Esta party ya fue finalizada.'],
  [
    'Esta party é da região %; o personagem é de outra região.',
    'This party is in region %; the character is from another region.',
    'Esta party es de la región %; el personaje es de otra región.',
  ],
  ['Esta raid já começou.', 'This raid has already started.', 'Esta raid ya empezó.'],
  ['Este jogador já tem um personagem nesta party.', 'This player already has a character in this party.', 'Este jugador ya tiene un personaje en esta party.'],
  [
    'Este personagem já está (ou já pediu para entrar) nesta party.',
    'This character is already in (or already asked to join) this party.',
    'Este personaje ya está (o ya pidió entrar) en esta party.',
  ],
  ['Este personagem já está na party.', 'This character is already in the party.', 'Este personaje ya está en la party.'],
  ['Este santuário não está aberto.', "This sanctuary isn't open.", 'Este santuario no está abierto.'],
  ['Faixas demais: no máximo 42 por semana.', 'Too many time ranges: at most 42 per week.', 'Demasiadas franjas: como máximo 42 por semana.'],
  ['Faça login para salvar a disponibilidade.', 'Sign in to save your availability.', 'Inicia sesión para guardar tu disponibilidad.'],
  ['Faça login.', 'Sign in.', 'Inicia sesión.'],
  ['Formação inválida.', 'Invalid lineup.', 'Formación inválida.'],
  ['Fuso horário inválido: %.', 'Invalid time zone: %.', 'Zona horaria inválida: %.'],
  ['Há faixas sobrepostas no mesmo dia.', 'There are overlapping time ranges on the same day.', 'Hay franjas superpuestas en el mismo día.'],
  [
    'Limite de 10 parties ativas por líder. Finalize ou exclua alguma.',
    'Limit of 10 active parties per leader. Finish or delete one.',
    'Límite de 10 parties activas por líder. Finaliza o elimina alguna.',
  ],
  ['Limite de 12 personagens por conta.', 'Limit of 12 characters per account.', 'Límite de 12 personajes por cuenta.'],
  [
    'O líder não pode sair da própria party; para encerrar, exclua a party.',
    "The leader can't leave their own party; to end it, delete the party.",
    'El líder no puede salir de su propia party; para terminarla, elimina la party.',
  ],
  ['O nome da party precisa ter de 2 a 40 caracteres.', 'The party name must be 2 to 40 characters.', 'El nombre de la party debe tener de 2 a 40 caracteres.'],
  ['O nome da party precisa ter de 2 a 40 letras.', 'The party name must be 2 to 40 characters.', 'El nombre de la party debe tener de 2 a 40 caracteres.'],
  ['Personagem não encontrado na sua conta.', 'Character not found in your account.', 'Personaje no encontrado en tu cuenta.'],
  ['Personagem não encontrado.', 'Character not found.', 'Personaje no encontrado.'],
  ['Recorrência inválida.', 'Invalid routine.', 'Rutina inválida.'],
  [
    'Recorrência inválida: escolha dias da semana e horários (HH:MM).',
    'Invalid routine: pick weekdays and times (HH:MM).',
    'Rutina inválida: elige días de la semana y horarios (HH:MM).',
  ],
  ['Salve o webhook antes de testar.', 'Save the webhook before testing.', 'Guarda el webhook antes de probar.'],
  ['Só membros da party podem confirmar presença.', 'Only party members can RSVP.', 'Solo los miembros de la party pueden confirmar asistencia.'],
  ['Só o jogador convidado pode aceitar o convite.', 'Only the invited player can accept the invite.', 'Solo el jugador invitado puede aceptar la invitación.'],
  ['Só o líder organiza a formação.', 'Only the leader arranges the lineup.', 'Solo el líder organiza la formación.'],
  ['Só o líder pode avisar no Discord.', 'Only the leader can announce on Discord.', 'Solo el líder puede avisar en Discord.'],
  ['Só o líder pode convidar para a party.', 'Only the leader can invite to the party.', 'Solo el líder puede invitar a la party.'],
  ['Só o líder pode finalizar a party.', 'Only the leader can finish the party.', 'Solo el líder puede finalizar la party.'],
  ['Só o líder pode mandar lembrete desta raid.', 'Only the leader can send a reminder for this raid.', 'Solo el líder puede enviar un recordatorio de esta raid.'],
  ['Só o líder pode mudar a recorrência.', 'Only the leader can change the routine.', 'Solo el líder puede cambiar la rutina.'],
  ['Só o líder pode testar os avisos.', 'Only the leader can test the alerts.', 'Solo el líder puede probar los avisos.'],
  [
    'Você acabou de avisar no Discord. Espere uns minutos para avisar de novo.',
    'You just announced on Discord. Wait a few minutes to announce again.',
    'Acabas de avisar en Discord. Espera unos minutos para avisar de nuevo.',
  ],
  [
    'Você acabou de lembrar o grupo desta raid. Espere uns minutos para lembrar de novo.',
    'You just reminded the group about this raid. Wait a few minutes to remind again.',
    'Acabas de recordarle al grupo esta raid. Espera unos minutos para recordar de nuevo.',
  ],
  [
    'Você já foi convidado: aceite o convite na página da party.',
    "You've already been invited: accept the invite on the party page.",
    'Ya fuiste invitado: acepta la invitación en la página de la party.',
  ],
  [
    'Você já pediu para entrar com este personagem. Agora é com o líder.',
    "You've already asked to join with this character. Now it's up to the leader.",
    'Ya pediste entrar con este personaje. Ahora depende del líder.',
  ],
  ['Você não pode mudar sua participação desse jeito.', "You can't change your participation that way.", 'No puedes cambiar tu participación de esa forma.'],

  // ---- front (DomainError) ----
  ['Faça login para gerenciar personagens.', 'Sign in to manage characters.', 'Inicia sesión para gestionar personajes.'],
  [
    'Este personagem já está vinculado a outra conta.',
    'This character is already linked to another account.',
    'Este personaje ya está vinculado a otra cuenta.',
  ],
  ['Personagem não encontrado na API do Aion.', 'Character not found in the Aion API.', 'Personaje no encontrado en la API de Aion.'],
  ['Erro % ao consultar o Aion', 'Error % querying Aion', 'Error % al consultar Aion'],
  ['Essa não é uma URL de webhook do Discord.', "That isn't a Discord webhook URL.", 'Esa no es una URL de webhook de Discord.'],
  ['Não foi possível cancelar: recarregue a página.', "Couldn't cancel: reload the page.", 'No se pudo cancelar: recarga la página.'],
  [
    'Não foi possível: a party pode ter mudado ou você não tem permissão. Recarregue a página.',
    "Couldn't do that: the party may have changed or you don't have permission. Reload the page.",
    'No se pudo: la party puede haber cambiado o no tienes permiso. Recarga la página.',
  ],

  // ---- nossa API (/api) ----
  ['A API do Aion demorou para responder. Tente de novo.', 'The Aion API took too long to respond. Try again.', 'La API de Aion tardó en responder. Intenta de nuevo.'],
  [
    'A API do Aion está limitando requisições. Tente em instantes.',
    'The Aion API is rate limiting requests. Try again shortly.',
    'La API de Aion está limitando las solicitudes. Intenta en unos instantes.',
  ],
  [
    'A API do Aion respondeu algo inesperado (manutenção?). Tente mais tarde.',
    'The Aion API returned something unexpected (maintenance?). Try later.',
    'La API de Aion respondió algo inesperado (¿mantenimiento?). Intenta más tarde.',
  ],
  ['Não foi possível falar com a API do Aion. Tente de novo.', "Couldn't reach the Aion API. Try again.", 'No se pudo contactar la API de Aion. Intenta de nuevo.'],
  [
    'A API do Aion está com problema (erro %). Tente mais tarde.',
    'The Aion API is having problems (error %). Try later.',
    'La API de Aion tiene problemas (error %). Intenta más tarde.',
  ],
  ['Personagem não encontrado no Aion.', 'Character not found in Aion.', 'Personaje no encontrado en Aion.'],
  ['Falha ao consultar a API do Aion. Tente de novo.', 'Failed to query the Aion API. Try again.', 'Error al consultar la API de Aion. Intenta de nuevo.'],
  [
    'Não foi possível buscar os patch notes no site do AION 2. Tente de novo.',
    "Couldn't fetch the patch notes from the AION 2 website. Try again.",
    'No se pudieron obtener las notas del parche del sitio de AION 2. Intenta de nuevo.',
  ],
  [
    'O site do AION 2 está com problema (erro %). Tente mais tarde.',
    'The AION 2 website is having problems (error %). Try later.',
    'El sitio de AION 2 tiene problemas (error %). Intenta más tarde.',
  ],
  [
    'O site do AION 2 respondeu algo inesperado (manutenção?). Tente mais tarde.',
    'The AION 2 website returned something unexpected (maintenance?). Try later.',
    'El sitio de AION 2 respondió algo inesperado (¿mantenimiento?). Intenta más tarde.',
  ],
  ['Patch note inválido.', 'Invalid patch note.', 'Nota de parche inválida.'],
  ['Patch note não encontrado.', 'Patch note not found.', 'Nota de parche no encontrada.'],
  ['Região inválida', 'Invalid region', 'Región inválida'],
  ['Informe o patch note.', 'Specify the patch note.', 'Indica la nota de parche.'],
  ['Encantamento inválido', 'Invalid enchantment', 'Encantamiento inválido'],
  ['Informe um nome entre 2 e 32 caracteres', 'Enter a name between 2 and 32 characters', 'Ingresa un nombre de 2 a 32 caracteres'],
  ['Item inválido', 'Invalid item', 'Ítem inválido'],
  ['Personagem inválido', 'Invalid character', 'Personaje inválido'],
  ['Servidor inválido', 'Invalid server', 'Servidor inválido'],
  ['Slot inválido', 'Invalid slot', 'Slot inválido'],
]

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const COMPILED = ENTRIES.map(([pt, en, es]) => ({
  re: new RegExp(`^${pt.split('%').map(escape).join('(.+?)')}$`),
  en,
  es,
}))

const fill = (template: string, values: string[]) => {
  let i = 0
  return template.replace(/%/g, () => values[i++] ?? '')
}

/** Traduz uma mensagem pronta em português; sem tradução conhecida, devolve o original. */
export function translateServerMessage(text: string): string {
  const locale = currentLocale()
  if (locale === 'pt-BR') return text
  for (const { re, en, es } of COMPILED) {
    const m = re.exec(text)
    if (m) return fill(locale === 'en' ? en : es, m.slice(1))
  }
  return text
}
