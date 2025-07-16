import type { I18nPluginOptions, UploadConfig, } from '@higgins-mmt/core'
import type { Compiler, } from 'webpack'
import process from 'process'
import {
  generate,
  upload,
} from '@higgins-mmt/core'
import i18nTransformerLoader from './loader'

export class I18nTransformPlugin {
  options: I18nPluginOptions

  constructor(options: I18nPluginOptions,) {
    this.options = options
  }

  apply(compiler: Compiler,) {
    const isWatchMode =
      process.argv.includes('--watch',) ||
      process.argv.includes('-w',) ||
      process.argv.includes('serve',)

    const {
      open = true,
      generateConfig,
      uploadConfig,
    } = this.options

    compiler.hooks.afterCompile.tap('I18nTransformerPlugin', () => {
      if (isWatchMode || !open) {
        return
      }
      generate(generateConfig,)
    },)

    compiler.hooks.afterEmit.tap('I18nTransformerPlugin', () => {
      if (isWatchMode || !this.options.uploadConfig || !open) {
        return
      }
      if (!uploadConfig.appType) {
        uploadConfig.appType = 'FE_VUE2'
      }
      upload(uploadConfig as UploadConfig, generateConfig,)
    },)
  }
}

export default i18nTransformerLoader

export {
  ignoreAutoI18n,
} from '@higgins-mmt/core'
