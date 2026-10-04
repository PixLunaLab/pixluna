import { createHash } from "node:crypto"
import { setTimeout } from "node:timers/promises"
import type { Context, Element } from "koishi"
import type Config from "../config"
import type {
  CommonSourceRequest,
  GeneralImageData,
  ImageMetaData,
  ImageSourceMeta,
  SourceResponse
} from "../utils/type"
import { SourceProvider } from "../utils/type"
import { shuffleArray } from "../utils/shuffle"
import { downloadImage, USER_AGENT } from "../utils/request"
import {
  createAtMessage,
  renderImageMessage,
  renderMultipleImageMessage
} from "../utils/messageBuilder"
import { registerProvider } from "../utils/providerRegistry"

// Pixiv's public mobile-client identifiers, not account credentials.
// Upstream: https://github.com/upbit/pixivpy/blob/master/pixivpy3/api.py
const APP_URL = "https://app-api.pixiv.net"
const APP_HEADERS = {
  "User-Agent": "PixivIOSApp/7.13.3 (iOS 14.6; iPhone13,2)",
  "App-OS": "ios",
  "App-OS-Version": "14.6"
}
const CLIENT_ID = "MOBrBDS8blbauoSck0ZfDbtuzpyT"
const CLIENT_SECRET = "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj"
const HASH_SECRET = "28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c"

interface WebIllust {
  id: string
  title: string
  userName: string
  xRestrict: number
  createDate: string
  tags: { tags: { tag: string }[] }
  aiType?: number
  illustType?: number
  pageCount?: number
}
interface AppIllust {
  id: number
  title: string
  user: { id: number; name: string }
  x_restrict: number
  create_date: string
  tags: { name: string; translated_name?: string | null }[]
  illust_ai_type?: number
  type: string
  page_count: number
  meta_single_page: { original_image_url?: string }
  meta_pages: { image_urls: { original: string } }[]
}
interface Artwork {
  id: string
  title: string
  author: string
  restricted: boolean
  tags: string[]
  aiType: number
  date: string
  pages: string[]
}
interface WebResponse<T> {
  error: boolean
  body: T
  message?: string
}
interface AppResponse {
  error?: { message?: string }
  illust?: AppIllust
  illusts?: AppIllust[]
  next_url?: string | null
  user_previews?: { user: { id: number } }[]
}
interface OAuthResponse {
  response?: {
    access_token: string
    refresh_token?: string
    expires_in: number
    user: { id: string | number }
  }
  access_token?: string
  refresh_token?: string
  expires_in?: number
  user?: { id: string | number }
}
interface TokenState {
  credential: string
  refreshToken: string
  accessToken?: string
  expiresAt: number
  userId?: string
  pending?: Promise<TokenState>
}
const tokens = new WeakMap<Context, Map<string, TokenState>>()

function keywords(tag?: string): string[] {
  return (tag || "")
    .split(/[,，]/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}
function restricted(xRestrict: number, tags: string[]): boolean {
  return xRestrict > 0 || tags.some((tag) => /^r-?18(?:g)?$/i.test(tag))
}
function matches(artwork: Artwork, props: CommonSourceRequest, config: Config): boolean {
  if (artwork.restricted !== (config.isR18 && props.r18 === true)) return false
  if ((props.excludeAI ?? config.excludeAI) && artwork.aiType === 2) return false
  return keywords(props.tag).every(
    (word) =>
      artwork.title.toLowerCase().includes(word) ||
      artwork.tags.some((tag) => tag.toLowerCase().includes(word))
  )
}
function failure(message: string): SourceResponse<ImageMetaData> {
  return { status: "error", data: new Error(message) }
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Pixiv 请求失败"
}

abstract class PixivBaseProvider extends SourceProvider {
  protected get tokenMode(): boolean {
    return !!this.config.pixiv.refreshToken?.trim()
  }

  protected async pause(iteration: number): Promise<void> {
    if (iteration > 0 && this.config.apiDelay > 0) await setTimeout(this.config.apiDelay)
  }

  protected async token(context: Context): Promise<TokenState> {
    const credential = this.config.pixiv.refreshToken?.trim()
    if (!credential) throw new Error("未设置 Pixiv refresh token")
    let credentials = tokens.get(context)
    if (!credentials) {
      credentials = new Map()
      tokens.set(context, credentials)
    }
    let state = credentials.get(credential)
    if (!state) {
      state = { credential, refreshToken: credential, expiresAt: 0 }
      credentials.set(credential, state)
    }
    if (state.pending) return state.pending
    if (state.accessToken && Date.now() < state.expiresAt - 60_000) return state
    const current = state
    current.pending = (async () => {
      const time = new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00")
      const body = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: current.refreshToken,
        get_secure_url: "1"
      })
      let result: OAuthResponse
      try {
        result = await context.http.post<OAuthResponse>(
          "https://oauth.secure.pixiv.net/auth/token",
          body.toString(),
          {
            headers: {
              ...APP_HEADERS,
              "Content-Type": "application/x-www-form-urlencoded",
              "X-Client-Time": time,
              "X-Client-Hash": createHash("md5")
                .update(time + HASH_SECRET)
                .digest("hex")
            },
            proxyAgent: this.config.isProxy ? this.config.proxyHost : ""
          }
        )
      } catch {
        throw new Error("Pixiv refresh token 认证失败，请检查凭据和代理")
      }
      const value = result.response ?? result
      if (!value.access_token || !value.user?.id || !value.expires_in || value.expires_in <= 0) {
        throw new Error("Pixiv refresh token 认证失败：无有效令牌响应")
      }
      current.accessToken = value.access_token
      current.refreshToken = value.refresh_token || current.refreshToken
      current.userId = String(value.user.id)
      current.expiresAt = Date.now() + value.expires_in * 1000
      return current
    })()
    try {
      return await current.pending
    } finally {
      current.pending = undefined
    }
  }

  protected async web<T>(context: Context, path: string): Promise<T> {
    if (!this.config.pixiv.phpSESSID?.trim()) throw new Error("未设置 Pixiv PHPSESSID")
    let result: WebResponse<T>
    try {
      result = await context.http.get<WebResponse<T>>(`https://www.pixiv.net/ajax/${path}`, {
        headers: {
          Referer: "https://www.pixiv.net/",
          "User-Agent": USER_AGENT,
          Cookie: `PHPSESSID=${this.config.pixiv.phpSESSID.trim()}`
        },
        proxyAgent: this.config.isProxy ? this.config.proxyHost : ""
      })
    } catch {
      throw new Error("Pixiv Cookie API 请求失败，请检查认证和代理")
    }
    if (result.error || result.body == null)
      throw new Error("Pixiv Cookie API 拒绝请求或作品不可访问")
    return result.body
  }

  protected async app(context: Context, path: string): Promise<AppResponse> {
    const url = new URL(path, APP_URL)
    // Pagination links are upstream input: never forward a bearer token elsewhere.
    if (url.origin !== APP_URL) throw new Error("Pixiv 返回了无效的分页地址")
    const state = await this.token(context)
    let result: AppResponse
    try {
      result = await context.http.get<AppResponse>(url.href, {
        headers: { ...APP_HEADERS, Authorization: `Bearer ${state.accessToken}` },
        proxyAgent: this.config.isProxy ? this.config.proxyHost : ""
      })
    } catch {
      throw new Error("Pixiv App API 请求失败，请检查认证和代理")
    }
    if (result.error) throw new Error("Pixiv App API 拒绝请求或作品不可访问")
    return result
  }

  protected fromApp(value: AppIllust): Artwork {
    if (value.type === "ugoira") throw new Error("暂不支持 Pixiv 动图作品")
    const pages = value.meta_pages?.length
      ? value.meta_pages.map((page) => page.image_urls.original)
      : [value.meta_single_page?.original_image_url || ""]
    if (!pages.length || pages.some((page) => !page) || pages.length !== value.page_count) {
      throw new Error("Pixiv 未返回完整原图页列表")
    }
    const tags = value.tags.map((tag) => tag.name)
    return {
      id: String(value.id),
      title: value.title,
      author: value.user.name,
      restricted: restricted(value.x_restrict, tags),
      tags,
      aiType: value.illust_ai_type || 0,
      date: value.create_date,
      pages
    }
  }

  protected async detail(context: Context, id: string): Promise<Artwork | null> {
    if (!/^[1-9]\d*$/.test(id)) throw new Error("作品 ID 必须是正整数")
    if (this.tokenMode) {
      const result = await this.app(context, `/v1/illust/detail?illust_id=${id}`)
      if (!result.illust) throw new Error("Pixiv 未返回作品详情")
      return this.fromApp(result.illust)
    }
    const value = await this.web<WebIllust>(context, `illust/${id}`)
    if (value.illustType === 2) return null
    const pages = await this.web<{ urls: { original: string } }[]>(context, `illust/${id}/pages`)
    if (!pages.length || pages.some((page) => !page.urls?.original))
      throw new Error("Pixiv 未返回原图页列表")
    const tags = value.tags.tags.map((tag) => tag.tag)
    return {
      id: value.id,
      title: value.title,
      author: value.userName,
      restricted: restricted(value.xRestrict, tags),
      tags,
      aiType: value.aiType || 0,
      date: value.createDate,
      pages: pages.map((page) => page.urls.original)
    }
  }

  protected metadata(value: Artwork, page = 0): ImageMetaData {
    if (!Number.isInteger(page) || page < 0 || page >= value.pages.length) {
      throw new Error(`页码超出范围，该作品共有 ${value.pages.length} 页（页码从 0 开始）`)
    }
    const url = new URL(value.pages[page])
    if (url.protocol !== "https:" || url.hostname !== "i.pximg.net")
      throw new Error("Pixiv 返回了无效的原图地址")
    const base = this.config.baseUrl?.trim()
    let original = url.href
    if (base) {
      const replacement = new URL(base.includes("://") ? base : `https://${base}`)
      if (replacement.protocol !== "http:" && replacement.protocol !== "https:")
        throw new Error("图片代理地址无效")
      original = `${replacement.href.replace(/\/$/, "")}${url.pathname}${url.search}`
    }
    const raw: GeneralImageData = {
      id: value.id,
      title: value.title,
      author: value.author,
      r18: value.restricted,
      tags: value.tags,
      aiType: value.aiType,
      extension: url.pathname.split(".").pop() || "",
      uploadDate: new Date(value.date).getTime(),
      urls: { original }
    }
    return { url: original, urls: raw.urls, raw }
  }

  protected select(values: AppIllust[], props: CommonSourceRequest): ImageMetaData | undefined {
    for (const value of shuffleArray(values)) {
      if (value.type === "ugoira") continue
      const artwork = this.fromApp(value)
      if (matches(artwork, props, this.config)) return this.metadata(artwork)
    }
    return undefined
  }

  setConfig(config: Config): void {
    this.config = config
  }
  getMeta(): ImageSourceMeta {
    return { referer: "https://www.pixiv.net/" }
  }
}

export class PixivDiscoverySourceProvider extends PixivBaseProvider {
  static description = "通过 Pixiv 推荐或关键词获取图片，需要 Pixiv 账号"

  async getMetaData(
    { context }: { context: Context },
    props: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    try {
      if (this.tokenMode) {
        const words = keywords(props.tag)
        const query = new URLSearchParams(
          words.length
            ? {
                word: words.join(" "),
                search_target: "partial_match_for_tags",
                sort: "date_desc",
                filter: "for_ios"
              }
            : { content_type: "illust", filter: "for_ios", include_ranking_label: "true" }
        )
        if (props.excludeAI ?? this.config.excludeAI) query.set("search_ai_type", "0")
        const result = await this.app(
          context,
          `${words.length ? "/v1/search/illust" : "/v1/illust/recommended"}?${query}`
        )
        if (!Array.isArray(result.illusts)) throw new Error("Pixiv 未返回插画列表")
        const selected = this.select(result.illusts, props)
        return selected
          ? { status: "success", data: selected }
          : failure("未找到符合全部关键词、分级和 AI 条件的插画")
      }
      const result = await this.web<{ illusts: { id: string }[] }>(
        context,
        `illust/discovery?mode=${this.config.isR18 && props.r18 ? "r18" : "all"}&limit=20`
      )
      for (const [index, value] of shuffleArray(result.illusts).entries()) {
        await this.pause(index)
        const artwork = await this.detail(context, value.id)
        if (artwork && matches(artwork, props, this.config))
          return { status: "success", data: this.metadata(artwork) }
      }
      return failure("未找到符合全部关键词、分级和 AI 条件的插画")
    } catch (error) {
      return failure(errorMessage(error))
    }
  }
}

export class PixivFollowingSourceProvider extends PixivBaseProvider {
  static description = "获取 Pixiv 已关注画师作品，需要 Pixiv 账号"

  async getMetaData(
    { context }: { context: Context },
    props: CommonSourceRequest = {}
  ): Promise<SourceResponse<ImageMetaData>> {
    try {
      const users: string[] = []
      if (this.tokenMode) {
        const state = await this.token(context)
        let path: string | null | undefined =
          `/v1/user/following?user_id=${state.userId}&restrict=public`
        const visited = new Set<string>()
        while (path) {
          if (visited.has(path)) throw new Error("Pixiv 分页地址重复")
          visited.add(path)
          await this.pause(visited.size - 1)
          const result = await this.app(context, path)
          if (!Array.isArray(result.user_previews)) throw new Error("Pixiv 未返回关注用户列表")
          users.push(...result.user_previews.map((value) => String(value.user.id)))
          path = result.next_url
        }
      } else {
        const userId = this.config.pixiv.userId?.trim()
        if (!userId || !/^[1-9]\d*$/.test(userId)) throw new Error("未设置有效 Pixiv 用户 ID")
        for (let offset = 0; ; offset += 100) {
          await this.pause(offset)
          const result = await this.web<{ users: { userId: string }[] }>(
            context,
            `user/${userId}/following?offset=${offset}&limit=100&rest=show`
          )
          users.push(...result.users.map((value) => value.userId))
          if (result.users.length < 100) break
        }
      }
      if (!users.length) return failure("未找到关注的用户")
      for (const [index, userId] of shuffleArray([...new Set(users)])
        .slice(0, 10)
        .entries()) {
        await this.pause(index)
        if (this.tokenMode) {
          let path: string | null | undefined = `/v1/user/illusts?user_id=${userId}&filter=for_ios`
          const visited = new Set<string>()
          while (path) {
            if (visited.has(path)) throw new Error("Pixiv 分页地址重复")
            visited.add(path)
            await this.pause(visited.size - 1)
            const result = await this.app(context, path)
            if (!Array.isArray(result.illusts)) throw new Error("Pixiv 未返回画师作品列表")
            const selected = this.select(result.illusts, props)
            if (selected) return { status: "success", data: selected }
            path = result.next_url
          }
        } else {
          const profile = await this.web<{
            illusts: Record<string, unknown> | null
            manga?: Record<string, unknown> | null
          }>(context, `user/${userId}/profile/all`)
          const ids = [
            ...new Set([...Object.keys(profile.illusts || {}), ...Object.keys(profile.manga || {})])
          ]
          for (const [artIndex, id] of shuffleArray(ids).entries()) {
            await this.pause(artIndex)
            const artwork = await this.detail(context, id)
            if (artwork && matches(artwork, props, this.config))
              return { status: "success", data: this.metadata(artwork) }
          }
        }
      }
      return failure("已检查最多 10 位关注画师，未找到符合全部关键词、分级和 AI 条件的插画")
    } catch (error) {
      return failure(errorMessage(error))
    }
  }
}

export class PixivGetByIDProvider extends PixivBaseProvider {
  static description = "通过作品ID获取Pixiv图片"

  private checkDirect(artwork: Artwork): void {
    if (!this.config.isR18 && artwork.restricted) throw new Error("当前配置禁止获取 R18 作品")
    if (this.config.excludeAI && artwork.aiType === 2)
      throw new Error("当前配置禁止获取 AI 生成作品")
  }

  async getImageByPid(
    context: Context,
    pid: string,
    page = 0
  ): Promise<SourceResponse<ImageMetaData>> {
    try {
      if (!Number.isInteger(page) || page < 0) throw new Error("页码必须是非负整数")
      const artwork = await this.detail(context, pid)
      if (!artwork) throw new Error("暂不支持 Pixiv 动图作品")
      this.checkDirect(artwork)
      return { status: "success", data: this.metadata(artwork, page) }
    } catch (error) {
      return failure(errorMessage(error))
    }
  }

  async getMetaData(): Promise<SourceResponse<ImageMetaData>> {
    return failure("This provider only supports getting images by ID")
  }

  async getImageWithBuffer(
    pid: string,
    page = 0
  ): Promise<GeneralImageData & { data: Buffer; mimeType: string }> {
    const result = await this.getImageByPid(this.ctx, pid, page)
    if (result.status === "error") throw result.data
    return downloadImage(this.ctx, this.config, result.data, this)
  }

  async getImageWithAtMessage(
    userId: string,
    options: { pid: string; page: number }
  ): Promise<string | Element> {
    if (!options.pid) return createAtMessage(userId, "请提供作品 ID (PID)")
    try {
      return renderImageMessage(
        await this.getImageWithBuffer(options.pid, options.page),
        this.config
      )
    } catch (error) {
      return createAtMessage(userId, errorMessage(error))
    }
  }

  async getAllImagesWithAtMessage(
    userId: string,
    options: { pid: string; page: number }
  ): Promise<string | Element> {
    if (!options.pid) return createAtMessage(userId, "请提供作品 ID (PID)")
    try {
      const artwork = await this.detail(this.ctx, options.pid)
      if (!artwork) throw new Error("暂不支持 Pixiv 动图作品")
      this.checkDirect(artwork)
      const images: (GeneralImageData & { data: Buffer; mimeType: string })[] = []
      for (let page = 0; page < artwork.pages.length; page++) {
        await this.pause(page)
        images.push(await downloadImage(this.ctx, this.config, this.metadata(artwork, page), this))
      }
      return images.length === 1
        ? renderImageMessage(images[0], this.config)
        : renderMultipleImageMessage(images, this.config)
    } catch (error) {
      return createAtMessage(userId, errorMessage(error))
    }
  }
}

registerProvider("pdiscovery", PixivDiscoverySourceProvider)
registerProvider("pfollowing", PixivFollowingSourceProvider)
