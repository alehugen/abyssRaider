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

## Celular e PWA

O app é instalável (PWA), com o celular como prioridade.

- **Instalar:** no menu do usuário, "Instalar app". No Android/Chrome abre o convite do navegador; no iPhone/iPad mostra o passo a passo (Compartilhar > Adicionar à Tela de Início). O item some quando o app já está instalado.
- **Atualização:** cada build gera um service worker novo. O app procura versão nova ao abrir, ao voltar para a frente e a cada hora, e mostra "Nova versão disponível" com o botão Atualizar. Nunca recarrega sozinho; se a pessoa ignorar, a versão nova entra na próxima abertura.
- **Offline:** a interface abre e navega sem rede, com um aviso fixo de "Sem conexão". Os dados (Supabase e `/api`) não passam pelo cache do service worker, para nunca mostrar dado velho ou de outra conta.
- **Hospedagem:** `index.html`, `sw.js`, `registerSW.js` e `manifest.webmanifest` precisam ir sem cache (`Cache-Control: no-cache`), senão a atualização não chega. Isso está em `vercel.json`.
- **Ícones:** gerados de `public/pwa-source.png` com `npx pwa-assets-generator` (config em `pwa-assets.config.ts`). Para trocar o ícone, substitua esse arquivo (512×512 ou maior) e rode de novo.
- **Testar:** `npm run build` e `npm run preview`, depois DevTools > Application > Manifest (sem erros) e Service Workers (marque Offline e recarregue). Em `npm run dev` o service worker fica desligado (`devOptions` em `vite.config.ts`).
- **Service worker:** é nosso, em `src/sw/sw.ts` (modo `injectManifest`): precache da interface, rotas offline, fontes e push.
- **Layout:** telas desenhadas a partir de 360px. No celular, a navegação fica na barra inferior; a partir de `md`, no cabeçalho. Use os utilitários de área segura do `main.css` (`pt-safe`, `pb-safe`, `px-safe`, `pb-nav`, `bottom-nav`) em vez de valores soltos, e prefira `dvh` a `vh`. Em tela de toque, botões e itens de menu aceitam toque numa área de pelo menos 44×44px.

## Notificações push

Cada pessoa ativa no menu do usuário, em "Notificações no aparelho", e escolhe o que recebe:

- **Party e raids:** tudo que aparece no sino.
  - Party: convite, convite aceito, pedido para entrar (recebido, aceito, recusado), removido da party pelo líder e party excluída.
  - Raids: raid marcada, raid cancelada, lembrete do líder e lembrete automático 1 h antes. O lembrete automático vale para toda party, com ou sem Discord.
- **Patch notes:** cada patch novo, junto com o post no Discord. Por isso depende de `patch_notes_feed` configurado.

Vale por aparelho e por conta. Ao sair da conta, o aparelho deixa de receber. No Android e no computador funciona pelo navegador; no iPhone e no iPad só com o app instalado na Tela de Início (iOS 16.4+).

**Como funciona:** o banco junta os aparelhos de quem deve ser avisado e, pelo `pg_net`, chama `/api/push/send` com um segredo. A função monta o texto no idioma de cada aparelho e entrega pelo serviço de push do navegador, que é gratuito. Os aparelhos que cancelaram voltam pela `push_forget` e são apagados. Nada usa a `service_role`.

**Configuração (uma vez):**

1. Rode `20261126000000_push.sql` e depois `20261126010000_push_bell.sql` no SQL Editor.
2. Gere as chaves com `npx web-push generate-vapid-keys`.
3. Na Vercel, cadastre estas variáveis e faça um novo deploy (a chave pública entra no build):
   - `VITE_VAPID_PUBLIC_KEY`: a chave pública.
   - `VAPID_PRIVATE_KEY`: a chave privada.
   - `PUSH_SECRET`: o resultado de `select secret from public.push_config`.
4. O endereço do app vem de `patch_notes_feed.app_url`. Para fixar outro, rode `update public.push_config set app_url = 'https://...'`.

**Conferir:** os envios ficam em `net._http_response`. Por exemplo, `select status_code, content from net._http_response order by created desc limit 5` mostra `{"sent":1,...}`.

## Banco (Supabase)

- As migrations ficam em `supabase/migrations/` e rodam **em ordem de nome** no SQL Editor do Supabase.
- Os cinco primeiros arquivos (10/11) montam a base: perfis e personagens, parties, agenda (raids, presença, recorrência, disponibilidade), notificações do sino e avisos do Discord. Os seguintes são mudanças em cima dela (lembrete manual, patch notes, santuário novo, push, correções). Uma função redefinida vale pela versão do arquivo mais recente. Mudanças novas entram como arquivos seguintes (data mais recente no nome), sempre idempotentes (`create or replace`, `if not exists`).
- `supabase/manutencao/` guarda scripts de uma vez só para o banco que já está no ar (ex.: depois de uma consolidação). Banco novo não precisa deles.
- `supabase/checks/consistency.sql` confere os dados (só leitura): nenhuma linha = tudo consistente.
- Os avisos do Discord e os lembretes usam as extensões gratuitas `pg_net` e `pg_cron`. Se a migration reclamar de permissão, ligue as duas em **Database → Extensions** e rode de novo.
- Patch notes no Discord: a cada 5 min na quarta (dia dos patches) e uma vez por dia nos outros (09:00 de Brasília) o banco (`patch_notes_tick`) consulta `/api/patch-notes/discord` e posta no canal só os patches novos. O webhook do canal fica em `patch_notes_feed`, que o app não lê; a configuração está no topo de `20261117010000_patch_notes.sql`. Para ver como está: `select last_status, last_run_at from public.patch_notes_feed`.
- O sino de notificações usa o Realtime: confira em **Database → Publications** que `notifications` está na `supabase_realtime`.
- No front e no `.env` vão só a URL e a chave pública (`sb_publishable_...`). Nunca a `service_role`.

Aviso: este projeto não tem afiliação com a NCSOFT. Aion é marca registrada da NCSOFT Corporation.

## UI

- Componentes do shadcn-vue ficam em `src/shared/presentation/ui`.
- Para adicionar um componente, use **`npm run ui:add -- <nome>`** em vez de `npx shadcn-vue add`. O script corrige um bug do CLI.
- Os ícones vêm do [Phosphor](https://phosphoricons.com) (`@phosphor-icons/vue`). Exemplo: `import { PhSword } from '@phosphor-icons/vue'`.
