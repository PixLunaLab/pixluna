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
  static description = "通过 E621 API 获取图片"
  protected endpoint = "https://e621.net"
  private keyPairs: { login: string; apiKey: string }[] = []

  setConfig(config: Config): void {
    this.config = config
    this.keyPairs = config.e621?.keyPairs || []
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

      const tagString = booruTags(props.tag)

      const params: Record<string, string | number | boolean> = {
        tags: `${tagString} order:random`,
        limit: 1
      }

      if (this.config.isR18 && props.r18) {
        params.tags += " -rating:s"
      } else {
        params.tags += " rating:s"
      }

      const headers: Record<string, string> = {
        "User-Agent": "PixLuna/1.0"
      }

      if (keyPair) {
        headers.Authorization =
          "Basic " + Buffer.from(`${keyPair.login}:${keyPair.apiKey}`).toString("base64")
      }

      if (props.excludeAI) params.tags += " -ai_generated -ai-assisted"

      const res = await context.http.get<{ posts: E621Post[] }>(`${this.endpoint}/posts.json`, {
        params,
        headers,
        proxyAgent: this.config.isProxy ? this.config.proxyHost : ""
      })

      if (!Array.isArray(res.posts) || res.posts.length === 0) {
        return {
          status: "error",
          data: new Error("No image data returned")
        }
      }

      const post = res.posts[0]
      const tags = Object.values(post.tags)
        .flat()
        .filter((tag): tag is string => typeof tag === "string")
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
      if (!post.file.url) {
        return { status: "error", data: new Error("Upstream returned no original image URL") }
      }
      const regularUrl = post.sample.url || post.file.url
      const url = this.config.imageProcessing.compress ? regularUrl : post.file.url

      const generalImageData: GeneralImageData = {
        id: post.id,
        title: "",
        author: post.tags.artist.join(", "),
        r18: !isSafeRating(post.rating),
        tags,
        extension: imageExtension(url),
        aiType: isAiTag(tags) ? 2 : 0,
        uploadDate: uploadTime(post.created_at),
        urls: {
          original: post.file.url,
          regular: regularUrl
        }
      }

      return {
        status: "success",
        data: {
          url,
          urls: {
            regular: regularUrl,
            original: post.file.url
          },
          raw: generalImageData
        }
      }
    } catch {
      return {
        status: "error",
        data: new Error("e621 API request failed; check upstream availability and credentials")
      }
    }
  }

  getMeta(): ImageSourceMeta {
    return {
      referer: "https://e621.net"
    }
  }
}

registerProvider("e621", E621SourceProvider)
