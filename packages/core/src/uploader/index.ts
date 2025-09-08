import type { PluginItem, } from '@babel/core'
import type { GenerateConfig, Messages, } from '@higgins-mmt/core'
import type {
  LangItem,
  UploadConfig,
  UploadParams,
  UploadResponse,
} from './types'
import { existsSync, readFileSync, } from 'fs'
import { resolve, } from 'path'
import babel from '@babel/core'
import { to, } from 'await-to-js'
import axios from 'axios'
import { log, } from './utils'

function transformWithBabel(content: string, filePath: string, presets: PluginItem[] = [], plugins: PluginItem[] = [],) {
  const { code, } = babel.transformSync(content, {
    filename: filePath,
    presets,
    plugins,
  },) || {}
  return code || ''
}

export function readFileContent(filePath: string,): Messages {
  const ext = filePath.split('.',).pop()

  const content = readFileSync(filePath, 'utf-8',)

  if (ext === 'json') {
    return JSON.parse(content,)
  }
  if (ext === 'js' || ext === 'ts') {
    const isTypeScript = ext === 'ts'

    // Use Babel to transform the JS/TS content into CommonJS format
    const transformedCode = transformWithBabel(
      content,
      filePath,
      [
        [ '@babel/preset-env', {
          targets: {
            node: 'current',
          },
        }, ],
        isTypeScript ? '@babel/preset-typescript' : '',
      ].filter(Boolean,),
      [
        '@babel/plugin-transform-modules-commonjs',
      ],
    )

    return evaluateModule(transformedCode,)
  } else {
    throw new Error(`Unsupported file format: ${filePath}`,)
  }
}

function evaluateModule(code: string,) {
  const moduleExports = {}
  const module = {
    exports: moduleExports,
  }
  const evalFunc = new Function('module', 'exports', code || '',)
  evalFunc(module, moduleExports,)
  return (module.exports as { default: Messages }).default || module.exports
}

export function loadLocaleConfig(config: UploadConfig,) {
  const dir = config.localePath!

  if (!existsSync(dir,)) {
    throw new Error(`Locale path does not exist: ${dir}`,)
  }
  const localeData: Record<string, Messages> = {}
  for (const [ locale, filePaths, ] of Object.entries(config.localeConfig!,)) {
    if (!filePaths || filePaths.length === 0) {
      throw new Error(`No file paths specified for locale: ${locale}`,)
    }

    for (const filePath of filePaths) {
      const absolutePath = resolve(dir, filePath,)

      if (!existsSync(absolutePath,)) {
        throw new Error(`File not found: ${absolutePath}`,)
      }

      const fileContent = readFileContent(absolutePath,)
      localeData[locale] = {
        ...localeData[locale],
        ...fileContent,
      }
    }
  }

  return localeData
}

export function loadOutputFiles(output: GenerateConfig,): LangItem[] {
  const outputPath = output.path

  if (!existsSync(outputPath,)) {
    throw new Error(`Output path does not exist: ${outputPath}`,)
  }

  const langList = [ output.filename, ...(output.langList || []), ]

  return langList.map((filename,) => {
    const file = resolve(outputPath, filename,)
    const json = readFileContent(file,)
    const locale = filename.replace(/\.json$/, '',)
    return {
      locale,
      json,
    }
  },)
}

export async function upload(uploadConfig: UploadConfig, generateConfig: GenerateConfig,) {
  const {
    url,
    appType,
    app,
    localePath,
    localeConfig,
    uploadStrategy,
  } = uploadConfig
  if (!url) {
    throw new Error('请配置上传接口url',)
  }
  const uploadParams: UploadParams = {
    app,
    appType,
    codeSource: 'FE_SCAN_UPLOAD',
    strategy: uploadStrategy,
    langList: [],
  }
  if (localePath && localeConfig) {
    // 有静态翻译资源
    const localeConfigMap = loadLocaleConfig(uploadConfig,)
    uploadParams.langList = Object.entries(localeConfigMap,).map(([ locale, json, ],) => ({
      locale,
      json,
    }),)
    const [ error, result, ] = await to(axios.post<UploadResponse>(url, uploadParams,),)
    if (result?.data.success && error === null) {
      log.info(`Upload successful.`,)
    } else {
      log.error(`Upload failed, static files will be used instead.`,)
    }
  }

  const [ error, result, ] = await to(axios.post<UploadResponse>(url, {
    ...uploadParams,
    codeSource: 'FE_GENERATE_UPLOAD',
    langList: loadOutputFiles(generateConfig,),
  },),)
  if (result?.data.success && error === null) {
    log.info(`Upload successful.`,)
  } else {
    log.error(`Upload failed, automatic files will be used instead.`,)
  }
}
