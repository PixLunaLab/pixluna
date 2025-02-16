import dts from 'rollup-plugin-dts';
import multi from '@rollup/plugin-multi-entry'
import del from 'rollup-plugin-delete';

export default {
  input: './lib/**/*.ts',
  output: [{
    file: './lib/index.d.ts',
    format: 'es'
  }],
  plugins: [
    multi(),
    dts(),
    del({
      targets: ['./lib/**/*.d.ts', './lib/**/'],
      hook: 'buildEnd',
      exclude: './lib/index.d.ts'
    })
  ]
};