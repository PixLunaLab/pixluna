import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'

export default defineConfig([
  {
    input: 'src/index.ts',
    output: {
      file: 'lib/index.mjs',
      format: 'esm',
      minify: true,
      inlineDynamicImports: true
    },
    platform: 'node',
    external: [/node_modules/]
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'lib/index.cjs',
      format: 'cjs',
      minify: true,
      inlineDynamicImports: true
    },
    platform: 'node',
    external: [/node_modules/]
  },
  {
    input: 'src/index.ts',
    output: {
      dir: 'lib',
      format: 'esm',
      inlineDynamicImports: true
    },
    plugins: [dts({ emitDtsOnly: true })],
    platform: 'node',
    external: [/node_modules/]
  }
])
