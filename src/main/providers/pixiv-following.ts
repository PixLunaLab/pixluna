import { Context } from 'koishi'
import type { Config } from '../../config'
import type {
    GeneralImageData,
    ImageMetaData,
    ImageSourceMeta,
    SourceResponse
} from '../../utils/type'
import { SourceProvider } from '../../utils/type'
import { shuffleArray } from '../../utils/shuffle'
import { logger } from '../../index'
import { USER_AGENT } from '../../utils/imageFetcher'

interface PixivFollowingResponse {
    error: boolean
    message: string
    body: {
        users: {
            userId: string
            userName: string
            illusts: {
                id: string
                title: string
                url: string
                tags: string[]
                userId: string
                userName: string
                width: number
                height: number
                pageCount: number
                xRestrict: number
                createDate: string
            }[]
        }[]
    }
}

interface PixivUserProfileResponse {
    error: boolean
    message: string
    body: {
        illusts: { [key: string]: null }
    }
}

interface PixivIllustResponse {
    error: boolean
    message: string
    body: {
        id: string
        title: string
        xRestrict: number
        createDate: string
        urls: {
            original: string
        }
        tags: {
            tags: {
                tag: string
            }[]
        }
        userName: string
        pageCount: number
    }
}

export interface PixivFollowingSourceRequest {
    userId: string
    offset: number
    limit: number
}

export class PixivFollowingSourceProvider extends SourceProvider {
    static FOLLOWING_URL =
        'https://www.pixiv.net/ajax/user/{USER_ID}/following?offset={OFFSET_COUNT}&limit={LIMIT_COUNT}&rest=show'

    static ILLUST_PAGES_URL =
        'https://www.pixiv.net/ajax/illust/{ARTWORK_ID}/pages'

    static USER_PROFILE_URL =
        'https://www.pixiv.net/ajax/user/{USER_ID}/profile/all'

    static ILLUST_URL = 'https://www.pixiv.net/ajax/illust/{ARTWORK_ID}'

    constructor(ctx: Context, config: Config) {
        super(ctx, config)
    }

    async getMetaData({
        context
    }: {
        context: Context
    }): Promise<SourceResponse<ImageMetaData>> {
        if (!this.config.pixiv.phpSESSID) {
            return {
                status: 'error',
                data: new Error('未设置 Pixiv PHPSESSID')
            }
        }

        try {
            // 获取所有关注列表
            const allUsers = await this.getAllFollowingUsers(context)

            if (!allUsers.length) {
                return {
                    status: 'error',
                    data: new Error('未找到关注的用户')
                }
            }

            // 随机选择一个关注的用户
            const randomUser = shuffleArray(allUsers)[0]

            // 获取该用户的所有作品
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

            // 从作品列表中随机选择一个非R18作品
            const illustIds = Object.keys(userProfileRes.body.illusts)
            let illustDetail: PixivIllustResponse
            let attempts = 0
            const maxAttempts = illustIds.length

            do {
                const randomIllustId = shuffleArray(illustIds)[0]
                illustDetail = await this.getIllustDetail(
                    context,
                    randomIllustId
                )
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
            const originalUrl = illustData.urls.original

            // 构造返回数据
            const generalImageData: GeneralImageData = {
                id: parseInt(illustData.id),
                title: illustData.title,
                author: illustData.userName,
                r18: illustData.xRestrict > 0,
                tags: illustData.tags.tags.map((tag) => tag.tag),
                extension: originalUrl.split('.').pop(),
                aiType: 0,
                uploadDate: new Date(illustData.createDate).getTime(),
                urls: {
                    original: this.constructImageUrl(originalUrl)
                }
            }

            logger.debug('成功获取 Pixiv Following 图片元数据', {
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
            logger.error('获取 Pixiv Discovery 元数据失败', { error })
            return {
                status: 'error',
                data: error
            }
        }
    }

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

            // 处理多图片页码
            const urlParts = originalUrl.split('_p')
            if (urlParts.length !== 2) {
                return {
                    status: 'error',
                    data: new Error('图片URL格式错误')
                }
            }

            // 替换页码
            const newUrl = `${urlParts[0]}_p${page}${urlParts[1].substring(urlParts[1].indexOf('.'))}`

            // 检查页码是否超出范围
            if (page >= illustData.pageCount) {
                return {
                    status: 'error',
                    data: new Error(
                        `页码超出范围，该作品共有 ${illustData.pageCount} 页`
                    )
                }
            }

            // 构造返回数据
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

    private async getAllFollowingUsers(
        context: Context
    ): Promise<PixivFollowingResponse['body']['users']> {
        let offset = 0
        const LIMIT = 100
        let allUsers: PixivFollowingResponse['body']['users'] = []

        while (true) {
            const url = PixivFollowingSourceProvider.FOLLOWING_URL.replace(
                '{USER_ID}',
                this.config.pixiv.following.userId
            )
                .replace('{OFFSET_COUNT}', offset.toString())
                .replace('{LIMIT_COUNT}', LIMIT.toString())

            const response = await context.http.get<PixivFollowingResponse>(
                url,
                {
                    headers: this.getHeaders(),
                    proxyAgent: this.getProxyAgent()
                }
            )

            if (response.error || !response.body.users.length) {
                break
            }

            allUsers = [...allUsers, ...response.body.users]
            offset += LIMIT

            // 如果返回的用户数小于限制数，说明已经到达末尾
            if (response.body.users.length < LIMIT) {
                break
            }
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
        return await context.http.get<PixivUserProfileResponse>(url, {
            headers: this.getHeaders(),
            proxyAgent: this.getProxyAgent()
        })
    }

    private async getIllustDetail(
        context: Context,
        illustId: string
    ): Promise<PixivIllustResponse> {
        const url = PixivFollowingSourceProvider.ILLUST_URL.replace(
            '{ARTWORK_ID}',
            illustId
        )
        return await context.http.get<PixivIllustResponse>(url, {
            headers: this.getHeaders(),
            proxyAgent: this.getProxyAgent()
        })
    }

    private getHeaders() {
        return {
            Referer: 'https://www.pixiv.net/',
            'User-Agent': USER_AGENT,
            Cookie: `PHPSESSID=${this.config.pixiv.phpSESSID}`
        }
    }

    private getProxyAgent() {
        return this.config.isProxy ? this.config.proxyHost : undefined
    }

    private constructImageUrl(originalUrl: string): string {
        const baseUrl = this.config.baseUrl || 'i.pximg.net'
        return originalUrl.replace('i.pximg.net', baseUrl)
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
