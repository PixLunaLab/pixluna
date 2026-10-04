import type { Context } from "koishi"
import type { Config } from "../config"
import {
  type CommonSourceRequest,
  type GeneralImageData,
  type ImageMetaData,
  type ImageSourceMeta,
  SourceProvider,
  type SourceResponse
} from "../utils/type"
import { booruTags, isSafeRating, isAiTag, imageExtension, uploadTime } from "../utils/booru"
import { registerProvider } from "../utils/providerRegistry"

interface SafebooruPost {
  id: number
  directory: string
  image: string
  tags: string
  owner: string
  rating: string
  sample: boolean
  file_url?: string
  sample_url?: string
  created_at?: string | number
}

export class SafebooruSourceProvider extends SourceProvider {
  static description = "通过 Safebooru API 获取图片"
  protected endpoint = "https://safebooru.org/index.php"

  async getMetaData(
    { context }: { context: Context },
    props: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    try {
      if (this.config.isR18 && props.r18) {
        return { status: "error", data: new Error("Safebooru does not provide R18 images") }
      }
      const tagString = booruTags(props.tag)

      const params = {
        page: "dapi",
        s: "post",
        q: "index",
        json: "1",
        limit: "1",
        tags: `${tagString} sort:random rating:safe${props.excludeAI ? " -ai_generated -ai-assisted" : ""}`
      }

      const url = `${this.endpoint}?${new URLSearchParams(params).toString()}`

      const res = await context.http.get<SafebooruPost[]>(url, {
        proxyAgent: this.config.isProxy ? this.config.proxyHost : ""
      })

      if (!Array.isArray(res) || res.length === 0) {
        return {
          status: "error",
          data: new Error("No image data returned")
        }
      }

      const post = res[0]
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
      const originalUrl =
        post.file_url || `https://safebooru.org/images/${post.directory}/${post.image}?${post.id}`
      const sampleUrl = post.sample_url || originalUrl

      const generalImageData: GeneralImageData = {
        id: post.id,
        title: `Safebooru - ${post.id}`,
        author: post.owner.replace(/_/g, " "),
        r18: !isSafeRating(post.rating),
        tags,
        extension: imageExtension(this.config.imageProcessing.compress ? sampleUrl : originalUrl),
        aiType: isAiTag(tags) ? 2 : 0,
        uploadDate: post.created_at === undefined ? 0 : uploadTime(post.created_at),
        urls: {
          original: originalUrl,
          regular: sampleUrl
        }
      }

      return {
        status: "success",
        data: {
          url: this.config.imageProcessing.compress ? sampleUrl : originalUrl,
          urls: {
            regular: sampleUrl,
            original: originalUrl
          },
          raw: generalImageData
        }
      }
    } catch {
      return {
        status: "error",
        data: new Error("safebooru API request failed; check upstream availability and credentials")
      }
    }
  }

  getMeta(): ImageSourceMeta {
    return {
      referer: "https://safebooru.org"
    }
  }

  setConfig(config: Config) {
    this.config = config
  }
}

registerProvider("safebooru", SafebooruSourceProvider)
