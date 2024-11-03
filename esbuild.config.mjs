import esbuild from 'esbuild'

const options = {
    entryPoints: ['./src/index.ts'],
    bundle: true,
    outdir: 'lib',
    minify: true,
    platform: 'node',
    packages: 'external',
}

await esbuild.build(options)