import esbuild from 'esbuild'

const baseOptions = {
    entryPoints: ['./src/index.ts'],
    bundle: true,
    minify: true,
    platform: 'node',
    packages: 'external',
}

const cjsOptions = {
    ...baseOptions,
    outfile: 'lib/index.cjs',
    format: 'cjs',
}

const esmOptions = {
    ...baseOptions,
    outfile: 'lib/index.mjs',
    format: 'esm',
}

await Promise.all([
    esbuild.build(cjsOptions),
    esbuild.build(esmOptions),
])