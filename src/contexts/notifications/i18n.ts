import { defineMessages } from '@/shared/i18n/defineMessages'

/** Textos do contexto notifications (chaves: 'notifications.*'). */
export default defineMessages(
  {
    fallback: {
      party: 'a party',
      player: 'Um jogador',
      leader: 'O líder',
      yourCharacter: 'seu personagem',
    },
    raidAt: '{date}, às {time}',
    now: 'agora',
    kinds: {
      inviteReceived: {
        title: 'Convite para {party}',
        body: '{leader} convidou {character}. Aceite ou recuse na página da party.',
        bodyYou: '{leader} convidou você. Aceite ou recuse na página da party.',
      },
      inviteAccepted: {
        title: '{character} aceitou o convite',
        body: 'Agora faz parte de {party}.',
      },
      requestReceived: {
        title: '{character} pediu para entrar',
        body: 'Em {party}. Aceite ou recuse na página da party.',
      },
      requestAccepted: {
        title: 'Você entrou em {party}',
        body: 'O líder aceitou {character}.',
      },
      requestDeclined: {
        title: 'Pedido recusado',
        body: 'O líder de {party} recusou {character}.',
      },
      raidScheduled: { title: 'Raid marcada em {party}' },
      raidReminder: { title: 'Lembrete: raid em {party}' },
      raidBody: '{at} ({tz}). Confirme sua presença.',
      partyDeleted: {
        title: '{party} foi excluída',
        body: 'O líder encerrou a party. As raids marcadas nela foram canceladas.',
      },
      raidCancelled: {
        title: 'Raid cancelada em {party}',
        body: 'A raid de {at} foi cancelada.',
        bodyNoDate: 'Uma raid foi cancelada.',
      },
    },
    bell: {
      title: 'Notificações',
      label: 'Notificações',
      labelUnread: 'Notificações, {n} não lida | Notificações, {n} não lidas',
      markAllRead: 'Marcar todas como lidas',
      empty: 'Nada por aqui ainda. Convites, pedidos e raids marcadas aparecem aqui.',
      unread: 'não lida',
    },
  },
  {
    fallback: {
      party: 'the party',
      player: 'A player',
      leader: 'The leader',
      yourCharacter: 'your character',
    },
    raidAt: '{date} at {time}',
    now: 'just now',
    kinds: {
      inviteReceived: {
        title: 'Invite to {party}',
        body: '{leader} invited {character}. Accept or decline on the party page.',
        bodyYou: '{leader} invited you. Accept or decline on the party page.',
      },
      inviteAccepted: {
        title: '{character} accepted the invite',
        body: 'Now part of {party}.',
      },
      requestReceived: {
        title: '{character} asked to join',
        body: 'In {party}. Accept or decline on the party page.',
      },
      requestAccepted: {
        title: 'You joined {party}',
        body: 'The leader accepted {character}.',
      },
      requestDeclined: {
        title: 'Request declined',
        body: 'The leader of {party} declined {character}.',
      },
      raidScheduled: { title: 'Raid scheduled in {party}' },
      raidReminder: { title: 'Reminder: raid in {party}' },
      raidBody: '{at} ({tz}). Confirm your attendance.',
      partyDeleted: {
        title: '{party} was deleted',
        body: 'The leader closed the party. Its scheduled raids were canceled.',
      },
      raidCancelled: {
        title: 'Raid canceled in {party}',
        body: 'The raid on {at} was canceled.',
        bodyNoDate: 'A raid was canceled.',
      },
    },
    bell: {
      title: 'Notifications',
      label: 'Notifications',
      labelUnread: 'Notifications, {n} unread | Notifications, {n} unread',
      markAllRead: 'Mark all as read',
      empty: 'Nothing here yet. Invites, requests and scheduled raids show up here.',
      unread: 'unread',
    },
  },
  {
    fallback: {
      party: 'la party',
      player: 'Un jugador',
      leader: 'El líder',
      yourCharacter: 'tu personaje',
    },
    raidAt: '{date}, a las {time}',
    now: 'ahora',
    kinds: {
      inviteReceived: {
        title: 'Invitación a {party}',
        body: '{leader} invitó a {character}. Acepta o rechaza en la página de la party.',
        bodyYou: '{leader} te invitó. Acepta o rechaza en la página de la party.',
      },
      inviteAccepted: {
        title: '{character} aceptó la invitación',
        body: 'Ahora forma parte de {party}.',
      },
      requestReceived: {
        title: '{character} pidió unirse',
        body: 'En {party}. Acepta o rechaza en la página de la party.',
      },
      requestAccepted: {
        title: 'Entraste en {party}',
        body: 'El líder aceptó a {character}.',
      },
      requestDeclined: {
        title: 'Solicitud rechazada',
        body: 'El líder de {party} rechazó a {character}.',
      },
      raidScheduled: { title: 'Raid programada en {party}' },
      raidReminder: { title: 'Recordatorio: raid en {party}' },
      raidBody: '{at} ({tz}). Confirma tu asistencia.',
      partyDeleted: {
        title: '{party} fue eliminada',
        body: 'El líder cerró la party. Las raids programadas en ella se cancelaron.',
      },
      raidCancelled: {
        title: 'Raid cancelada en {party}',
        body: 'La raid del {at} se canceló.',
        bodyNoDate: 'Se canceló una raid.',
      },
    },
    bell: {
      title: 'Notificaciones',
      label: 'Notificaciones',
      labelUnread: 'Notificaciones, {n} sin leer | Notificaciones, {n} sin leer',
      markAllRead: 'Marcar todas como leídas',
      empty: 'Aún no hay nada aquí. Las invitaciones, solicitudes y raids programadas aparecen aquí.',
      unread: 'sin leer',
    },
  },
)
