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

interface DanbooruPost {
  id: number
  created_at: string
  file_url: string
  large_file_url: string
  preview_file_url: string
  tag_string: string
  tag_string_artist: string
  source: string
  rating: string
}

export class DanbooruSourceProvider extends SourceProvider {
  static description = '通过 Danbooru API 获取图片'
  protected endpoint = 'https://danbooru.donmai.us'
  private keyPairs: { login: string; apiKey: string }[] = []

  setConfig(config: Config): void {
    this.config = config
    if (config.danbooru?.keyPairs?.length) {
      this.keyPairs = config.danbooru.keyPairs
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
        tags: props.tag ? props.tag.replace(/\|/g, ' ') : '',
        random: true,
        limit: 1,
        ...(keyPair ? { login: keyPair.login, api_key: keyPair.apiKey } : {})
      }

      if (props.r18) {
        params.tags += ' rating:explicit'
      } else {
        params.tags += ' rating:safe'
      }

      const res = await context.http.get<DanbooruPost[]>(
        `${this.endpoint}/posts.json`,
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
        ? post.large_file_url
        : post.file_url

      const generalImageData: GeneralImageData = {
        id: post.id,
        title: '',
        author: post.tag_string_artist.replace(/_/g, ' '),
        r18: post.rating === 'e' || post.rating === 'q',
        tags: post.tag_string.split(' '),
        extension: post.file_url.split('.').pop(),
        aiType: 0,
        uploadDate: new Date(post.created_at).getTime(),
        urls: {
          original: post.file_url,
          regular: post.large_file_url
        }
      }

      logger.debug('成功获取图片元数据', { metadata: generalImageData })

      return {
        status: 'success',
        data: {
          url,
          urls: {
            regular: post.large_file_url,
            original: post.file_url
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
      referer: 'https://danbooru.donmai.us'
    }
  }
}
