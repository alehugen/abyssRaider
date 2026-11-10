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
- Use sempre as classes semânticas: `bg-background`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `bg-accent`, `border-border`, `bg-glow`.
- As variantes `dark:`, `elyos:`, `asmodian:` e `abyss:` estão disponíveis.

Aviso: este projeto não tem afiliação com a NCSOFT. Aion é marca registrada da NCSOFT Corporation.

## UI

- Componentes do shadcn-vue ficam em `src/shared/presentation/ui`.
- Para adicionar um componente, use **`npm run ui:add -- <nome>`** em vez de `npx shadcn-vue add`. O script corrige um bug do CLI.
- Os ícones vêm do [Phosphor](https://phosphoricons.com) (`@phosphor-icons/vue`). Exemplo: `import { PhSword } from '@phosphor-icons/vue'`.
