import type { GenerateConfig, TransformConfig, UploadConfig, } from '@higgins-mmt/core'

export {
  generate,
} from './generator'

export {
  type GenerateConfig,
  type Messages,
} from './generator/types'

export {
  ignoreAutoI18n,
} from './shared/utils'

export {
  transform,
} from './transformer'

export {
  type GenerateKey,
  type TransformConfig,
} from './transformer/types'

export {
  upload,
} from './uploader'

export {
  type LangItem,
  type UploadConfig,
  type UploadParams,
  type UploadResponse,
  type UploadStrategy,
} from './uploader/types'

type UploadOptions = Omit<UploadConfig, 'appType'> & {
  appType?: 'FE_VUE2' | 'FE_VUE3'
}

export interface I18nPluginOptions {
  transformConfig?: TransformConfig
  uploadConfig: UploadOptions
  generateConfig: GenerateConfig
  open?: boolean
}
