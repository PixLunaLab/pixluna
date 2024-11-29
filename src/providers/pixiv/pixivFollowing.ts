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
import { USER_AGENT } from '../../utils/request'

interface PixivBaseResponse {
    error: boolean
    message: string
}

interface PixivFollowingResponse extends PixivBaseResponse {
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
    static description = '获取 Pixiv 已关注画师作品，需要 Pixiv 账号'
    static FOLLOWING_URL =
        'https://www.pixiv.net/ajax/user/{USER_ID}/following?offset={OFFSET_COUNT}&limit={LIMIT_COUNT}&rest=show'

    static ILLUST_PAGES_URL =
        'https://www.pixiv.net/ajax/illust/{ARTWORK_ID}/pages'

    static USER_PROFILE_URL =
        'https://www.pixiv.net/ajax/user/{USER_ID}/profile/all'

    static ILLUST_URL = 'https://www.pixiv.net/ajax/illust/{ARTWORK_ID}'

    private async fetchPixivData<T>(context: Context, url: string): Promise<T> {
        return await context.http.get<T>(url, {
            headers: this.getHeaders(),
            proxyAgent: this.getProxyAgent()
        })
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
            const allUsers = await this.getAllFollowingUsers(context)
            if (!allUsers.length) {
                return { status: 'error', data: new Error('未找到关注的用户') }
            }

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
            return {
                status: 'success',
                data: {
                    url: this.constructImageUrl(illustData.urls.original),
                    urls: {
                        original: this.constructImageUrl(
                            illustData.urls.original
                        )
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
                            original: this.constructImageUrl(
                                illustData.urls.original
                            )
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
                this.config.pixiv.following.userId
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
