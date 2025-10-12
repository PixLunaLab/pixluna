import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const wasmJsPath = resolve(__dirname, '../../rslib/lib/wasm.js')
const outputPath = resolve(__dirname, '../src/wasm/bindings.ts')

console.log('正在从 rslib 同步 wasm 绑定代码...')

try {
  let wasmJs = readFileSync(wasmJsPath, 'utf-8')

  wasmJs = wasmJs.replace(
    /const wasmPath = .*?\n.*?const wasmBytes = .*?\n.*?const wasmModule = .*?\n.*?const wasm = .*?\n/s,
    ''
  )

  const header = `// @ts-nocheck
// Sync from rslib
import wasmModule from '../../../rslib/lib/wasm_bg.wasm'

`

  const initCode = `
const wasmModuleBuffer = wasmModule instanceof Uint8Array
  ? wasmModule
  : new Uint8Array(wasmModule)

const wasmInstance = new WebAssembly.Instance(new WebAssembly.Module(wasmModuleBuffer), { __wbindgen_placeholder__: imports })
wasm = wasmInstance.exports
wasm.__wbindgen_start()
`

  wasmJs = wasmJs.replace(
    /let imports = \{\};?\s*imports\['__wbindgen_placeholder__'\] = module\.exports;?/s,
    'const imports: any = {}'
  )

  wasmJs = wasmJs.replace(
    /exports\.(__wbg_\w+)\s*=\s*function/g,
    'imports.$1 = function'
  )
  wasmJs = wasmJs.replace(
    /exports\.(__wbindgen_\w+)\s*=\s*function/g,
    'imports.$1 = function'
  )

  wasmJs = wasmJs.replace(
    /exports\.(\w+)\s*=\s*function\s*\(/g,
    'export function $1('
  )

  wasmJs = wasmJs.replace(/wasm\.__wbindgen_start\(\);?\s*$/, '')

  const finalCode = header + wasmJs + initCode

  writeFileSync(outputPath, finalCode, 'utf-8')

  console.log('✓ 成功同步 wasm 绑定代码到:', outputPath)
} catch (error) {
  console.error('✗ 同步失败:', error.message)
  process.exit(1)
}
