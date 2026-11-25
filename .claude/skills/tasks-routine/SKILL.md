---
name: vue-supabase-task
description: Use ao executar qualquer task (feature, bug, refactor, ajuste) em um projeto Vue 3 + Supabase criado com a skill vue-supabase-ddd. Fluxo padrão de entendimento, TDD, verificação e commits no formato Conventional Commits.
---

# Execução de task (Vue 3 + Supabase, DDD + TDD)

Toda task segue o mesmo fluxo, do entendimento ao commit, para o projeto manter o padrão. As regras de stack, arquitetura, design system, temas e PWA vêm da skill `vue-supabase-ddd`: carregue-a antes de codar se ela ainda não estiver no contexto. Se as duas divergirem do que já existe no repositório, siga o repositório e avise.

Resumo do que não muda: Vue 3 + TypeScript strict, shadcn-vue, Phosphor, Tailwind 4, Pinia, Vue Router, Supabase, Vitest, ESLint; módulos em `src/modules/<contexto>/` com `domain`, `application`, `infrastructure` e `presentation`; dependência `presentation -> application -> domain <- infrastructure`; UI só com tokens e componentes do design system; tema só via `useTheme`.

## Fluxo

### 1. Entender

- Leia a task e reescreva em uma ou duas frases o que será entregue e os critérios de aceite. Se a task não tiver critérios, proponha-os.
- Leia o código envolvido antes de planejar: módulo, testes existentes, componentes de `shared/ui` que já resolvem parte do problema.
- Pergunte só quando a dúvida muda o que será construído (regra de negócio ambígua, mudança de schema, comportamento não descrito). Dúvida de implementação se resolve seguindo o padrão do projeto.

### 2. Planejar

- Defina o tipo da task (`feat`, `fix`, `refactor` etc.) e o módulo afetado; isso já determina branch e commits.
- Liste os passos por camada, de dentro para fora: domain, application, infrastructure, presentation. Cada passo deve caber em um commit.
- Se a task pedir contexto novo, crie um módulo novo; não encaixe regra de um contexto dentro de outro.
- Se estiver na branch principal, crie uma branch `<tipo>/<descricao-curta>` (ex.: `feat/task-due-date`). Não faça push nem abra PR sem o usuário pedir.
- Para task pequena, o plano são três ou quatro linhas; não pare para pedir aprovação, a menos que envolva mudança de schema, dependência nova ou quebra de comportamento existente.

### 3. Executar com TDD

Para cada passo do plano:

1. **Red**: escreva o teste do comportamento e rode para ver falhar pelo motivo certo.
2. **Green**: implemente o mínimo para passar.
3. **Refactor**: limpe com os testes verdes.
4. Faça o commit do passo (regras abaixo).

Regras de execução:
- Bug começa por um teste que reproduz o bug.
- Faça só o que a task pede. Problema encontrado fora do escopo é anotado e relatado no final, não corrigido de carona.
- Dependência nova só com aprovação do usuário.
- Mudança de banco: migration em `supabase/migrations`, RLS e policies na mesma migration, e `database.types.ts` regenerado.
- UI nova: reutilize `shared/ui`; se faltar token ou componente, adicione ao design system primeiro. Confira nos temas claro e escuro e, se o projeto for PWA, a partir de 360px e no estado offline.
- Texto visível ao usuário segue o idioma já usado na aplicação.

### 4. Verificar

Antes de considerar a task pronta, rode e deixe passando:

```
npm run typecheck
npm run lint
npm run test
npm run build
```

Depois confira:
- Cada critério de aceite tem um teste que o cobre.
- Nenhum import de `@supabase/*` fora de `infrastructure/`, nem de `vue`/`pinia` em `domain/` ou `application/`.
- Nenhuma cor, fonte ou espaçamento fixo fora do design system.
- README, `.env.example` e `docs/design-system.md` atualizados se a task mexeu neles.

Se algo falhar e não for possível corrigir, não declare a task como pronta: relate o que falhou.

### 5. Relatar

Termine com um resumo curto: o que foi entregue, os commits criados, o resultado das verificações e o que ficou pendente ou foi encontrado fora do escopo.

## Commits (Conventional Commits 1.0.0)

Especificação: https://www.conventionalcommits.org/en/v1.0.0/

### Formato

```
<tipo>(<escopo>): <descrição>

[corpo opcional]

[rodapés opcionais]
```

Corpo e rodapés são separados da parte anterior por uma linha em branco.

### Tipos

| Tipo | Quando usar |
|---|---|
| `feat` | Funcionalidade nova para o usuário |
| `fix` | Correção de bug |
| `refactor` | Mudança de código sem alterar comportamento |
| `test` | Só testes (adicionar ou corrigir), sem código de produção |
| `docs` | Só documentação (README, `docs/`) |
| `style` | Formatação de código, sem mudança de lógica (não é estilo visual) |
| `perf` | Melhoria de performance |
| `build` | Dependências, Vite, configuração de build |
| `ci` | Pipelines e automações |
| `chore` | Manutenção que não entra nos tipos acima |
| `revert` | Reverte um commit anterior (citar o SHA no rodapé `Refs:`) |

Mudança visual que o usuário percebe é `feat` ou `fix`, não `style`.

### Escopo

- Use o nome do módulo afetado (`tasks`, `auth`) ou uma área transversal: `ui` (design system e `shared/ui`), `theme`, `pwa`, `router`, `supabase` (cliente, migrations, tipos), `deps`, `config`.
- Um escopo por commit. Se a mudança atravessa vários módulos de verdade, omita o escopo.

### Descrição, corpo e rodapés

- Escreva em inglês, no imperativo, em minúsculas, sem ponto final, com até 72 caracteres na primeira linha: `add due date to task`, não `Added due date.`. Se o histórico do repositório já estiver em outro idioma, siga o histórico.
- Corpo só quando o motivo não é óbvio: explique o porquê, não o que o diff já mostra.
- Rodapés no formato `Token: valor`, por exemplo `Refs: #42`.
- Quebra de compatibilidade (contrato de um módulo, schema, variável de ambiente): marque com `!` antes dos dois-pontos e descreva no rodapé `BREAKING CHANGE: <o que quebra e como migrar>`, sempre em maiúsculas.

### Regras de commit

- Commits atômicos: uma mudança lógica por commit. Não misture `refactor` com `feat` nem formatação com lógica.
- Teste e implementação do mesmo comportamento vão no mesmo commit, para todo commit ficar verde. Não faça commit com teste falhando.
- Rode `npm run lint` e `npm run test` antes de cada commit. Nunca use `--no-verify`.
- Migration, policies e tipos regenerados vão juntos em um commit próprio, antes do código que depende deles.
- Nunca faça commit de `.env`, chaves ou dados reais.
- Não reescreva histórico já enviado (`push --force`, rebase de branch compartilhada) sem o usuário pedir.

### Exemplos

```
feat(tasks): add due date to task

fix(auth): redirect to login when session expires

refactor(tasks): extract task status rules to domain

test(tasks): cover overdue task filter

feat(ui): add date picker to design system

build(deps): add vite-plugin-pwa

feat(supabase)!: rename tasks.owner to tasks.user_id

BREAKING CHANGE: column tasks.owner renamed to user_id; run the new
migration and regenerate database.types.ts.
Refs: #42
```
