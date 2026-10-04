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
  static description = "通过 Gelbooru API 获取图片"
  protected endpoint = "https://gelbooru.com/index.php"

  private get keyPair() {
    const pairs = this.config.gelbooru?.keyPairs || []
    return pairs.length ? pairs[Math.floor(Math.random() * pairs.length)] : null
  }

  async getMetaData(
    { context }: { context: Context },
    props: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    const tagString = booruTags(props.tag)

    const params = new URLSearchParams({
      page: "dapi",
      s: "post",
      q: "index",
      json: "1",
      limit: "1",
      tags: `${tagString} sort:random${this.config.isR18 && props.r18 ? " -rating:general" : " rating:general"}${props.excludeAI ? " -ai_generated -ai-assisted" : ""}`
    })

    const keyPair = this.keyPair
    if (keyPair) {
      params.append("api_key", keyPair.apiKey)
      params.append("user_id", keyPair.userId)
    }

    const url = `${this.endpoint}?${params.toString()}`

    try {
      const res = await context.http.get<GelbooruResponse>(url, {
        proxyAgent: this.config.isProxy ? this.config.proxyHost : ""
      })

      if (!res.post?.length) {
        return {
          status: "error",
          data: new Error("No image data returned")
        }
      }

      const post = res.post[0]
      const tags = post.tags.split(" ")
      if ((!this.config.isR18 || !props.r18) && !isSafeRating(post.rating)) {
        return {
          status: "error",
          data: new Error("Upstream returned a restricted image for a safe request")
        }
      }
      if (props.excludeAI && isAiTag(tags)) {
        return {
          status: "error",
          data: new Error("Upstream returned an AI image despite exclusion")
        }
      }
      if (!post.file_url) {
        return { status: "error", data: new Error("Upstream returned no original image URL") }
      }
      const regularUrl = post.sample_url || post.file_url
      const generalImageData: GeneralImageData = {
        id: post.id,
        title: post.source || `Gelbooru - ${post.id}`,
        author: post.owner.replace(/_/g, " "),
        r18: !isSafeRating(post.rating),
        tags,
        extension: imageExtension(
          this.config.imageProcessing.compress ? regularUrl : post.file_url
        ),
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
          url: this.config.imageProcessing.compress ? regularUrl : post.file_url,
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
        data: new Error("gelbooru API request failed; check upstream availability and credentials")
      }
    }
  }

  getMeta(): ImageSourceMeta {
    return {
      referer: "https://gelbooru.com/"
    }
  }

  setConfig(config: Config) {
    this.config = config
  }
}

registerProvider("gelbooru", GelbooruSourceProvider)
