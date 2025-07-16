/**
 * @module generator
 * @description
 * 国际化文件生成模块，负责管理和生成国际化资源文件。
 *
 * 主要功能：
 * 1. 收集和管理需要国际化的文本
 * 2. 生成基准语言文件
 * 3. 生成多语言翻译文件
 * 4. 保持已有翻译不被覆盖
 *
 * @example
 * ```typescript
 * import { setMessage, generate } from './generator'
 *
 * // 收集需要国际化的文本
 * setMessage('hello', '你好')
 * setMessage('welcome', '欢迎')
 *
 * // 生成国际化文件
 * generate({
 *   filename: 'zh-CN.json',
 *   path: './locales',
 *   langList: ['en-US', 'ja-JP']
 * })
 * ```
 */

import type { GenerateConfig, Messages, } from './types'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { resolve, } from 'path'

/**
 * 全局消息存储对象，用于临时存储所有收集到的国际化文本
 * @private
 */
const translationMessages: Messages = {}

/**
 * 设置国际化消息
 * @param {string} key - 消息的唯一标识符
 * @param {string} value - 消息的原文内容
 */
export function setMessage(key: string, value: string,) {
  translationMessages[key] = value
}

/**
 * 获取所有已收集的国际化消息
 * @returns {Messages} 消息集合
 */
export function getMessages(): Messages {
  return translationMessages
}

/**
 * 生成国际化文件
 * @param {GenerateConfig} config - 生成配置
 * @throws {Error} 当文件操作失败时抛出错误
 *
 * @description
 * 1. 如果目标目录不存在，会自动创建
 * 2. 生成基准语言文件，包含所有原始文本
 * 3. 为每个目标语言生成对应的翻译文件
 * 4. 如果目标语言文件已存在，会保留已有的翻译
 */
export function generate(config: GenerateConfig,) {
  if (!config.filename || !config.path) {
    throw new Error('Invalid configuration: filename and path are required',)
  }

  try {
    const dir = config.path
    // 检查目录是否可写
    try {
      if (!existsSync(dir,)) {
        mkdirSync(dir, {
          recursive: true,
        },)
      }
      // 测试目录是否可写
      const testFile = resolve(dir, '.write-test',)
      writeFileSync(testFile, '',)
      rmSync(testFile,)
    } catch {
      throw new Error(`Directory is not writable: ${dir}`,)
    }

    const messages = getMessages()
    const content: Messages = {}
    Object.keys(messages,).forEach((key,) => {
      content[key] = messages[key] || ''
    },)

    const baseFilePath = resolve(dir, config.filename,)
    try {
      writeFileSync(baseFilePath, JSON.stringify(content, null, 2,),)
    } catch {
      throw new Error(`Failed to write base file: ${config.filename}`,)
    }

    if (config.langList) {
      config.langList.forEach((lang,) => {
        const langFile = resolve(dir, lang,)
        let existingContent: Messages = {}

        if (existsSync(langFile,)) {
          try {
            const fileContent = readFileSync(langFile, 'utf-8',)
            existingContent = JSON.parse(fileContent,)
          } catch {
            throw new Error(`Failed to parse existing translation file: ${lang}`,)
          }
        }

        const langContent: Messages = {}
        Object.keys(content,).forEach((key,) => {
          // 只保留当前存在的键的翻译
          langContent[key] = existingContent[key] || content[key]
        },)

        try {
          writeFileSync(langFile, JSON.stringify(langContent, null, 2,),)
        } catch {
          throw new Error(`Failed to write translation file: ${lang}`,)
        }
      },)
    }
  } catch (error: any) {
    throw new Error(`Failed to generate i18n files: ${error.message}`,)
  }
}
