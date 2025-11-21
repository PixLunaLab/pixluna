import type { Context } from 'koishi'
import type { Config } from '../config'
import type {
  CommonSourceRequest,
  GeneralImageData,
  ImageMetaData,
  ImageSourceMeta,
  SourceResponse
} from '../utils/type'
import { SourceProvider } from '../utils/type'
import { logger } from '../index'
import { registerProvider } from '../utils/providerRegistry'

interface GelbooruResponse {
  post?: {
    id: number
    file_url: string
    sample_url: string
    preview_url: string
    tags: string
    source: string
    owner: string
    rating: string
    created_at: string
  }[]
}

export class GelbooruSourceProvider extends SourceProvider {
  static description = '通过 Gelbooru API 获取图片'
  protected endpoint = 'https://gelbooru.com/index.php'

  private get keyPair() {
    const pairs = this.config.gelbooru?.keyPairs || []
    return pairs.length ? pairs[Math.floor(Math.random() * pairs.length)] : null
  }

  async getMetaData(
    { context }: { context: Context },
    props: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    let tagString = ''
    if (props.tag) {
      tagString = props.tag
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .join(' ')
    }

    const params = new URLSearchParams({
      page: 'dapi',
      s: 'post',
      q: 'index',
      json: '1',
      limit: '1',
      tags: `${tagString} sort:random${this.config.isR18 && props.r18 ? '' : ' rating:safe'}`
    })

    const keyPair = this.keyPair
    if (keyPair) {
      params.append('api_key', keyPair.apiKey)
    }

    const url = `${this.endpoint}?${params.toString()}`

    try {
      const res = await context.http.get<GelbooruResponse>(url, {
        proxyAgent: this.config.isProxy ? this.config.proxyHost : undefined
      })

      if (!res.post?.length) {
        return {
          status: 'error',
          data: new Error('No image data returned')
        }
      }

      const post = res.post[0]
      const generalImageData: GeneralImageData = {
        id: post.id,
        title: post.source || `Gelbooru - ${post.id}`,
        author: post.owner.replace(/_/g, ' '),
        r18: ['explicit', 'questionable'].includes(post.rating),
        tags: post.tags.split(' '),
        extension: post.file_url.split('.').pop(),
        uploadDate: new Date(post.created_at).getTime(),
        aiType: 0,
        urls: {
          original: post.file_url,
          regular: post.sample_url
        }
      }

      logger.debug('成功获取图片元数据', { metadata: generalImageData })

      return {
        status: 'success',
        data: {
          url: this.config.imageProcessing.compress
            ? post.file_url
            : post.sample_url,
          urls: {
            regular: post.sample_url,
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
      referer: 'https://gelbooru.com/'
    }
  }

  setConfig(config: Config) {
    this.config = config
  }
}

registerProvider('gelbooru', GelbooruSourceProvider)
