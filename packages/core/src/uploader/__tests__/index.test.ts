import type { UploadConfig, } from '../types'
import { Buffer, } from 'buffer'
import { existsSync, readFileSync, } from 'fs'
import { resolve, } from 'path'
import axios from 'axios'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  loadLocaleConfig,
  loadOutputFiles,
  readFileContent,
  upload,
} from '../index'
import { log, } from '../utils'

// Mock dependencies
vi.mock('axios',)
vi.mock('fs',)
vi.mock('../utils',)

const mockedAxios = axios as unknown as { post: ReturnType<typeof vi.fn> }
const mockedReadFileSync = readFileSync as unknown as ReturnType<typeof vi.fn>
const mockedExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>
const mockedLog = log as unknown as
  {
    info: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
  }

describe('uploader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  },)

  describe('readFileContent', () => {
    const fixturesPath = resolve(__dirname, '__fixtures__',)

    beforeEach(() => {
      vi.mocked(mockedExistsSync,).mockReturnValue(true,)
    },)

    it('should read and parse JSON file correctly', () => {
      const jsonContent = {
        hello: 'Hello',
        world: 'World',
        test: {
          nested: 'Nested Value',
        },
      }
      vi.mocked(mockedReadFileSync,).mockReturnValueOnce(JSON.stringify(jsonContent,),)

      const result = readFileContent(resolve(fixturesPath, 'test.json',),)
      expect(result,).toEqual(jsonContent,)
    },)

    it('should read and transform JavaScript file correctly', () => {
      const jsContent = `
        module.exports = {
          hello: 'Hello',
          world: 'World',
          test: { nested: 'Nested Value' }
        }
      `
      vi.mocked(mockedReadFileSync,).mockReturnValueOnce(jsContent,)

      const result = readFileContent(resolve(fixturesPath, 'test.js',),)
      expect(result,).toEqual({
        hello: 'Hello',
        world: 'World',
        test: {
          nested: 'Nested Value',
        },
      },)
    },)

    it('should read and transform TypeScript file correctly', () => {
      const tsContent = `
        export default {
          hello: 'Hello',
          world: 'World',
          test: { nested: 'Nested Value' }
        }
      `
      vi.mocked(mockedReadFileSync,).mockReturnValueOnce(tsContent,)

      const result = readFileContent(resolve(fixturesPath, 'test.ts',),)
      expect(result,).toEqual({
        hello: 'Hello',
        world: 'World',
        test: {
          nested: 'Nested Value',
        },
      },)
    },)

    it('should throw error for unsupported file format', () => {
      expect(() => {
        readFileContent(resolve(fixturesPath, 'invalid.txt',),)
      },).toThrow('Unsupported file format',)
    },)

    it('should throw error when file does not exist', () => {
      vi.mocked(mockedExistsSync,).mockReturnValueOnce(false,)
      vi.mocked(mockedReadFileSync,).mockImplementationOnce(() => {
        throw new Error('File not found',)
      },)

      expect(() => {
        readFileContent(resolve(fixturesPath, 'nonexistent.json',),)
      },).toThrow('File not found',)
    },)
  },)

  describe('loadLocaleConfig', () => {
    const mockConfig: UploadConfig = {
      app: 'test-app',
      url: 'http://test.com',
      appType: 'FE_VUE3',
      localePath: '/test/path',
      localeConfig: {
        en: [ 'en.json', ],
      },
    }

    beforeEach(() => {
      vi.mocked(mockedExistsSync,).mockReset()
      vi.mocked(mockedReadFileSync,).mockReset()
    },)

    it('should load single locale file correctly', () => {
      const enContent = {
        hello: 'Hello',
        world: 'World',
      }

      // Mock existsSync to return true for both directory and file
      vi.mocked(mockedExistsSync,).mockImplementation((path: string,) => {
        return path === '/test/path' || path.endsWith('en.json',)
      },)

      vi.mocked(mockedReadFileSync,).mockReturnValue(Buffer.from(JSON.stringify(enContent,),),)

      const result = loadLocaleConfig(mockConfig,)
      expect(result,).toEqual({
        en: enContent,
      },)
    },)

    it('should merge multiple locale files correctly', () => {
      const mockConfigWithMultipleFiles = {
        ...mockConfig,
        localeConfig: {
          zh: [ 'zh.json', 'zh-extra.json', ],
        },
      }

      const zhContent1 = {
        hello: 'Hello',
        world: 'World',
      }
      const zhContent2 = {
        test: 'Test',
        world: 'Override',
      }

      // Mock existsSync to return true for both directory and files
      vi.mocked(mockedExistsSync,).mockImplementation((path: string,) => {
        return path === '/test/path' || path.endsWith('zh.json',) || path.endsWith('zh-extra.json',)
      },)

      vi.mocked(mockedReadFileSync,)
        .mockReturnValueOnce(Buffer.from(JSON.stringify(zhContent1,),),)
        .mockReturnValueOnce(Buffer.from(JSON.stringify(zhContent2,),),)

      const result = loadLocaleConfig(mockConfigWithMultipleFiles,)
      expect(result,).toEqual({
        zh: {
          hello: 'Hello',
          world: 'Override',
          test: 'Test',
        },
      },)
    },)

    it('should throw error when locale path does not exist', () => {
      vi.mocked(mockedExistsSync,).mockReturnValue(false,)

      expect(() => loadLocaleConfig(mockConfig,),).toThrow('Locale path does not exist',)
    },)

    it('should throw error when no file paths specified for locale', () => {
      const invalidConfig = {
        ...mockConfig,
        localeConfig: {
          en: [],
        },
      }

      // Mock existsSync to return true for directory
      vi.mocked(mockedExistsSync,).mockImplementation((path: string,) => {
        return path === '/test/path'
      },)

      expect(() => loadLocaleConfig(invalidConfig,),).toThrow('No file paths specified for locale',)
    },)

    it('should throw error when file not found', () => {
      vi.mocked(mockedExistsSync,).mockImplementation((path: string,) => {
        return path === '/test/path'
      },)

      expect(() => loadLocaleConfig(mockConfig,),).toThrow('File not found',)
    },)
  },)

  describe('loadOutputFiles', () => {
    const mockGenerateConfig = {
      path: '/test/output',
      filename: 'en.json',
      langList: [ 'zh.json', 'ja.json', ],
    }

    beforeEach(() => {
      vi.mocked(mockedExistsSync,).mockReturnValue(true,)
      vi.mocked(mockedReadFileSync,).mockReset()
    },)

    it('should load output files correctly', () => {
      const enContent = {
        hello: 'Hello',
        world: 'World',
      }
      const zhContent = {
        hello: '你好',
        world: '世界',
      }
      const jaContent = {
        hello: 'こんにちは',
        world: '世界',
      }

      vi.mocked(mockedReadFileSync,)
        .mockReturnValueOnce(JSON.stringify(enContent,),)
        .mockReturnValueOnce(JSON.stringify(zhContent,),)
        .mockReturnValueOnce(JSON.stringify(jaContent,),)

      const result = loadOutputFiles(mockGenerateConfig,)
      expect(result,).toEqual([
        {
          locale: 'en',
          json: enContent,
        },
        {
          locale: 'zh',
          json: zhContent,
        },
        {
          locale: 'ja',
          json: jaContent,
        },
      ],)
    },)

    it('should throw error when output path does not exist', () => {
      vi.mocked(mockedExistsSync,).mockReturnValue(false,)

      expect(() => loadOutputFiles(mockGenerateConfig,),).toThrow('Output path does not exist',)
    },)

    it('should handle empty langList correctly', () => {
      const configWithoutLangList = {
        ...mockGenerateConfig,
        langList: [],
      }

      const enContent = {
        hello: 'Hello',
        world: 'World',
      }
      vi.mocked(mockedReadFileSync,).mockReturnValue(JSON.stringify(enContent,),)

      const result = loadOutputFiles(configWithoutLangList,)
      expect(result,).toEqual([
        {
          locale: 'en',
          json: enContent,
        },
      ],)
    },)
  },)

  describe('upload', () => {
    const mockUploadConfig: UploadConfig = {
      app: 'test-app',
      url: 'http://test.com',
      appType: 'FE_VUE3',
      localePath: '/test/path',
      localeConfig: {
        en: [ 'en.json', ],
      },
      uploadStrategy: 'INSERT_ONLY',
    }

    const mockGenerateConfig = {
      path: '/test/output',
      filename: 'en.json',
      langList: [],
    }

    const mockSuccessResponse = {
      data: {
        code: 0,
        message: 'success',
        success: true,
      },
    }

    beforeEach(() => {
      vi.mocked(mockedExistsSync,).mockReturnValue(true,)
      vi.mocked(mockedAxios.post,).mockResolvedValue(mockSuccessResponse,)
      vi.mocked(mockedReadFileSync,).mockReset()
    },)

    it('should upload static resources successfully', async () => {
      const enContent = {
        hello: 'Hello',
        world: 'World',
      }
      vi.mocked(mockedReadFileSync,).mockReturnValue(Buffer.from(JSON.stringify(enContent,),),)

      await upload(mockUploadConfig, mockGenerateConfig,)
      expect(vi.mocked(mockedAxios.post,),).toHaveBeenCalledTimes(2,)
      expect(vi.mocked(mockedAxios.post,),).toHaveBeenNthCalledWith(1, 'http://test.com', {
        app: 'test-app',
        appType: 'FE_VUE3',
        codeSource: 'FE_SCAN_UPLOAD',
        strategy: 'INSERT_ONLY',
        langList: [
          {
            locale: 'en',
            json: enContent,
          },
        ],
      },)
      expect(vi.mocked(mockedLog.info,),).toHaveBeenCalledWith('Upload successful.',)
    },)

    it('should upload generated resources successfully', async () => {
      const mockConfigWithLangList = {
        ...mockGenerateConfig,
        langList: [ 'zh.json', ],
      }

      const enContent = {
        hello: 'Hello',
      }
      const zhContent = {
        hello: '你好',
      }

      // Mock existsSync to return true for all paths
      vi.mocked(mockedExistsSync,).mockReturnValue(true,)

      // Mock readFileSync for both output files
      vi.mocked(mockedReadFileSync,)
        .mockReturnValueOnce(Buffer.from(JSON.stringify(enContent,),),) // For generated resource - en.json
        .mockReturnValueOnce(Buffer.from(JSON.stringify(zhContent,),),) // For generated resource - zh.json

      // Create a new config without localePath and localeConfig
      const mockConfigWithoutLocale = {
        ...mockUploadConfig,
        localePath: undefined,
        localeConfig: undefined,
      }

      await upload(mockConfigWithoutLocale, mockConfigWithLangList,)

      // Verify API call
      expect(vi.mocked(mockedAxios.post,),).toHaveBeenCalledTimes(1,)
      expect(vi.mocked(mockedAxios.post,),).toHaveBeenCalledWith(
        'http://test.com',
        {
          app: 'test-app',
          appType: 'FE_VUE3',
          codeSource: 'FE_GENERATE_UPLOAD',
          strategy: 'INSERT_ONLY',
          langList: [
            {
              locale: 'en',
              json: enContent,
            },
            {
              locale: 'zh',
              json: zhContent,
            },
          ],
        },
      )
    },)

    it('should handle upload failure gracefully', async () => {
      const failureResponse = {
        data: {
          code: 1,
          message: 'error',
          success: false,
        },
      }
      vi.mocked(mockedAxios.post,).mockResolvedValue(failureResponse,)
      vi.mocked(mockedExistsSync,).mockReturnValue(true,)
      vi.mocked(mockedReadFileSync,).mockReturnValue(Buffer.from(JSON.stringify({
        hello: 'Hello',
      },),),)

      await upload(mockUploadConfig, mockGenerateConfig,)

      expect(vi.mocked(mockedLog.error,),).toHaveBeenCalledWith('Upload failed, static files will be used instead.',)
    },)

    it('should throw error when url is not provided', async () => {
      const invalidConfig = {
        ...mockUploadConfig,
        url: '',
      }

      await expect(upload(invalidConfig, mockGenerateConfig,),).rejects.toThrow('请配置上传接口url',)
    },)

    it('should handle network errors gracefully', async () => {
      vi.mocked(mockedAxios.post,).mockRejectedValue(new Error('Network error',),)
      vi.mocked(mockedExistsSync,).mockReturnValue(true,)
      vi.mocked(mockedReadFileSync,).mockReturnValue(Buffer.from(JSON.stringify({
        hello: 'Hello',
      },),),)

      await upload(mockUploadConfig, mockGenerateConfig,)

      expect(vi.mocked(mockedLog.error,),).toHaveBeenCalledWith('Upload failed, static files will be used instead.',)
    },)
  },)
},)
