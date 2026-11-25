---
name: vue-supabase-ddd
description: Use ao criar ou evoluir um projeto leve Vue 3 + Supabase. Gera o scaffold pronto e define stack (TypeScript, shadcn-vue, Phosphor, Tailwind 4, Pinia, Vue Router, Vitest, ESLint), DDD, TDD, design system, temas e PWA opcional.
---

# Projeto leve Vue 3 + Supabase (DDD + TDD)

Padrão para todo projeto leve novo. Siga a stack, a arquitetura e o fluxo de trabalho abaixo sem pedir confirmação; pergunte só o que for específico do projeto (nome, contextos de domínio, se precisa de autenticação, qual design system usar, se a aplicação também deve ser PWA).

Ao rodar esta skill em um projeto novo, o resultado é o scaffold completo e funcionando, conforme a seção "Scaffold", não um plano.

## Stack

| Camada | Escolha | Pacote |
|---|---|---|
| Framework | Vue 3, `<script setup lang="ts">`, Composition API | `vue` |
| Linguagem | TypeScript em modo `strict` | `typescript`, `vue-tsc` |
| Build | Vite | `vite`, `@vitejs/plugin-vue` |
| Estilo | Tailwind CSS 4 (config via CSS, sem `tailwind.config.js`) | `tailwindcss`, `@tailwindcss/vite` |
| Componentes | shadcn-vue | CLI `shadcn-vue` |
| Ícones | Phosphor Icons | `@phosphor-icons/vue` |
| Estado | Pinia (setup stores) | `pinia` |
| Rotas | Vue Router | `vue-router` |
| Backend | Supabase (Postgres, Auth, Storage) | `@supabase/supabase-js` |
| Testes | Vitest + Vue Test Utils + jsdom | `vitest`, `@vue/test-utils`, `jsdom` |
| Lint | ESLint (flat config) com regras de Vue e TypeScript | `eslint`, `eslint-plugin-vue`, `typescript-eslint` |

Não adicione outras bibliotecas de UI, ícones, estado ou HTTP sem o usuário pedir.

## TDD (obrigatório)

Todo código de produção nasce de um teste. Isso vale para o scaffold e para qualquer mudança posterior.

1. **Red**: escreva o teste do comportamento e rode para ver falhar pelo motivo certo.
2. **Green**: escreva o mínimo de código para passar.
3. **Refactor**: limpe com os testes verdes.

Regras:
- Não escreva implementação antes do teste nem entregue código sem teste correspondente. Correção de bug começa por um teste que reproduz o bug.
- Testes ficam ao lado do arquivo testado, como `nome.spec.ts`.
- **domain** e **application**: testes unitários puros. Casos de uso são testados com um repositório fake em memória que implementa a interface do domain.
- **infrastructure**: teste os mappers (linha do banco <-> entidade). Repositórios Supabase são testados com o cliente mockado; não chame o Supabase real em teste unitário.
- **presentation**: stores com `setActivePinia(createPinia())` e casos de uso/repositórios fake; componentes com Vue Test Utils, testando comportamento visível, não detalhes internos.
- Componentes de `shared/ui` gerados pelo shadcn-vue não precisam de teste próprio; os que forem criados ou alterados com lógica, sim.
- Rode `npm run test` e `npm run lint` antes de considerar qualquer tarefa pronta.

## Design system

Todo projeto tem um design system, e toda a UI é construída a partir dele.

- No início do projeto, pergunte qual design system usar. Se o usuário fornecer um (tokens, guia, arquivo), aplique-o. Se ainda não existir, crie os tokens com valores provisórios e avise que serão substituídos.
- Os tokens (cores, tipografia, espaçamento, raios, sombras) moram em `src/app/styles/` como variáveis CSS expostas ao Tailwind via `@theme`, mapeadas para os tokens semânticos do shadcn-vue (`--background`, `--primary` etc.), com um bloco de tokens por tema.
- Os componentes do design system ficam em `src/shared/ui`: os do shadcn-vue ajustados aos tokens, mais os próprios do projeto.
- Nunca use cor, fonte, espaçamento ou raio fixo em páginas e componentes de módulo (nada de hex ou valores arbitrários do Tailwind como `bg-[#123456]`). Se faltar um token ou componente, adicione ao design system primeiro e depois use.
- Antes de criar um componente novo, verifique se já existe um equivalente em `shared/ui`.
- Documente tokens, temas e componentes disponíveis em `docs/design-system.md`.

## Temas (useTheme)

Todo projeto já nasce com escolha de tema funcionando, exposta pelo composable `useTheme`.

- `src/shared/composables/useTheme.ts` é a única porta de entrada para tema. Ele expõe `theme` (escolha atual), `resolvedTheme` (tema efetivamente aplicado), `themes` (lista disponível) e `setTheme(id)`.
- Os temas são registrados em `src/shared/composables/themes.ts` como `{ id, label, scheme: 'light' | 'dark' }`. O scaffold já vem com `light`, `dark` e a opção `system`, que segue `prefers-color-scheme` e reage a mudanças do sistema.
- Aplicar um tema significa definir `data-theme="<id>"` no `<html>` e a classe `dark` quando o `scheme` for escuro (o que o shadcn-vue e a variante `dark:` do Tailwind esperam). Cada tema é um bloco de tokens em `src/app/styles/`, sobrescrevendo as variáveis do design system.
- A escolha é persistida em `localStorage` e restaurada na carga. Um script inline no `index.html` aplica o tema antes do app montar, para não piscar o tema errado.
- O estado é compartilhado: todos os componentes que chamam `useTheme()` veem o mesmo valor.
- O scaffold inclui um `ThemeSwitcher` em `shared/ui`, com ícones Phosphor, já colocado no layout principal.
- Adicionar um tema novo é só registrar em `themes.ts` e criar o bloco de tokens; nenhum componente muda.
- Componentes nunca leem `localStorage`, `matchMedia` ou mexem em classes do `<html>` diretamente; usam `useTheme`.
- `useTheme` e `ThemeSwitcher` são escritos com TDD: troca de tema, persistência, restauração, modo `system` e reação à mudança do sistema têm teste.

## PWA (opcional, sempre perguntar)

No início de todo projeto, pergunte: "Quer que a aplicação também seja uma PWA (instalável, com atualização automática e suporte offline)?". Se a resposta for não, pule esta seção inteira. Se for sim, a PWA é completa, com responsividade e usabilidade como foco central, e segue tudo abaixo.

Junto com o sim, pergunte também se precisa ler dados offline (o padrão é não: só a interface funciona offline e os dados exigem conexão).

Notificações push ficam fora do escopo: não implemente nem pergunte sobre push, a menos que o usuário peça.

Antes de implementar, confira a documentação atual do `vite-plugin-pwa`.

### Base

- Usar `vite-plugin-pwa` (Workbox, estratégia `generateSW`) e `@vite-pwa/assets-generator` para gerar todos os ícones a partir de um único SVG.
- Manifest completo: `name`, `short_name`, `description`, `lang`, `start_url`, `scope`, `display: 'standalone'`, `theme_color`, `background_color`, ícones 192 e 512, ícone `maskable`, e `screenshots` (um estreito e um largo) para a tela de instalação rica.
- iOS: `apple-touch-icon` e as meta tags de web app no `index.html`.
- A meta `theme-color` acompanha o tema ativo: o `useTheme` a atualiza a cada troca.
- Habilitar o service worker em desenvolvimento (`devOptions`) só para testar a PWA; o teste final é sempre em `npm run build` + `npm run preview`.

### Atualização a cada build

- Cada build gera um service worker novo com a lista de arquivos versionada; `cleanupOutdatedCaches: true` remove os caches antigos.
- `registerType: 'prompt'` com o composable `usePwaUpdate` (em `shared/composables`, sobre `virtual:pwa-register/vue`). Ele procura versão nova ao abrir o app, quando o app volta ao primeiro plano e a cada hora.
- Ao encontrar versão nova, mostrar um aviso discreto "Nova versão disponível" com o botão "Atualizar". Se o usuário ignorar, a versão nova entra na próxima abertura do app. Nunca recarregar a página sozinho no meio do uso, para não perder o que o usuário está preenchendo.
- No README, documentar que a hospedagem deve servir `index.html`, `sw.js` e o manifest sem cache (`Cache-Control: no-cache`); sem isso a atualização não chega.

### Offline e cache

- Precache de toda a interface (JS, CSS, fontes, ícones) e `navigateFallback` para `index.html`, para o app abrir e navegar sem rede.
- Requisições ao Supabase (auth, dados, realtime, storage privado) não passam pelo cache do service worker, para não servir dado velho nem dado de outro usuário.
- `useOnline` (em `shared/composables`) expõe o estado da conexão. Offline, mostrar um aviso fixo e discreto, desabilitar ações que precisam de rede explicando o motivo, e nunca deixar uma tela em branco ou carregando para sempre.
- Se o usuário pediu leitura offline, usar `NetworkFirst` só nas consultas de leitura combinadas e limpar esse cache no logout.

### Instalação

- `usePwaInstall` (em `shared/composables`) captura o `beforeinstallprompt` e expõe `canInstall`, `install()` e `isInstalled`.
- Mostrar um botão próprio "Instalar app" em local previsível (menu ou configurações) e, no máximo, um convite depois que o usuário já usou o app; nunca na primeira tela.
- No iOS não existe esse evento: mostrar a instrução "Compartilhar > Adicionar à Tela de Início".
- Esconder tudo isso quando o app já roda instalado (`display-mode: standalone`).

### Responsividade e usabilidade

- Mobile-first: toda tela é desenhada primeiro para 360px e depois ampliada com os breakpoints do Tailwind até o desktop.
- Navegação adaptada: barra inferior no celular, barra lateral no desktop. Instalado, o app não tem botão voltar do navegador, então toda tela interna precisa de um caminho de volta visível.
- `viewport-fit=cover` e `env(safe-area-inset-*)` para respeitar notch e barra de gestos; usar `dvh` em vez de `vh` para altura de tela.
- Alvos de toque com no mínimo 44x44px; nenhuma ação depende só de hover.
- Campos com fonte de 16px ou mais (evita zoom automático no iOS) e `type`, `inputmode` e `autocomplete` corretos para abrir o teclado certo.
- Toda ação dá retorno imediato: skeleton em carregamentos, estado de envio nos botões, mensagens de erro claras com opção de tentar de novo.
- Não bloquear o zoom do usuário; respeitar `prefers-reduced-motion`.
- Esses componentes (aviso de atualização, aviso offline, botão de instalar, navegação) fazem parte do design system e ficam em `shared/ui`.

### Testes e verificação

- `usePwaUpdate`, `usePwaInstall`, `useOnline` e os componentes ligados a eles são escritos com TDD, mockando o módulo virtual do plugin e os eventos do navegador.
- Verificar no build de preview: instalável (DevTools > Application > Manifest sem erros), abre offline, e uma segunda build dispara o aviso de atualização.
- Rodar o Lighthouse em modo mobile e corrigir os problemas de performance e acessibilidade apontados.

## Scaffold

Antes de rodar, confira os comandos na documentação atual de shadcn-vue, Tailwind e ESLint, pois os CLIs mudam com frequência.

1. `npm create vite@latest <nome> -- --template vue-ts`
2. `npm i vue-router pinia @supabase/supabase-js @phosphor-icons/vue`
3. `npm i tailwindcss @tailwindcss/vite`, registrar o plugin no `vite.config.ts` e usar `@import "tailwindcss";` no CSS principal.
4. Configurar o alias `@` -> `src` em `vite.config.ts` e `tsconfig`.
5. `npx shadcn-vue@latest init`, depois ajustar `components.json` para que os aliases apontem para `@/shared/ui` (componentes) e `@/shared/lib/utils` (utils).
6. `npm i -D vitest @vue/test-utils jsdom` e configurar `test` no `vite.config.ts` (`environment: 'jsdom'`, `globals: true`, alias `@`).
7. `npm i -D eslint eslint-plugin-vue typescript-eslint` e criar `eslint.config.js` (flat config) com as regras recomendadas de Vue 3 e TypeScript, mais `no-restricted-imports` para reforçar a regra de dependência entre camadas.
8. Scripts no `package.json`: `dev`, `build`, `typecheck` (`vue-tsc --noEmit`), `test` (`vitest run`), `test:watch` (`vitest`), `lint` (`eslint .`), `lint:fix`.
9. Criar `.env.example` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; `.env` fica no `.gitignore`.
10. Criar a estrutura de pastas, os tokens do design system (um bloco por tema) e `docs/design-system.md`.
11. Criar, com TDD, `useTheme`, `themes.ts`, o script anti-flash no `index.html` e o `ThemeSwitcher` no layout principal, conforme a seção "Temas".
12. Criar, com TDD, um módulo de exemplo funcionando de ponta a ponta (entidade, caso de uso, repositório, store, página e rota), todos com testes.
13. Se o usuário quis PWA: `npm i -D vite-plugin-pwa @vite-pwa/assets-generator`, configurar o plugin e o manifest, gerar os ícones e criar, com TDD, `usePwaUpdate`, `usePwaInstall`, `useOnline` e seus componentes, conforme a seção "PWA".
14. Escrever o README (como rodar, configurar o Supabase, scripts, resumo da arquitetura e, se houver PWA, como testar e as regras de cache da hospedagem) e fazer `git init` com o commit inicial.

O scaffold só está pronto quando `npm run dev` sobe a aplicação, a troca de tema funciona e `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passam.

## Arquitetura

DDD modular: cada bounded context é uma pasta em `modules/`, com as quatro camadas dentro dela.

```
src/
  app/                      # composição da aplicação
    main.ts
    App.vue
    router/index.ts         # junta as rotas dos módulos + guards
    layouts/
    styles/                 # Tailwind + tokens do design system (um bloco por tema)
  modules/
    <contexto>/
      domain/               # entidades, value objects, regras, interfaces de repositório
      application/          # casos de uso
      infrastructure/       # repositórios Supabase, mappers
      presentation/         # pages/, components/, stores/, composables/, routes.ts
      index.ts              # API pública do módulo
  shared/
    domain/                 # Result, erros de domínio, tipos base
    infrastructure/
      supabase/client.ts    # único createClient do projeto
      supabase/database.types.ts   # gerado: supabase gen types typescript
    ui/                     # componentes do design system (shadcn-vue + próprios)
    composables/
      useTheme.ts           # escolha de tema (light, dark, system + temas do design system)
      themes.ts             # registro dos temas disponíveis
    lib/utils.ts
docs/
  design-system.md
```

### Regra de dependência

`presentation -> application -> domain <- infrastructure`

- **domain**: TypeScript puro. Nunca importa `vue`, `pinia`, `@supabase/*` nem nada de outras camadas. Define as interfaces de repositório (ex.: `TaskRepository`).
- **application**: um caso de uso por arquivo, como função que recebe o repositório por parâmetro (ex.: `createTask(repo, input)`). Só importa do domain.
- **infrastructure**: implementa as interfaces do domain com o cliente Supabase. Mappers convertem linha do banco (snake_case, tipos gerados) em entidade de domínio e vice-versa. Tipos do Supabase não saem desta camada.
- **presentation**: componentes, páginas e stores Pinia. As stores chamam casos de uso, nunca o Supabase direto. Componentes não importam de `infrastructure`.
- Um módulo só importa outro pelo `index.ts` dele. O que for comum de verdade vai para `shared/`.

### Manter leve

- Entidades são `type`/`interface` + funções puras; use classe só quando houver invariante que justifique.
- Value object só para conceito com regra de validação (Email, Money), não para toda string.
- Erros esperados retornam `Result<T, E>` de `shared/domain`; exceção fica para o inesperado.
- A injeção de dependência é manual: o `index.ts` do módulo instancia o repositório Supabase e o entrega aos casos de uso. Sem container de DI.
- CRUD trivial ainda passa pelas camadas, mas com o mínimo de código; não crie abstrações antes de precisar.

## Convenções

**Vue**
- Sempre `<script setup lang="ts">`; props e emits tipados com `defineProps<T>()` e `defineEmits<T>()`.
- Páginas em `presentation/pages` com sufixo `Page.vue`; componentes em PascalCase.

**Pinia**
- Setup stores (`defineStore('tasks', () => { ... })`), uma por agregado ou tela, dentro do módulo.
- A store guarda estado de UI e dados carregados; regra de negócio fica no domain.

**Vue Router**
- Cada módulo exporta suas rotas em `presentation/routes.ts`, com lazy loading (`() => import(...)`).
- `app/router/index.ts` só agrega rotas e registra o guard de autenticação baseado em `meta.requiresAuth`.

**UI**
- Adicionar componentes com `npx shadcn-vue@latest add <componente>`; eles ficam em `shared/ui` e devem ser ajustados aos tokens do design system.
- Ícones sempre do Phosphor (`import { PhPlus } from '@phosphor-icons/vue'`). Se um componente do shadcn vier com ícone Lucide, troque pelo equivalente Phosphor e remova a dependência do Lucide.
- Use `cn()` de `shared/lib/utils` para combinar classes.

**Supabase**
- Um único cliente em `shared/infrastructure/supabase/client.ts`, tipado com `Database`.
- RLS habilitado em toda tabela, com policies escritas junto da migration. O front só usa a chave anon/publishable; a service role nunca entra no projeto.
- Schema versionado em `supabase/migrations`; regenerar `database.types.ts` depois de cada migration.
- Estado de sessão em um módulo `auth`, que escuta `onAuthStateChange` e expõe o usuário para o guard do router.

**ESLint**
- Sem `eslint-disable` para contornar erro; corrija o código. Exceção só com comentário explicando o motivo.

## Checklist antes de entregar

- Todo código novo foi escrito a partir de um teste, e `npm run test` passa.
- `npm run lint`, `npm run typecheck` e `npm run build` passam.
- Nenhum import de `@supabase/*` fora de `infrastructure/`.
- Nenhum import de `vue` ou `pinia` dentro de `domain/` ou `application/`.
- Nenhuma cor, fonte ou espaçamento fixo fora do design system.
- A troca de tema funciona em todas as telas novas (claro, escuro e system), e nenhum componente manipula tema fora do `useTheme`.
- Se o projeto é PWA: telas novas funcionam a partir de 360px, têm caminho de volta sem o navegador, tratam o estado offline, e o build de preview continua instalável e avisando sobre versão nova.
- `.env.example`, README e `docs/design-system.md` atualizados.
