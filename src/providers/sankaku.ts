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
import { USER_AGENT } from '../utils/request'

interface SankakuPost {
  id: number
  file_url: string
  sample_url: string
  preview_url: string
  tags: { name: string }[]
  source: string
  author: { name: string }
  rating: string
  created_at: string
}

export class SankakuSourceProvider extends SourceProvider {
  static description = '通过 Sankaku Complex API 获取图片'
  protected endpoint = 'https://capi-v2.sankakucomplex.com'
  protected http: Context['http']

  constructor(ctx: Context, config: Config) {
    super(ctx, config)
    this.http = ctx.http.extend({
      headers: {
        'User-Agent': USER_AGENT
      },
      proxyAgent: config.isProxy ? config.proxyHost : undefined
    })
  }

  private get keyPair() {
    const pairs = this.config.sankaku?.keyPairs || []
    return pairs.length ? pairs[Math.floor(Math.random() * pairs.length)] : null
  }

  private async login(keyPair: NonNullable<Config['sankaku']>['keyPairs'][0]) {
    if (!keyPair.accessToken) {
      const data = await this.http.post(
        `${this.endpoint}/auth/token`,
        {
          login: keyPair.login,
          password: keyPair.password
        },
        {
          proxyAgent: this.config.isProxy ? this.config.proxyHost : undefined
        }
      )
      if (data.access_token) {
        keyPair.accessToken = data.access_token
        keyPair.tokenType = data.token_type
      }
    }
    return keyPair
  }

  async getMetaData(
    _: { context: Context },
    props: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    try {
      const keyPair = this.keyPair
      if (!keyPair) {
        throw new Error('No API credentials provided')
      }

      await this.login(keyPair)

      let tagString = ''
      if (props.tag) {
        tagString = props.tag
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean)
          .join(' ')
      }

      const params = new URLSearchParams({
        tags: `${tagString} order:random${this.config.isR18 && props.r18 ? '' : ' rating:safe'}`,
        limit: '1'
      })

      const posts = await this.http.get<SankakuPost[]>(
        `${this.endpoint}/posts/random`,
        {
          params,
          headers: {
            Authorization: `${keyPair.tokenType} ${keyPair.accessToken}`
          },
          proxyAgent: this.config.isProxy ? this.config.proxyHost : undefined
        }
      )

      if (!posts.length) {
        return {
          status: 'error',
          data: new Error('No image data returned')
        }
      }

      const post = posts[0]
      const generalImageData: GeneralImageData = {
        id: post.id,
        title: post.source || `Sankaku - ${post.id}`,
        author: post.author.name.replace(/_/g, ' '),
        r18: ['explicit', 'questionable'].includes(post.rating),
        tags: post.tags.map((t) => t.name),
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
            ? post.sample_url
            : post.file_url,
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
      referer: 'https://sankaku.app'
    }
  }

  setConfig(config: Config) {
    this.config = config
  }
}
