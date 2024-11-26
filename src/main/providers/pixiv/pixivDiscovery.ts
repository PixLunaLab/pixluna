import { Context } from 'koishi'
import type { Config } from '../../../config'
import type {
    CommonSourceRequest,
    GeneralImageData,
    ImageMetaData,
    ImageSourceMeta,
    SourceResponse
} from '../../../utils/type'
import { SourceProvider } from '../../../utils/type'
import { shuffleArray } from '../../../utils/shuffle'
import { logger } from '../../../index'
import { USER_AGENT } from '../../../utils/imageFetcher'

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
            width: number
            height: number
            pageCount: number
            xRestrict: number
            createDate: string
        }[]
    }
}

export interface PixivDiscoverySourceRequest {
    mode: string
    limit: number
}

export class PixivDiscoverySourceProvider extends SourceProvider {
    static DISCOVERY_URL = 'https://www.pixiv.net/ajax/illust/discovery'
    static ILLUST_PAGES_URL =
        'https://www.pixiv.net/ajax/illust/{ARTWORK_ID}/pages'

    static description =
        '获取 Pixiv 推荐图片，可以通过 Pixiv 账号获取个性化推荐'

    constructor(ctx: Context, config: Config) {
        super(ctx, config)
    }

    async getMetaData(
        { context }: { context: Context },
        props: CommonSourceRequest
    ): Promise<SourceResponse<ImageMetaData>> {
        logger.debug('开始获取 Pixiv Discovery 元数据')
        const requestParams: PixivDiscoverySourceRequest = {
            mode: props.r18 ? 'r18' : 'all',
            limit: 8 // 修改为获取8张图片
        }

        const url = `${PixivDiscoverySourceProvider.DISCOVERY_URL}?mode=${requestParams.mode}&limit=${requestParams.limit}`

        const headers = {
            Referer: 'https://www.pixiv.net/',
            'User-Agent': USER_AGENT
        }

        // 如果配置了 PHPSESSID，则添加到 Cookie 中
        if (this.config.pixiv.phpSESSID) {
            headers['Cookie'] = `PHPSESSID=${this.config.pixiv.phpSESSID}`
        }

        try {
            const discoveryRes = await context.http.get<PixivResponse>(url, {
                headers,
                proxyAgent: this.config.isProxy
                    ? this.config.proxyHost
                    : undefined
            })

            if (discoveryRes.error || !discoveryRes.body.illusts.length) {
                return {
                    status: 'error',
                    data: new Error(discoveryRes.message || '未找到插画')
                }
            }

            const shuffledIllusts = shuffleArray(discoveryRes.body.illusts)
            const selectedIllust = shuffledIllusts[0]

            const illustPagesUrl =
                PixivDiscoverySourceProvider.ILLUST_PAGES_URL.replace(
                    '{ARTWORK_ID}',
                    selectedIllust.id
                )
            const illustPagesRes = await context.http.get(illustPagesUrl, {
                headers: {
                    Referer: 'https://www.pixiv.net/',
                    'User-Agent': USER_AGENT
                },
                proxyAgent: this.config.isProxy
                    ? this.config.proxyHost
                    : undefined
            })

            if (illustPagesRes.error || !illustPagesRes.body.length) {
                return {
                    status: 'error',
                    data: new Error('无法获取原图链接')
                }
            }

            const originalUrl = illustPagesRes.body[0].urls.original

            // 使用 base URL 构造图片链接
            const baseUrl = this.config.baseUrl || 'i.pximg.net'
            const constructedUrl = originalUrl.replace('i.pximg.net', baseUrl)

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
                    original: constructedUrl,
                    regular: selectedIllust.url.replace('i.pximg.net', baseUrl)
                }
            }

            logger.debug('成功获取 Pixiv Discovery 图片元数据', {
                metadata: generalImageData
            })

            return {
                status: 'success',
                data: {
                    url: constructedUrl,
                    urls: {
                        regular: selectedIllust.url.replace(
                            'i.pximg.net',
                            baseUrl
                        ),
                        original: constructedUrl
                    },
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

    setConfig(config: Config) {
        this.config = config
    }

    getMeta(): ImageSourceMeta {
        return {
            referer: 'https://www.pixiv.net/'
        }
    }
}
