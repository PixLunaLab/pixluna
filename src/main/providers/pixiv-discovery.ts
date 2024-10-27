import { Context } from 'koishi'
import type { Config } from '../../config'
import type {
    CommonSourceRequest,
    ImageMetaData,
    GeneralImageData,
    SourceResponse
} from '../../utils/type'
import { SourceProvider } from '../../utils/type'
import { shuffleArray } from '../../utils/shuffle'
import { PixlunaLogger, createLogger } from '../../utils/logger'

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

    private logger: PixlunaLogger

    constructor(ctx: Context, config: Config) {
        super(ctx, config)
        this.logger = createLogger(ctx, config)
    }

    async getMetaData(
        { context }: { context: Context },
        props: CommonSourceRequest
    ): Promise<SourceResponse<ImageMetaData>> {
        this.logger.debug('开始获取 Pixiv Discovery 元数据')
        const requestParams: PixivDiscoverySourceRequest = {
            mode: props.r18 ? 'r18' : 'all',
            limit: 8 // 修改为获取8张图片
        }

        const url = `${PixivDiscoverySourceProvider.DISCOVERY_URL}?mode=${requestParams.mode}&limit=${requestParams.limit}`
        this.logger.debug(`请求 URL: ${url}`)

        const headers = {
            Referer: 'https://www.pixiv.net/',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
                this.logger.error('Pixiv Discovery API 返回错误或无插画', discoveryRes.error)
                return {
                    status: 'error',
                    data: new Error(discoveryRes.message || '未找到插画')
                }
            }

            this.logger.debug(`成功获取 ${discoveryRes.body.illusts.length} 张插画`)
            const shuffledIllusts = shuffleArray(discoveryRes.body.illusts)
            const selectedIllust = shuffledIllusts[0]
            this.logger.debug(`随机选择插画 ID: ${selectedIllust.id}`)

            const illustPagesUrl = PixivDiscoverySourceProvider.ILLUST_PAGES_URL.replace(
                '{ARTWORK_ID}',
                selectedIllust.id
            )
            const illustPagesRes = await context.http.get(illustPagesUrl, {
                headers: {
                    Referer: 'https://www.pixiv.net/',
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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

            this.logger.debug('成功获取图片元数据', JSON.stringify(generalImageData, null, 2))
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
            this.logger.error('获取 Pixiv Discovery 元数据时发生错误', error)
            return {
                status: 'error',
                data: error
            }
        }
    }

    setConfig(config: Config) {
        this.config = config
        this.logger = createLogger(this.ctx, config)
    }
}