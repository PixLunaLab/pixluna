import type { Context } from "koishi"
import {
  type CommonSourceRequest,
  type GeneralImageData,
  type ImageMetaData,
  type ImageSourceMeta,
  SourceProvider,
  type SourceResponse
} from "../utils/type"
import { booruTags, isAiTag, imageExtension, uploadTime } from "../utils/booru"
import { registerProvider } from "../utils/providerRegistry"

const CLIENT_USER_AGENT = "Pixluna/2.3 (Koishi plugin; https://github.com/PixLunaLab/pixluna)"

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
  static description = "通过 Danbooru API 获取图片"
  protected endpoint = "https://danbooru.donmai.us"
  private get keyPair() {
    const pairs = this.config.danbooru?.keyPairs ?? []
    if (!pairs.length) return null

    return pairs[Math.floor(Math.random() * pairs.length)]
  }

  async getMetaData(
    { context }: { context: Context },
    request: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    try {
      const keyPair = this.keyPair
      const tagString = booruTags(request.tag)
      const wantsR18 = this.config.isR18 && request.r18

      const params: Record<string, string | number | boolean> = {
        tags: tagString,
        random: true,
        limit: 1,
        ...(keyPair ? { login: keyPair.login, api_key: keyPair.apiKey } : {})
      }

      params.tags += wantsR18 ? " rating:explicit" : " rating:general"
      if (request.excludeAI) params.tags += " -ai-generated"

      const response = await context.http.get<DanbooruPost[]>(`${this.endpoint}/posts.json`, {
        params,
        headers: { "User-Agent": CLIENT_USER_AGENT },
        proxyAgent: this.config.isProxy ? this.config.proxyHost : ""
      })

      if (!Array.isArray(response) || response.length === 0) {
        return {
          status: "error",
          data: new Error("No image data returned")
        }
      }

      const post = response[0]
      const tags = post.tag_string.split(" ")

      if (!wantsR18 && !["g", "general"].includes(post.rating)) {
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

      const regularUrl = post.large_file_url || post.file_url
      const url = this.config.imageProcessing.compress ? regularUrl : post.file_url

      const generalImageData: GeneralImageData = {
        id: post.id,
        title: "",
        author: post.tag_string_artist.replace(/_/g, " "),
        r18: !["g", "general"].includes(post.rating),
        tags,
        extension: imageExtension(url),
        aiType: isAiTag(tags) ? 2 : 0,
        uploadDate: uploadTime(post.created_at),
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
        data: new Error("danbooru API request failed; check upstream availability and credentials")
      }
    }
  }

  getMeta(): ImageSourceMeta {
    return {
      referer: "https://danbooru.donmai.us",
      userAgent: CLIENT_USER_AGENT
    }
  }
}

registerProvider("danbooru", DanbooruSourceProvider)
