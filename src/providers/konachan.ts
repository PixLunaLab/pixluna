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
import { createHash } from "node:crypto"
import { registerProvider } from "../utils/providerRegistry"

interface KonachanPost {
  id: number
  created_at: string | number
  file_url: string
  sample_url: string
  preview_url: string
  tags: string
  author: string
  source: string
  rating: string
}

export class KonachanSourceProvider extends SourceProvider {
  static description = "通过 Konachan API 获取图片"
  protected endpoint = "https://konachan.com"
  private keyPairs: { login: string; password: string }[] = []

  private hashPassword(password: string): string {
    const salted = `So-I-Heard-You-Like-Mupkids-?--${password}--`
    const hash = createHash("sha1")
    hash.update(salted)
    return hash.digest("hex")
  }

  setConfig(config: Config): void {
    this.config = config
    this.keyPairs = config.konachan?.keyPairs || []
  }

  private get keyPair() {
    if (!this.keyPairs.length) return null
    const key = this.keyPairs[Math.floor(Math.random() * this.keyPairs.length)]
    return {
      login: key.login,
      password_hash: this.hashPassword(key.password)
    }
  }

  async getMetaData(
    { context }: { context: Context },
    props: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    try {
      const keyPair = this.keyPair

      const tagString = booruTags(props.tag)

      const params: Record<string, string | number | boolean> = {
        tags: `order:random ${tagString}`.trim(),
        limit: 1,
        ...(keyPair && {
          login: keyPair.login,
          password_hash: keyPair.password_hash,
          auth: true
        })
      }

      if (this.config.isR18 && props.r18) {
        params.tags = `${params.tags} -rating:safe`.trim()
      } else {
        params.tags = `${params.tags} rating:safe`.trim()
      }

      if (props.excludeAI) params.tags += " -ai_generated -ai-assisted"

      const res = await context.http.get<KonachanPost[]>(`${this.endpoint}/post.json`, {
        params,
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
      if (!post.file_url) {
        return { status: "error", data: new Error("Upstream returned no original image URL") }
      }
      const regularUrl = post.sample_url || post.file_url
      const url = this.config.imageProcessing.compress ? regularUrl : post.file_url

      const generalImageData: GeneralImageData = {
        id: post.id,
        title: "",
        author: post.author.replace(/_/g, " "),
        r18: !isSafeRating(post.rating),
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
        data: new Error("konachan API request failed; check upstream availability and credentials")
      }
    }
  }

  getMeta(): ImageSourceMeta {
    return {
      referer: "https://konachan.com"
    }
  }
}

registerProvider("konachan", KonachanSourceProvider)
