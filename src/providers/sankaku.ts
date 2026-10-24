import type { Context } from "koishi"
import type { Config } from "../config"
import type {
  CommonSourceRequest,
  GeneralImageData,
  ImageMetaData,
  ImageSourceMeta,
  SourceResponse
} from "../utils/type"
import { SourceProvider } from "../utils/type"
import { booruTags, isSafeRating, isAiTag, imageExtension, uploadTime } from "../utils/booru"
import { registerProvider } from "../utils/providerRegistry"

interface SankakuPost {
  id: number
  file_url: string
  sample_url: string
  preview_url: string
  tags: { name: string }[]
  source: string
  author: { name: string }
  rating: string
  created_at: string | number | { s: number }
}

export class SankakuSourceProvider extends SourceProvider {
  static description = "通过 Sankaku Complex API 获取图片"
  protected endpoint = "https://capi-v2.sankakucomplex.com"
  protected http: Context["http"]

  constructor(ctx: Context, config: Config) {
    super(ctx, config)
    this.http = ctx.http.extend({
      headers: {
        "User-Agent": "Pixluna/2.3 (Koishi plugin)"
      },
      proxyAgent: config.isProxy ? config.proxyHost : ""
    })
  }

  private get keyPair() {
    const pairs = this.config.sankaku?.keyPairs ?? []
    if (!pairs.length) return null

    return pairs[Math.floor(Math.random() * pairs.length)]
  }

  private async login(keyPair: NonNullable<Config["sankaku"]>["keyPairs"][0]) {
    if (!keyPair.accessToken) {
      const data = await this.http.post<{ access_token?: string; token_type?: string }>(
        `${this.endpoint}/auth/token`,
        {
          login: keyPair.login,
          password: keyPair.password
        },
        {
          proxyAgent: this.config.isProxy ? this.config.proxyHost : ""
        }
      )
      if (!data?.access_token) throw new Error("Sankaku authentication returned no access token")
      keyPair.accessToken = data.access_token
      keyPair.tokenType = data.token_type || "Bearer"
    }
    return keyPair
  }

  async getMetaData(
    _: { context: Context },
    request: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    try {
      const keyPair = this.keyPair
      if (!keyPair) {
        throw new Error("No API credentials provided")
      }

      await this.login(keyPair)

      const tagString = booruTags(request.tag)
      const rating = this.config.isR18 && request.r18 ? "-rating:safe" : "rating:safe"
      const excludeAI = request.excludeAI ? "-ai_generated -ai-assisted" : ""

      const params = {
        tags: `${tagString} ${rating} ${excludeAI}`.trim(),
        limit: 1
      }

      const posts = await this.http.get<SankakuPost[]>(`${this.endpoint}/posts/random`, {
        params,
        headers: {
          Authorization: `${keyPair.tokenType || "Bearer"} ${keyPair.accessToken}`
        },
        proxyAgent: this.config.isProxy ? this.config.proxyHost : ""
      })

      if (!Array.isArray(posts) || !posts.length) {
        return {
          status: "error",
          data: new Error("No image data returned")
        }
      }

      const post = posts[0]
      const tags = post.tags.map((tag) => tag.name)

      if ((!this.config.isR18 || !request.r18) && !isSafeRating(post.rating)) {
        return {
          status: "error",
          data: new Error("Upstream returned a restricted image for a safe request")
        }
      }

      if (request.excludeAI && isAiTag(tags)) {
        return {
          status: "error",
          data: new Error("Upstream returned an AI image despite exclusion")
        }
      }

      if (!post.file_url) {
        return {
          status: "error",
          data: new Error("Upstream returned no original image URL")
        }
      }

      const regularUrl = post.sample_url || post.file_url
      const url = this.config.imageProcessing.compress ? regularUrl : post.file_url

      const generalImageData: GeneralImageData = {
        id: post.id,
        title: post.source || `Sankaku - ${post.id}`,
        author: post.author.name.replace(/_/g, " "),
        r18: !isSafeRating(post.rating),
        tags,
        extension: imageExtension(url),
        uploadDate: uploadTime(post.created_at),
        aiType: isAiTag(tags) ? 2 : 0,
        urls: {
          original: post.file_url,
          regular: regularUrl
        }
      }

      return {
        status: "success",
        data: {
          url,
          urls: {
            regular: regularUrl,
            original: post.file_url
          },
          raw: generalImageData
        }
      }
    } catch {
      return {
        status: "error",
        data: new Error("sankaku API request failed; check upstream availability and credentials")
      }
    }
  }

  getMeta(): ImageSourceMeta {
    return {
      referer: "https://sankaku.app"
    }
  }
}

registerProvider("sankaku", SankakuSourceProvider)
