// Wrapper do `shadcn-vue add` que corrige um bug do CLI (2.9): ele gera
// `import { cn } from "cn"` e instala o pacote npm "cn" em vez de usar o alias
// `utils` do components.json. Uso: npm run ui:add -- dialog dropdown-menu
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Informe os componentes. Ex.: npm run ui:add -- dialog')
  process.exit(1)
}

execSync(`npx --yes shadcn-vue@latest add ${args.join(' ')} --yes`, { stdio: 'inherit' })

const config = JSON.parse(readFileSync('components.json', 'utf8'))
const utils = config.aliases.utils
const uiDir = config.aliases.ui.replace(/^@\//, 'src/')

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (/\.(vue|ts)$/.test(name)) {
      const src = readFileSync(path, 'utf8')
      const fixed = src.replace(/from ["']cn["']/g, `from '${utils}'`)
      if (fixed !== src) writeFileSync(path, fixed)
    }
  }
}
walk(uiDir)

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
if (pkg.dependencies?.cn) execSync('npm uninstall cn', { stdio: 'inherit' })
console.log('ui:add: imports do cn corrigidos.')
