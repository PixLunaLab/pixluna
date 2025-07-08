import type { Context } from 'koishi'
import { createHash } from 'node:crypto'
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

interface LolibooruPost {
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

function hashPassword(password: string) {
  const salted = `--${password}--`
  const hash = createHash('sha1')
  hash.update(salted)
  return hash.digest('hex')
}

export class LolibooruSourceProvider extends SourceProvider {
  static description = '通过 Lolibooru API 获取图片'
  protected endpoint = 'https://lolibooru.moe'
  private keyPairs: { login: string; password: string }[] = []

  setConfig(config: Config): void {
    this.config = config
    if (config.lolibooru?.keyPairs?.length) {
      this.keyPairs = config.lolibooru.keyPairs
    }
  }

  private get keyPair() {
    if (!this.keyPairs.length) return null
    const key = this.keyPairs[Math.floor(Math.random() * this.keyPairs.length)]
    return {
      login: key.login,
      password_hash: hashPassword(key.password)
    }
  }

  async getMetaData(
    { context }: { context: Context },
    props: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    try {
      const keyPair = this.keyPair
      const params: Record<string, string> = {
        tags: `${props.tag ? props.tag.replace(/\|/g, ' ') : ''} order:random`,
        limit: '1'
      }

      if (props.r18) {
        params.tags += ' -rating:s'
      } else {
        params.tags += ' rating:s'
      }

      if (keyPair) {
        params.login = keyPair.login
        params.password_hash = keyPair.password_hash
      }

      const res = await context.http.get<LolibooruPost[]>(
        `${this.endpoint}/post/index.json`,
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
        title: post.source || `Lolibooru - ${post.id}`,
        author: post.author.replace(/_/g, ' '),
        r18: ['e', 'q'].includes(post.rating),
        tags: post.tags.split(' '),
        extension: post.file_url.split('.').pop(),
        aiType: 0,
        uploadDate: new Date(post.created_at).getTime(),
        urls: {
          original: encodeURI(post.file_url),
          regular: encodeURI(post.sample_url)
        }
      }

      logger.debug('成功获取图片元数据', { metadata: generalImageData })

      return {
        status: 'success',
        data: {
          url: encodeURI(url),
          urls: {
            regular: encodeURI(post.sample_url),
            original: encodeURI(post.file_url)
          },
          raw: generalImageData
        }
      }
    } catch (error) {
      return {
        status: 'error',
        data: error
      }
    }
  }

  getMeta(): ImageSourceMeta {
    return {
      referer: 'https://lolibooru.moe'
    }
  }
}
