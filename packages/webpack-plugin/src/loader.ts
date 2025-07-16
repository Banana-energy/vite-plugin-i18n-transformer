import type { TransformConfig, } from '@higgins-mmt/core'
import type { LoaderContext, } from 'webpack'
import { transform, } from '@higgins-mmt/core'
import { createFilter, } from '@rollup/pluginutils'
import { getOptions, } from './utils'

export default function i18nTransformerLoader(this: LoaderContext<TransformConfig>, code: string,): string {
  const { resourcePath, } = this
  const options = getOptions(this,) || {}
  const {
    include = [],
    exclude = [],
    open = true,
  } = options || {}
  if (!createFilter(include, exclude,)(resourcePath,) || !open) {
    return code
  }
  const { code: newCode, } = transform({
    id: resourcePath,
    code,
  }, options,)

  return newCode
}
