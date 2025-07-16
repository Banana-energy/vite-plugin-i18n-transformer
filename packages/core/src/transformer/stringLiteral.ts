/**
 * 字符串字面量转换模块
 * 负责处理代码中的普通字符串字面量到i18n调用的转换
 * 支持多种AST节点类型的转换，包括：
 * - 函数调用参数
 * - 数组元素
 * - 对象属性
 * - 二元表达式
 * - 条件表达式等
 */

import type { NodePath, } from '@babel/traverse'
import type {
  ArrayExpression,
  AssignmentPattern,
  BinaryExpression,
  CallExpression,
  ConditionalExpression,
  Expression,
  LogicalExpression,
  NewExpression,
  Node,
  ObjectProperty,
  ReturnStatement,
  StringLiteral,
  VariableDeclarator,
} from '@babel/types'
import type { StringLiteralTransformOptions, } from './types'
import {
  binaryExpression,
  callExpression,
  identifier,
  stringLiteral,
} from '@babel/types'
import { getMessages, setMessage, } from '../generator'
import { getLeadingSpaceEnd, getTrailingSpaceStart, } from './utils'

/**
 * 从字符串中提取需要本地化的文本
 * 处理多行字符串，保留原始的缩进格式
 * @param val 原始字符串
 * @returns 提取出的需要本地化的文本数组
 */
export function extractLocalizedStrings(val: string,) {
  return val.split('\n',).map((str,) => {
    const leadingSpaceIndex = getLeadingSpaceEnd(str,)
    const trailingSpaceIndex = getTrailingSpaceStart(str,)
    return str.substring(leadingSpaceIndex, trailingSpaceIndex,)
  },)
}

/**
 * AST节点定位器映射表
 * 为不同类型的AST节点提供定位和替换策略
 * 每个定位器负责：
 * 1. 定位字符串在父节点中的具体位置
 * 2. 返回替换所需的位置信息
 * 3. 处理特定场景下的边界情况
 */
const locators: Record<string, NodeLocator> = {
  /**
   * 处理new表达式中的字符串参数
   * 例如: new Error("错误信息")
   * 定位策略：
   * 1. 在构造函数参数列表中查找目标字符串
   * 2. 返回参数的索引位置用于替换
   */
  NewExpression: (path, originValue,) => {
    const parent = path.parent as CallExpression | NewExpression
    const index = parent.arguments.findIndex(
      item => item.type === 'StringLiteral' && item.value === originValue,
    )
    return index !== -1 ?
      {
        parent,
        key: 'arguments',
        index,
      } :
      null
  },

  /**
   * 处理函数调用中的字符串参数
   * 例如: console.log("日志信息"), alert("提示")
   * 定位策略：
   * 1. 在函数参数列表中查找目标字符串
   * 2. 返回参数的索引位置用于替换
   */
  CallExpression: (path, originValue,) => {
    const parent = path.parent as CallExpression | NewExpression
    const index = parent.arguments.findIndex(
      item => item.type === 'StringLiteral' && item.value === originValue,
    )
    return index !== -1 ?
      {
        parent,
        key: 'arguments',
        index,
      } :
      null
  },

  /**
   * 处理数组字面量中的字符串元素
   * 例如: ["选项1", "选项2"]
   * 定位策略：
   * 1. 在数组元素中查找目标字符串
   * 2. 返回元素的索引位置用于替换
   * 注意：需要处理可能的空元素(holes)
   */
  ArrayExpression: (path, originValue,) => {
    const parent = path.parent as ArrayExpression
    const index = parent.elements.findIndex(
      item => item?.type === 'StringLiteral' && item?.value === originValue,
    )
    return index !== -1 ?
      {
        parent,
        key: 'elements',
        index,
      } :
      null
  },

  /**
   * 处理变量声明中的字符串初始值
   * 例如: const message = "欢迎使用"
   * 定位策略：
   * 1. 直接返回初始化表达式的位置
   * 2. 不需要索引，因为init是单一值
   */
  VariableDeclarator: (path,) => {
    const parent = path.parent as VariableDeclarator
    return {
      parent,
      key: 'init',
    }
  },

  /**
   * 处理二元表达式中的字符串操作数
   * 例如: "前缀" + variable, variable + "后缀"
   * 定位策略：
   * 1. 检查左右操作数，确定字符串的位置
   * 2. 返回对应的操作数位置（left或right）
   */
  BinaryExpression: (path, originValue,) => {
    const parent = path.parent as BinaryExpression
    const key = parent.left.type === 'StringLiteral' && parent.left.value === originValue ?
      'left' :
      'right'
    return {
      parent,
      key,
    }
  },

  /**
   * 处理对象属性中的字符串值
   * 例如: { message: "提示信息" }
   * 定位策略：
   * 1. 直接返回属性值的位置
   * 2. 不需要索引，因为value是单一值
   */
  ObjectProperty: (path,) => {
    const parent = path.parent as ObjectProperty
    return {
      parent,
      key: 'value',
    }
  },

  /**
   * 处理条件表达式中的字符串
   * 例如: condition ? "是" : "否"
   * 定位策略：
   * 1. 检查条件、真值和假值三个位置
   * 2. 返回匹配的位置（test、consequent或alternate）
   */
  ConditionalExpression: (path, originValue,) => {
    const parent = path.parent as ConditionalExpression
    let key: string | null = null
    if (parent.test.type === 'StringLiteral' && parent.test.value === originValue) {
      key = 'test'
    } else if (parent.consequent.type === 'StringLiteral' && parent.consequent.value === originValue) {
      key = 'consequent'
    } else if (parent.alternate.type === 'StringLiteral' && parent.alternate.value === originValue) {
      key = 'alternate'
    }
    return key ?
      {
        parent,
        key,
      } :
      null
  },

  /**
   * 处理逻辑表达式中的字符串操作数
   * 例如: "默认值" || variable, variable && "提示"
   * 定位策略：
   * 1. 检查左右操作数，确定字符串的位置
   * 2. 返回对应的操作数位置（left或right）
   */
  LogicalExpression: (path, originValue,) => {
    const parent = path.parent as LogicalExpression
    const key = parent.left.type === 'StringLiteral' && parent.left.value === originValue ?
      'left' :
      'right'
    return {
      parent,
      key,
    }
  },

  /**
   * 处理return语句中的字符串
   * 例如: return "操作成功"
   * 定位策略：
   * 1. 直接返回返回值的位置
   * 2. 不需要索引，因为argument是单一值
   */
  ReturnStatement: (path,) => {
    const parent = path.parent as ReturnStatement
    return {
      parent,
      key: 'argument',
    }
  },

  /**
   * 处理参数默认值中的字符串
   * 例如: function fn(param = "默认值")
   * 定位策略：
   * 1. 检查默认值是否为目标字符串
   * 2. 返回默认值的位置
   */
  AssignmentPattern: (path, originValue,) => {
    const parent = path.parent as AssignmentPattern
    return parent.right.type === 'StringLiteral' && parent.right.value === originValue ?
      {
        parent,
        key: 'right',
      } :
      null
  },
}

/**
 * 转换字符串字面量为i18n调用表达式
 */
export function transformStringLiteral({
  path,
  generateKey,
  i18nCallee,
}: StringLiteralTransformOptions,): void {
  if (!path || !path.node) {
    return
  }

  const str = path.node.value
  if (!str) {
    return
  }

  const parentType = path.parent?.type
  if (!parentType) {
    return
  }

  // 获取对应的定位器
  const locator = locators[parentType]
  if (!locator) {
    return
  }

  // 定位节点位置
  const location = locator(path, str,)
  if (!location) {
    return
  }

  // 处理前后空格
  const leadingSpaceEnd = getLeadingSpaceEnd(str,)
  const trailingSpaceStart = getTrailingSpaceStart(str,)

  // 如果字符串两端有空格，需要特殊处理
  if (leadingSpaceEnd > 0 || trailingSpaceStart < str.length) {
    const parts: Expression[] = []

    // 添加前导空格
    if (leadingSpaceEnd > 0) {
      parts.push(stringLiteral(str.slice(0, leadingSpaceEnd,),),)
    }

    // 添加本地化的主体内容
    const mainText = str.slice(leadingSpaceEnd, trailingSpaceStart,)
    if (mainText) {
      const key = generateKey(mainText, path.node, getMessages(),)
      setMessage(key, mainText,)
      parts.push(
        callExpression(identifier(i18nCallee,), [
          stringLiteral(key || `key_${mainText}`,),
        ],),
      )
    }

    // 添加尾随空格
    if (trailingSpaceStart < str.length) {
      parts.push(stringLiteral(str.slice(trailingSpaceStart,),),)
    }

    // 如果有多个部分，使用加号连接
    const finalNode = parts.length > 1 ?
      parts.reduce((acc, curr,) => binaryExpression('+', acc, curr,),) :
      parts[0]

    replaceNode(location, finalNode,)
  } else {
    // 没有空格的情况，直接替换为i18n调用
    const key = generateKey(str, path.node, getMessages(),)
    setMessage(key, str,)
    const i18nCall = callExpression(identifier(i18nCallee,), [
      stringLiteral(key || `key_${str}`,),
    ],)
    replaceNode(location, i18nCall,)
  }
}

function replaceNode(location: NodeLocation, newNode: Expression,): void {
  const {
    parent,
    key,
    index,
  } = location

  if (typeof index === 'number') {
    switch (parent.type) {
      case 'CallExpression':
      case 'NewExpression':
        parent.arguments[index] = newNode
        break
      case 'ArrayExpression':
        parent.elements[index] = newNode
        break
    }
  } else {
    switch (parent.type) {
      case 'VariableDeclarator':
        parent.init = newNode
        break
      case 'BinaryExpression':
      case 'LogicalExpression':
        if (key === 'left')
          parent.left = newNode
        if (key === 'right')
          parent.right = newNode
        break
      case 'ObjectProperty':
        parent.value = newNode
        break
      case 'ConditionalExpression':
        if (key === 'test')
          parent.test = newNode
        if (key === 'consequent')
          parent.consequent = newNode
        if (key === 'alternate')
          parent.alternate = newNode
        break
      case 'ReturnStatement':
        parent.argument = newNode
        break
      case 'AssignmentPattern':
        parent.right = newNode
        break
    }
  }
}

interface NodeLocation {
  parent: Node
  key: string
  index?: number
}

type NodeLocator = (path: NodePath<StringLiteral>, originValue: string) => NodeLocation | null
