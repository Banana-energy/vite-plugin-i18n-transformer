import type { I18nPluginOptions, UploadConfig, } from '@higgins-mmt/core'
import type { Plugin, } from 'vite'
import {
  generate,
  transform,
  upload,
} from '@higgins-mmt/core'
import { createFilter, } from 'vite'

export default (options: I18nPluginOptions,): Plugin => {
  let isBuild = false
  const isOpened = options.open === true
  const {
    transformConfig,
    generateConfig,
    uploadConfig,
  } = options

  return {
    name: 'i18n-transformer',
    configResolved(resolvedConfig,) {
      isBuild = resolvedConfig.command === 'build'
    },
    transform(code, id,) {
      if (!transformConfig || !isOpened) {
        return {
          code,
          map: null,
        }
      }
      const filter = createFilter(transformConfig.include, transformConfig.exclude,)
      if (!filter(id,)) {
        return {
          code,
          map: null,
        }
      }
      const {
        code: newCode,
        map,
      } = transform(
        {
          id,
          code,
        },
        transformConfig,
      )
      return {
        code: newCode,
        map,
      }
    },
    buildEnd() {
      if (!isBuild || !isOpened) {
        return
      }
      generate(generateConfig,)
    },
    writeBundle() {
      if (!isBuild || !uploadConfig || !isOpened) {
        return
      }
      if (!uploadConfig.appType) {
        uploadConfig.appType = 'FE_VUE3'
      }
      upload(uploadConfig as UploadConfig, generateConfig,)
    },
  }
}

export {
  ignoreAutoI18n,
} from '@higgins-mmt/core'
