import { defineConfig } from 'rolldown'
import pkg from './package.json' with { type: 'json' }
import { dts } from 'rolldown-plugin-dts'
import { readFileSync } from 'node:fs'

const external = new RegExp(
  `^(node:|${[...Object.getOwnPropertyNames(pkg.devDependencies ? pkg.devDependencies : []), ...Object.getOwnPropertyNames(pkg.dependencies ? pkg.dependencies : [])].join('|')})`
)

const config = {
  input: './src/index.ts'
}

function inlineWasm() {
  return {
    name: 'inline-wasm',
    load(id) {
      if (id.endsWith('.wasm')) {
        const wasmBuffer = readFileSync(id)
        const base64 = wasmBuffer.toString('base64')
        return `export default Buffer.from('${base64}', 'base64')`
      }
    }
  }
}

export default defineConfig([
  {
    ...config,
    output: [{ file: 'lib/index.mjs', format: 'es', minify: true }],
    external: external,
    plugins: [inlineWasm()]
  },
  {
    ...config,
    output: [{ file: 'lib/index.cjs', format: 'cjs', minify: true }],
    external: external,
    plugins: [inlineWasm()]
  },
  {
    ...config,
    output: [{ dir: 'lib', format: 'es' }],
    plugins: [dts({ emitDtsOnly: true })],
    external: external
  }
])
