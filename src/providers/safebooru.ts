import type { Context } from "koishi"
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
    request: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    try {
      if (this.config.isR18 && request.r18) {
        return {
          status: "error",
          data: new Error("Safebooru does not provide R18 images")
        }
      }

      const tagString = booruTags(request.tag)
      const excludeAI = request.excludeAI ? "-ai_generated -ai-assisted" : ""

      const params = {
        page: "dapi",
        s: "post",
        q: "index",
        json: "1",
        limit: "1",
        tags: `${tagString} sort:random rating:safe ${excludeAI}`.trim()
      }

      const requestUrl = `${this.endpoint}?${new URLSearchParams(params).toString()}`

      const response = await context.http.get<SafebooruPost[]>(requestUrl, {
        proxyAgent: this.config.isProxy ? this.config.proxyHost : ""
      })

      if (!Array.isArray(response) || response.length === 0) {
        return {
          status: "error",
          data: new Error("No image data returned")
        }
      }

      const post = response[0]
      const tags = post.tags.split(" ")

      if (!isSafeRating(post.rating)) {
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

      const originalUrl =
        post.file_url || `https://safebooru.org/images/${post.directory}/${post.image}?${post.id}`
      const sampleUrl = post.sample_url || originalUrl
      const url = this.config.imageProcessing.compress ? sampleUrl : originalUrl

      const generalImageData: GeneralImageData = {
        id: post.id,
        title: `Safebooru - ${post.id}`,
        author: post.owner.replace(/_/g, " "),
        r18: !isSafeRating(post.rating),
        tags,
        extension: imageExtension(url),
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
          url,
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
}

registerProvider("safebooru", SafebooruSourceProvider)
