// 转换配置类型
import type { NodePath, } from '@babel/traverse'
import type { StringLiteral, TemplateLiteral, } from '@babel/types'
import type { Messages, } from '@higgins-mmt/core'

/** 生成i18n key的函数类型 */
export type GenerateKey = (value: string, node: NodePath<StringLiteral>['node'] | NodePath<TemplateLiteral>['node'], messages: Messages) => string

/** 转换器主配置接口 */
export interface TransformConfig {
  /** 是否转换 */
  open?: boolean
  /** 要包含的文件glob模式 */
  include?: string[]
  /** 要排除的文件glob模式 */
  exclude?: string[]
  /** i18n函数名，如't'或'i18n' */
  i18nCallee?: string
  /** 匹配需要转换文本的正则，如中文匹配 */
  localePattern?: RegExp
  /** 自定义key生成函数 */
  generateKey?: GenerateKey
  /** i18n库的导入配置 */
  dependency?: {
    /** 包名，如'i18next' */
    path: string
    /** 导入的变量名 */
    name: string
    /** 模块系统类型 */
    module: 'commonjs' | 'esm'
    /** 是否使用解构导入 */
    objectPattern?: boolean
  }
}

/** 字符串转换的选项接口 */
export interface StringLiteralTransformOptions {
  /** AST节点路径 */
  path: NodePath<StringLiteral>
  /** 原文到key的映射 */
  generateKey: GenerateKey
  /** i18n函数名 */
  i18nCallee: string
}

/** 扩展的转换选项，包含原始字符串 */
export interface I18nTransformOptions extends StringLiteralTransformOptions {
  /** 原始字符串内容 */
  str: string
}
