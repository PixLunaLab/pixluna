import type { Context } from 'koishi'
import type { Config } from '../config'
import {
  type CommonSourceRequest,
  type GeneralImageData,
  type ImageMetaData,
  type ImageSourceMeta,
  SourceProvider,
  type SourceResponse
} from '../utils/type'
import { logger } from '../index'
import { createHash } from 'node:crypto'

interface KonachanPost {
  id: number
  created_at: string
  file_url: string
  sample_url: string
  preview_url: string
  tags: string
  author: string
  source: string
  rating: string
}

export class KonachanSourceProvider extends SourceProvider {
  static description = '通过 Konachan API 获取图片'
  protected endpoint = 'https://konachan.com'
  private keyPairs: { login: string; password: string }[] = []

  private hashPassword(password: string): string {
    const salted = `So-I-Heard-You-Like-Mupkids-?--${password}--`
    const hash = createHash('sha1')
    hash.update(salted)
    return hash.digest('hex')
  }

  setConfig(config: Config): void {
    this.config = config
    if (config.konachan?.keyPairs?.length) {
      this.keyPairs = config.konachan.keyPairs
    }
  }

  private get keyPair() {
    if (!this.keyPairs.length) return null
    const key = this.keyPairs[Math.floor(Math.random() * this.keyPairs.length)]
    return {
      login: key.login,
      password_hash: this.hashPassword(key.password)
    }
  }

  async getMetaData(
    { context }: { context: Context },
    props: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    try {
      const keyPair = this.keyPair
      const params: Record<string, any> = {
        tags: `order:random ${props.tag?.replace(/\|/g, ' ') || ''}`.trim(),
        limit: 1,
        api_version: 2,
        ...(keyPair && {
          login: keyPair.login,
          password_hash: keyPair.password_hash,
          auth: true
        })
      }

      if (props.r18) {
        params.tags =
          `${params.tags} rating:questionable rating:explicit`.trim()
      } else {
        params.tags = `${params.tags} rating:safe`.trim()
      }

      logger.debug('请求参数', params)

      const res = await context.http.get<KonachanPost[]>(
        `${this.endpoint}/post.json`,
        {
          params,
          proxyAgent: this.config.isProxy ? this.config.proxyHost : undefined
        }
      )

      if (!Array.isArray(res) || res.length === 0) {
        return {
          status: 'error',
          data: new Error('No image data returned')
        }
      }

      const post = res[0]
      const url = this.config.imageProcessing.compress
        ? post.sample_url
        : post.file_url

      const generalImageData: GeneralImageData = {
        id: post.id,
        title: '',
        author: post.author.replace(/_/g, ' '),
        r18: post.rating === 'e' || post.rating === 'q',
        tags: post.tags.split(' '),
        extension: post.file_url.split('.').pop(),
        aiType: 0,
        uploadDate: new Date(post.created_at).getTime(),
        urls: {
          original: post.file_url,
          regular: post.sample_url
        }
      }

      logger.debug('成功获取图片元数据', { metadata: generalImageData })

      return {
        status: 'success',
        data: {
          url,
          urls: {
            regular: post.sample_url,
            original: post.file_url
          },
          raw: generalImageData
        }
      }
    } catch (error) {
      logger.error('Konachan请求失败', error)
      return {
        status: 'error',
        data: error
      }
    }
  }

  getMeta(): ImageSourceMeta {
    return {
      referer: 'https://konachan.com'
    }
  }
}
