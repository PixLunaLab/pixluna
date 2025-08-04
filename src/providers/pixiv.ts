import type { Context, Element } from 'koishi'
import type { Config } from '../config'
import type {
  CommonSourceRequest,
  GeneralImageData,
  ImageMetaData,
  ImageSourceMeta,
  SourceResponse
} from '../utils/type'
import { SourceProvider } from '../utils/type'
import { shuffleArray } from '../utils/shuffle'
import { logger } from '../index'
import { fetchImageBuffer, USER_AGENT } from '../utils/request'
import {
  createAtMessage,
  renderImageMessage,
  renderMultipleImageMessage
} from '../utils/messageBuilder'

interface PixivIllustResponse {
  error: boolean
  body: {
    id: string
    title: string
    userName: string
    xRestrict: number
    createDate: string
    urls: {
      original: string
    }
    tags: {
      tags: { tag: string }[]
    }
    pageCount?: number
  }
}

interface PixivFollowingResponse {
  error: boolean
  body: {
    users: {
      userId: string
      userName: string
    }[]
  }
}

interface PixivUserProfileResponse {
  error: boolean
  body: {
    illusts: {
      [key: string]: any
    }
  }
}

interface PixivResponse {
  error: boolean
  message: string
  body: {
    illusts: {
      id: string
      title: string
      url: string
      tags: string[]
      userId: string
      userName: string
      xRestrict: number
      createDate: string
    }[]
  }
}

function processTags(tag: string): string[] {
  if (!tag) return []
  const tags = tag
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
  return tags.slice(0, 5)
}

function isIllustMatchTags(illust: any, targetTags: string[]): boolean {
  if (!targetTags.length) return true

  const title = illust.title?.toLowerCase() || ''
  const tags = Array.isArray(illust.tags)
    ? illust.tags.map((t: any) =>
        typeof t === 'string' ? t.toLowerCase() : t.tag?.toLowerCase() || ''
      )
    : []

  return targetTags.every((tag) => {
    const tagLower = tag.toLowerCase()
    return (
      title.includes(tagLower) ||
      tags.some((t: any) => typeof t === 'string' && t.includes(tagLower))
    )
  })
}

function filterIllustsByTags(illusts: any[], tags: string[]): any[] {
  if (!tags.length || !illusts.length) return illusts

  for (let i = tags.length; i > 0; i--) {
    const targetTags = tags.slice(0, i)
    const filtered = illusts.filter((illust) =>
      isIllustMatchTags(illust, targetTags)
    )

    if (filtered.length > 0) {
      return filtered
    }
  }

  return illusts
}

abstract class PixivBaseProvider extends SourceProvider {
  protected getHeaders() {
    return {
      Referer: 'https://www.pixiv.net/',
      'User-Agent': USER_AGENT,
      Cookie: `PHPSESSID=${this.config.pixiv.phpSESSID}`
    }
  }

  protected getProxyAgent() {
    return this.config.isProxy ? this.config.proxyHost : undefined
  }

  protected constructImageUrl(originalUrl: string): string {
    const baseUrl = this.config.baseUrl || 'i.pximg.net'
    return originalUrl.replace('i.pximg.net', baseUrl)
  }

  protected async fetchPixivData<T>(context: Context, url: string): Promise<T> {
    return await context.http.get<T>(url, {
      headers: this.getHeaders(),
      proxyAgent: this.getProxyAgent()
    })
  }

  setConfig(config: Config) {
    this.config = config
  }

  getMeta(): ImageSourceMeta {
    return {
      referer: 'https://www.pixiv.net/'
    }
  }
}

// Discovery
export class PixivDiscoverySourceProvider extends PixivBaseProvider {
  static DISCOVERY_URL = 'https://www.pixiv.net/ajax/illust/discovery'
  static ILLUST_PAGES_URL =
    'https://www.pixiv.net/ajax/illust/{ARTWORK_ID}/pages'

  async getMetaData(
    { context }: { context: Context },
    props: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    try {
      const tags = processTags(props.tag)

      const url = `${PixivDiscoverySourceProvider.DISCOVERY_URL}?mode=${this.config.isR18 && props.r18 ? 'r18' : 'all'}&limit=20`
      const discoveryRes = await this.fetchPixivData<PixivResponse>(
        context,
        url
      )

      if (discoveryRes.error || !discoveryRes.body.illusts.length) {
        return {
          status: 'error',
          data: new Error(discoveryRes.message || '未找到插画')
        }
      }

      let filteredIllusts = filterIllustsByTags(discoveryRes.body.illusts, tags)

      if (!this.config.isR18) {
        filteredIllusts = filteredIllusts.filter(
          (illust) =>
            !(
              illust.xRestrict > 0 ||
              illust.tags.some((tag: string) => tag.toLowerCase() === 'r-18')
            )
        )
      }

      if (filteredIllusts.length === 0) {
        return {
          status: 'error',
          data: new Error(`未找到包含标签 "${tags.join(', ')}" 的插画`)
        }
      }

      const selectedIllust = shuffleArray(filteredIllusts)[0]

      const illustPagesUrl =
        PixivDiscoverySourceProvider.ILLUST_PAGES_URL.replace(
          '{ARTWORK_ID}',
          selectedIllust.id
        )
      const illustPagesRes = await context.http.get(illustPagesUrl, {
        headers: this.getHeaders(),
        proxyAgent: this.getProxyAgent()
      })

      if (illustPagesRes.error || !illustPagesRes.body.length) {
        return { status: 'error', data: new Error('无法获取原图链接') }
      }

      const baseUrl = this.config.baseUrl || 'i.pximg.net'
      const originalUrl = illustPagesRes.body[0].urls.original.replace(
        'i.pximg.net',
        baseUrl
      )

      const generalImageData: GeneralImageData = {
        id: parseInt(selectedIllust.id),
        title: selectedIllust.title,
        author: selectedIllust.userName,
        r18: selectedIllust.xRestrict > 0,
        tags: selectedIllust.tags,
        extension: originalUrl.split('.').pop(),
        aiType: 0,
        uploadDate: new Date(selectedIllust.createDate).getTime(),
        urls: {
          original: originalUrl,
          regular: selectedIllust.url.replace('i.pximg.net', baseUrl)
        }
      }

      return {
        status: 'success',
        data: {
          url: originalUrl,
          urls: generalImageData.urls,
          raw: generalImageData
        }
      }
    } catch (error) {
      logger.error('获取 Pixiv Discovery 元数据失败', { error })
      return { status: 'error', data: error }
    }
  }
}

// Following
export class PixivFollowingSourceProvider extends PixivBaseProvider {
  static description = '获取 Pixiv 已关注画师作品，需要 Pixiv 账号'
  static FOLLOWING_URL =
    'https://www.pixiv.net/ajax/user/{USER_ID}/following?offset={OFFSET_COUNT}&limit={LIMIT_COUNT}&rest=show'

  static USER_PROFILE_URL =
    'https://www.pixiv.net/ajax/user/{USER_ID}/profile/all'

  static ILLUST_URL = 'https://www.pixiv.net/ajax/illust/{ARTWORK_ID}'

  async getMetaData(
    {
      context
    }: {
      context: Context
    },
    props?: CommonSourceRequest
  ): Promise<SourceResponse<ImageMetaData>> {
    if (!this.config.pixiv.phpSESSID) {
      return {
        status: 'error',
        data: new Error('未设置 Pixiv PHPSESSID')
      }
    }

    const tags = processTags(props?.tag)

    try {
      const allUsers = await this.getAllFollowingUsers(context)
      if (!allUsers.length) {
        return { status: 'error', data: new Error('未找到关注的用户') }
      }

      const matchedIllusts: any[] = []
      const processedUserIds = new Set<string>()
      let usersChecked = 0
      const maxUsersToCheck = Math.min(allUsers.length, 10)

      const shuffledUsers = shuffleArray(allUsers)
      while (usersChecked < maxUsersToCheck && matchedIllusts.length < 20) {
        const currentUser = shuffledUsers[usersChecked]
        usersChecked++

        if (processedUserIds.has(currentUser.userId)) continue
        processedUserIds.add(currentUser.userId)

        const userProfileRes = await this.getUserProfile(
          context,
          currentUser.userId
        )

        if (userProfileRes.error || !userProfileRes.body.illusts) continue

        const illustsData = Object.entries(userProfileRes.body.illusts).map(
          ([id, illust]) => ({
            id,
            ...illust
          })
        )

        if (tags.length > 0) {
          for (const illust of illustsData) {
            try {
              const detail = await this.getIllustDetail(context, illust.id)

              if (!detail.error && detail.body) {
                const isR18 =
                  detail.body.xRestrict > 0 ||
                  detail.body.tags.tags.some(
                    (tag) => tag.tag.toLowerCase() === 'r-18'
                  )

                if (
                  (this.config.isR18 || !isR18) &&
                  isIllustMatchTags(detail.body, tags)
                ) {
                  matchedIllusts.push(detail.body)
                }
              }
            } catch (_error) {}
          }
        } else {
          break
        }
      }

      if (tags.length > 0 && matchedIllusts.length > 0) {
        const selectedIllust = shuffleArray(matchedIllusts)[0]
        const illustData = selectedIllust

        return {
          status: 'success',
          data: {
            url: this.constructImageUrl(illustData.urls.original),
            urls: {
              original: this.constructImageUrl(illustData.urls.original)
            },
            raw: {
              id: parseInt(illustData.id),
              title: illustData.title,
              author: illustData.userName,
              r18: illustData.xRestrict > 0,
              tags: illustData.tags.tags.map((tag: { tag: any }) => tag.tag),
              extension: illustData.urls.original.split('.').pop(),
              aiType: 0,
              uploadDate: new Date(illustData.createDate).getTime(),
              urls: {
                original: this.constructImageUrl(illustData.urls.original)
              }
            }
          }
        }
      } else if (tags.length > 0 && matchedIllusts.length === 0) {
        return {
          status: 'error',
          data: new Error(`未找到包含标签 "${tags.join(', ')}" 的插画`)
        }
      } else {
        const randomUser = shuffleArray(allUsers)[0]
        const userProfileRes = await this.getUserProfile(
          context,
          randomUser.userId
        )

        if (userProfileRes.error || !userProfileRes.body.illusts) {
          return {
            status: 'error',
            data: new Error('无法获取用户作品列表')
          }
        }

        const illustIds = Object.keys(userProfileRes.body.illusts)
        let illustDetail: PixivIllustResponse
        let attempts = 0
        const maxAttempts = illustIds.length

        do {
          const randomIllustId = shuffleArray(illustIds)[0]
          illustDetail = await this.getIllustDetail(context, randomIllustId)
          attempts++

          if (illustDetail.error || !illustDetail.body) {
            if (attempts >= maxAttempts) {
              return {
                status: 'error',
                data: new Error('无法获取合适的插画详情')
              }
            }
            continue
          }

          const isR18 =
            illustDetail.body.xRestrict > 0 ||
            illustDetail.body.tags.tags.some(
              (tag) => tag.tag.toLowerCase() === 'r-18'
            )

          if (!this.config.isR18 && isR18) {
            continue
          }

          break
        } while (attempts < maxAttempts)

        if (attempts >= maxAttempts) {
          return {
            status: 'error',
            data: new Error('未找到符合条件的插画')
          }
        }

        const illustData = illustDetail.body
        return {
          status: 'success',
          data: {
            url: this.constructImageUrl(illustData.urls.original),
            urls: {
              original: this.constructImageUrl(illustData.urls.original)
            },
            raw: {
              id: parseInt(illustData.id),
              title: illustData.title,
              author: illustData.userName,
              r18: illustData.xRestrict > 0,
              tags: illustData.tags.tags.map((tag) => tag.tag),
              extension: illustData.urls.original.split('.').pop(),
              aiType: 0,
              uploadDate: new Date(illustData.createDate).getTime(),
              urls: {
                original: this.constructImageUrl(illustData.urls.original)
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('获取 Pixiv Discovery 元数据失败', { error })
      return { status: 'error', data: error }
    }
  }

  private async getAllFollowingUsers(context: Context) {
    let offset = 0
    const LIMIT = 100
    const allUsers = []

    while (true) {
      const url = PixivFollowingSourceProvider.FOLLOWING_URL.replace(
        '{USER_ID}',
        this.config.pixiv.userId
      )
        .replace('{OFFSET_COUNT}', offset.toString())
        .replace('{LIMIT_COUNT}', LIMIT.toString())

      const response = await this.fetchPixivData<PixivFollowingResponse>(
        context,
        url
      )
      if (response.error || !response.body.users.length) break

      allUsers.push(...response.body.users)
      offset += LIMIT
      if (response.body.users.length < LIMIT) break
    }

    return allUsers
  }

  private async getUserProfile(
    context: Context,
    userId: string
  ): Promise<PixivUserProfileResponse> {
    const url = PixivFollowingSourceProvider.USER_PROFILE_URL.replace(
      '{USER_ID}',
      userId
    )
    return await this.fetchPixivData<PixivUserProfileResponse>(context, url)
  }

  private async getIllustDetail(
    context: Context,
    illustId: string
  ): Promise<PixivIllustResponse> {
    const url = PixivFollowingSourceProvider.ILLUST_URL.replace(
      '{ARTWORK_ID}',
      illustId
    )
    return await this.fetchPixivData<PixivIllustResponse>(context, url)
  }
}

// GetByID
export class PixivGetByIDProvider extends PixivBaseProvider {
  static description = '通过作品ID获取Pixiv图片'
  static ILLUST_URL = 'https://www.pixiv.net/ajax/illust/{ARTWORK_ID}'

  async getImageByPid(
    context: Context,
    pid: string,
    page: number = 0
  ): Promise<SourceResponse<ImageMetaData>> {
    if (!this.config.pixiv.phpSESSID) {
      return {
        status: 'error',
        data: new Error('未设置 Pixiv PHPSESSID')
      }
    }

    try {
      const illustDetail = await this.getIllustDetail(context, pid)

      if (illustDetail.error || !illustDetail.body) {
        return {
          status: 'error',
          data: new Error('无法获取插画详情')
        }
      }

      const illustData = illustDetail.body
      const originalUrl = illustData.urls.original

      const urlParts = originalUrl.split('_p')
      if (urlParts.length !== 2) {
        return {
          status: 'error',
          data: new Error('图片URL格式错误')
        }
      }

      const newUrl = `${urlParts[0]}_p${page}${urlParts[1].substring(urlParts[1].indexOf('.'))}`

      if (page >= illustData.pageCount) {
        return {
          status: 'error',
          data: new Error(`页码超出范围，该作品共有 ${illustData.pageCount} 页`)
        }
      }

      const generalImageData: GeneralImageData = {
        id: parseInt(illustData.id),
        title: illustData.title,
        author: illustData.userName,
        r18: illustData.xRestrict > 0,
        tags: illustData.tags.tags.map((tag) => tag.tag),
        extension: newUrl.split('.').pop(),
        aiType: 0,
        uploadDate: new Date(illustData.createDate).getTime(),
        urls: {
          original: this.constructImageUrl(newUrl)
        }
      }

      logger.debug('成功获取 Pixiv 图片元数据', {
        metadata: generalImageData
      })

      return {
        status: 'success',
        data: {
          url: generalImageData.urls.original,
          urls: generalImageData.urls,
          raw: generalImageData
        }
      }
    } catch (error) {
      logger.error('获取 Pixiv 图片元数据失败', { error })
      return {
        status: 'error',
        data: error
      }
    }
  }

  private async getIllustDetail(
    context: Context,
    illustId: string
  ): Promise<PixivIllustResponse> {
    const url = PixivGetByIDProvider.ILLUST_URL.replace(
      '{ARTWORK_ID}',
      illustId
    )
    return await context.http.get<PixivIllustResponse>(url, {
      headers: this.getHeaders(),
      proxyAgent: this.getProxyAgent()
    })
  }

  async getMetaData(): Promise<SourceResponse<ImageMetaData>> {
    return {
      status: 'error',
      data: new Error('This provider only supports getting images by ID')
    }
  }

  async getImageWithBuffer(
    pid: string,
    page: number = 0
  ): Promise<GeneralImageData & { data: Buffer; mimeType: string }> {
    const result = await this.getImageByPid(this.ctx, pid, page)

    if (result.status === 'error') {
      throw result.data
    }

    const [arrayBuffer, mimeType] = await fetchImageBuffer(
      this.ctx,
      this.config,
      result.data.url,
      this
    )
    const buffer = Buffer.from(arrayBuffer)

    return {
      data: buffer,
      mimeType,
      id: result.data.raw.id,
      title: result.data.raw.title,
      tags: result.data.raw.tags,
      author: result.data.raw.author,
      r18: result.data.raw.r18,
      extension: result.data.raw.extension,
      aiType: result.data.raw.aiType,
      uploadDate: result.data.raw.uploadDate,
      urls: result.data.raw.urls
    }
  }

  async getImageWithAtMessage(
    userId: string,
    options: { pid: string; page: number }
  ): Promise<string | Element> {
    if (!options.pid) {
      return createAtMessage(userId, '请提供作品 ID (PID)')
    }

    try {
      const imageData = await this.getImageWithBuffer(options.pid, options.page)
      return renderImageMessage(imageData, this.config)
    } catch (e) {
      this.ctx.logger.error(e)
      const errorMessage = e instanceof Error ? e.message : String(e)
      return createAtMessage(userId, errorMessage || '获取图片失败')
    }
  }

  async getAllImagesWithAtMessage(
    userId: string,
    options: { pid: string; page: number }
  ): Promise<string | Element> {
    if (!options.pid) {
      return createAtMessage(userId, '请提供作品 ID (PID)')
    }

    try {
      const illustDetail = await this.getIllustDetail(this.ctx, options.pid)

      if (illustDetail.error || !illustDetail.body) {
        return createAtMessage(userId, '无法获取插画详情')
      }

      const pageCount = illustDetail.body.pageCount || 1

      if (pageCount === 1) {
        const imageData = await this.getImageWithBuffer(options.pid, 0)
        return renderImageMessage(imageData, this.config)
      }

      const imagePromises = []
      for (let i = 0; i < pageCount; i++) {
        imagePromises.push(this.getImageWithBuffer(options.pid, i))
      }

      const allImages = await Promise.all(imagePromises)

      return renderMultipleImageMessage(allImages, this.config)
    } catch (e) {
      this.ctx.logger.error(e)
      const errorMessage = e instanceof Error ? e.message : String(e)
      return createAtMessage(userId, errorMessage || '获取图片失败')
    }
  }
}
