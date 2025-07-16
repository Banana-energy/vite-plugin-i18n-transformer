import type { RollupOptions, } from 'rollup'
import { babel, } from '@rollup/plugin-babel'
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'

const configs: RollupOptions[] = [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.mjs',
        format: 'es',
        exports: 'named',
      },
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        exports: 'named',
      },
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
      },),
      babel({
        babelHelpers: 'bundled',
        extensions: [ '.ts', ],
        plugins: [
          '@babel/plugin-transform-nullish-coalescing-operator',
          '@babel/plugin-transform-optional-chaining',
        ],
        targets: {
          node: '14',
        },
        presets: [
          '@babel/preset-env',
          '@babel/preset-typescript',
        ],
      },),
    ],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    plugins: [ dts(), ],
  },
]

export default configs
