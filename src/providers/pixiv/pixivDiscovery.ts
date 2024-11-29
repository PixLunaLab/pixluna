import { Context } from 'koishi'
import type { Config } from '../../config'
import type {
    CommonSourceRequest,
    GeneralImageData,
    ImageMetaData,
    ImageSourceMeta,
    SourceResponse
} from '../../utils/type'
import { SourceProvider } from '../../utils/type'
import { shuffleArray } from '../../utils/shuffle'
import { logger } from '../../index'
import { USER_AGENT } from '../../utils/request'

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

export class PixivDiscoverySourceProvider extends SourceProvider {
    static DISCOVERY_URL = 'https://www.pixiv.net/ajax/illust/discovery'
    static ILLUST_PAGES_URL =
        'https://www.pixiv.net/ajax/illust/{ARTWORK_ID}/pages'

    // 提取公共请求配置
    private getRequestConfig(additionalHeaders = {}) {
        const headers = {
            Referer: 'https://www.pixiv.net/',
            'User-Agent': USER_AGENT,
            ...(this.config.pixiv.phpSESSID && {
                Cookie: `PHPSESSID=${this.config.pixiv.phpSESSID}`
            }),
            ...additionalHeaders
        }
        return {
            headers,
            proxyAgent: this.config.isProxy ? this.config.proxyHost : undefined
        }
    }

    setConfig(config: Config): void {
        this.config = config
    }

    async getMetaData(
        { context }: { context: Context },
        props: CommonSourceRequest
    ): Promise<SourceResponse<ImageMetaData>> {
        try {
            // 获取推荐列表
            const url = `${PixivDiscoverySourceProvider.DISCOVERY_URL}?mode=${props.r18 ? 'r18' : 'all'}&limit=8`
            const discoveryRes = await context.http.get<PixivResponse>(
                url,
                this.getRequestConfig()
            )

            if (discoveryRes.error || !discoveryRes.body.illusts.length) {
                return {
                    status: 'error',
                    data: new Error(discoveryRes.message || '未找到插画')
                }
            }

            // 随机选择一张图片
            const selectedIllust = shuffleArray(discoveryRes.body.illusts)[0]

            // 获取原图链接
            const illustPagesUrl =
                PixivDiscoverySourceProvider.ILLUST_PAGES_URL.replace(
                    '{ARTWORK_ID}',
                    selectedIllust.id
                )
            const illustPagesRes = await context.http.get(
                illustPagesUrl,
                this.getRequestConfig()
            )

            if (illustPagesRes.error || !illustPagesRes.body.length) {
                return { status: 'error', data: new Error('无法获取原图链接') }
            }

            const baseUrl = this.config.baseUrl || 'i.pximg.net'
            const originalUrl = illustPagesRes.body[0].urls.original.replace(
                'i.pximg.net',
                baseUrl
            )

            // 构造返回数据
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

    getMeta(): ImageSourceMeta {
        return {
            referer: 'https://www.pixiv.net/'
        }
    }
}
