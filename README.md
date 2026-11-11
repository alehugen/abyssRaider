# AbyssRaider

Organizador de raids para Aion 2: login com Discord, vínculo de personagem, parties e calendário de raids com notificações.

## Stack

- Vue 3 + TypeScript + Vite, Vue Router, Pinia
- Tailwind CSS 4, com temas Elyos, Asmodian e Abyss
- Supabase (Postgres, Auth com Discord, cron) e Vercel (hospedagem + funções em `/api`)
- Arquitetura DDD por contexto em `src/contexts/<contexto>/{domain,application,infrastructure,presentation}`

## Desenvolvimento

```bash
cp .env.example .env   # preencha as chaves do Supabase
npm install
npm run dev
npm test
npm run build
```

## Temas

- Os temas ficam registrados em `src/shared/presentation/theme/themes.ts`.
- As paletas ficam em `src/app/styles/themes.css`.
- Use sempre as classes semânticas, no padrão do shadcn: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `border-border`.
- Extras do projeto: `bg-highlight`, `bg-glow`, `shadow-card`, e as classes de facção `bg-faction-soft`, `text-faction-ink` e `border-faction`. Estas valem dentro de um elemento com `.faction-elyos` ou `.faction-asmodian`.
- As variantes `dark:`, `elyos:`, `asmodian:` e `abyss:` estão disponíveis.

## Banco (Supabase)

- As migrations ficam em `supabase/migrations/` e rodam **em ordem de nome** no SQL Editor do Supabase.
- Os cinco arquivos `20261110*` são a base consolidada (perfis, personagens, parties, agenda/disponibilidade e avisos do Discord); os seguintes são incrementais.
- Os avisos do Discord e os lembretes usam as extensões gratuitas `pg_net` e `pg_cron`. Se a migration reclamar de permissão, ligue as duas em **Database → Extensions** e rode de novo.
- O sino de notificações usa o Realtime: confira em **Database → Publications** que `notifications` está na `supabase_realtime`.
- No front e no `.env` vão só a URL e a chave pública (`sb_publishable_...`). Nunca a `service_role`.

Aviso: este projeto não tem afiliação com a NCSOFT. Aion é marca registrada da NCSOFT Corporation.

## UI

- Componentes do shadcn-vue ficam em `src/shared/presentation/ui`.
- Para adicionar um componente, use **`npm run ui:add -- <nome>`** em vez de `npx shadcn-vue add`. O script corrige um bug do CLI.
- Os ícones vêm do [Phosphor](https://phosphoricons.com) (`@phosphor-icons/vue`). Exemplo: `import { PhSword } from '@phosphor-icons/vue'`.
