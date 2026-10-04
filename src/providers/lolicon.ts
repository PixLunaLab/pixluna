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
import { isAiTag, imageExtension } from "../utils/booru"
import { registerProvider } from "../utils/providerRegistry"

export interface LoliconLikeSourceRequest {
  r18?: number
  num?: number
  uid?: number[]
  keyword?: string
  tag?: string[]
  size?: string[]
  proxy?: string
  excludeAI?: boolean
}

export interface LoliconLikeResponse {
  error: string
  data: {
    pid: number
    p: number
    uid: number
    title: string
    author: string
    r18: boolean
    tags: string[]
    ext: string
    aiType: number
    uploadDate: number
    urls: {
      original: string
      regular?: string
    }
  }[]
}

export class LoliconSourceProvider extends SourceProvider {
  static description = "通过 Lolicon API 获取图片"
  protected API_URL = "https://api.lolicon.app/setu/v2"

  protected requestParams(props: CommonSourceRequest): LoliconLikeSourceRequest {
    const tags = props.tag
      ?.split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
    return {
      r18: this.config.isR18 && props.r18 ? 1 : 0,
      num: 1,
      tag: tags?.length ? tags : undefined,
      size: [...new Set([...(props.size || []), "original", "regular"])],
      excludeAI: props.excludeAI,
      proxy: props.proxy ?? this.config.baseUrl ?? ""
    }
  }

  async getMetaData(
    { context }: { context: Context },
    props: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    let res: LoliconLikeResponse
    try {
      res = await context.http.post<LoliconLikeResponse>(this.API_URL, this.requestParams(props), {
        proxyAgent: this.config.isProxy ? this.config.proxyHost : ""
      })
    } catch {
      return {
        status: "error",
        data: new Error("Image API request failed; check upstream availability")
      }
    }
    if (!res || res.error || !Array.isArray(res.data) || !res.data.length) {
      return {
        status: "error",
        data: new Error("Image API returned an error or no matching images")
      }
    }
    const imageData = res.data[0]
    if (
      !imageData ||
      typeof imageData.r18 !== "boolean" ||
      !Array.isArray(imageData.tags) ||
      imageData.tags.some((tag) => typeof tag !== "string")
    ) {
      return { status: "error", data: new Error("Image API returned invalid content metadata") }
    }
    const restricted = imageData.r18 || imageData.tags.some((tag) => /^r-?18(?:g)?$/i.test(tag))
    if ((!this.config.isR18 || !props.r18) && restricted) {
      return {
        status: "error",
        data: new Error("Upstream returned a restricted image for a safe request")
      }
    }
    if (props.excludeAI && (imageData.aiType === 2 || isAiTag(imageData.tags))) {
      return {
        status: "error",
        data: new Error("Upstream returned an AI image despite exclusion")
      }
    }
    if (!imageData.urls?.original) {
      return { status: "error", data: new Error("Image API returned no original image URL") }
    }
    const regularUrl = imageData.urls.regular || imageData.urls.original
    const url = this.config.imageProcessing.compress ? regularUrl : imageData.urls.original
    let extension: string
    try {
      extension = imageExtension(url)
    } catch {
      return { status: "error", data: new Error("Image API returned an invalid image URL") }
    }

    const generalImageData: GeneralImageData = {
      id: imageData.pid,
      title: imageData.title,
      author: imageData.author,
      r18: restricted,
      tags: imageData.tags,
      extension,
      aiType: imageData.aiType === 2 || isAiTag(imageData.tags) ? 2 : imageData.aiType,
      uploadDate: imageData.uploadDate,
      urls: imageData.urls
    }

    return {
      status: "success",
      data: {
        url,
        urls: {
          regular: regularUrl,
          original: imageData.urls.original
        },
        raw: generalImageData
      }
    }
  }

  setConfig(config: Config) {
    this.config = config
  }

  getMeta(): ImageSourceMeta {
    return {
      referer: "https://www.pixiv.net/"
    }
  }
}

registerProvider("lolicon", LoliconSourceProvider)
