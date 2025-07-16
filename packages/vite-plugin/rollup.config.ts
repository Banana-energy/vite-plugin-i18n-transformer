import type { RollupOptions, } from 'rollup'
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
    external: [
      '@higgins-mmt/core',
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
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
