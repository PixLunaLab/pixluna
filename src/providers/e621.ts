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

interface E621Post {
  id: number
  created_at: string
  file: {
    url: string
  }
  sample: {
    url: string
  }
  preview: {
    url: string
  }
  tags: {
    general: string[]
    species: string[]
    character: string[]
    copyright: string[]
    artist: string[]
    invalid: unknown[]
    lore: unknown[]
    meta: string[]
  }
  description: string
  rating: string
}

export class E621SourceProvider extends SourceProvider {
  static description = '通过 E621 API 获取图片'
  protected endpoint = 'https://e621.net'
  private keyPairs: { login: string; apiKey: string }[] = []

  setConfig(config: Config): void {
    this.config = config
    if (config.e621?.keyPairs?.length) {
      this.keyPairs = config.e621.keyPairs
    }
  }

  private get keyPair() {
    if (!this.keyPairs.length) return null
    return this.keyPairs[Math.floor(Math.random() * this.keyPairs.length)]
  }

  async getMetaData(
    { context }: { context: Context },
    props: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    try {
      const keyPair = this.keyPair
      const params: Record<string, any> = {
        tags: `${props.tag ? props.tag.replace(/\|/g, ' ') : ''} order:random`,
        limit: 1
      }

      if (props.r18) {
        params.tags += ' -rating:s'
      } else {
        params.tags += ' rating:s'
      }

      const headers: Record<string, string> = {
        'User-Agent': 'PixLuna/1.0'
      }

      if (keyPair) {
        headers.Authorization =
          'Basic ' +
          Buffer.from(`${keyPair.login}:${keyPair.apiKey}`).toString('base64')
      }

      const res = await context.http.get<{ posts: E621Post[] }>(
        `${this.endpoint}/posts.json`,
        {
          params,
          headers,
          proxyAgent: this.config.isProxy ? this.config.proxyHost : undefined
        }
      )

      if (!Array.isArray(res.posts) || res.posts.length === 0) {
        return {
          status: 'error',
          data: new Error('No image data returned')
        }
      }

      const post = res.posts[0]
      const url = this.config.imageProcessing.compress
        ? post.sample.url
        : post.file.url

      const generalImageData: GeneralImageData = {
        id: post.id,
        title: '',
        author: post.tags.artist.join(', '),
        r18: post.rating !== 's',
        tags: [...post.tags.general, ...post.tags.artist],
        extension: post.file.url.split('.').pop(),
        aiType: 0,
        uploadDate: new Date(post.created_at).getTime(),
        urls: {
          original: post.file.url,
          regular: post.sample.url
        }
      }

      logger.debug('成功获取图片元数据', { metadata: generalImageData })

      return {
        status: 'success',
        data: {
          url,
          urls: {
            regular: post.sample.url,
            original: post.file.url
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
      referer: 'https://e621.net'
    }
  }
}
