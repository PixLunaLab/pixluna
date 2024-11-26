import { Context } from 'koishi'
import type { Config } from '../../../config'
import type {
    GeneralImageData,
    ImageMetaData,
    ImageSourceMeta,
    SourceResponse
} from '../../../utils/type'
import { SourceProvider } from '../../../utils/type'
import { logger } from '../../../index'
import { USER_AGENT, fetchImageBuffer } from '../../../utils/imageFetcher'

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

export class PixivGetByID extends SourceProvider {
    static description = '通过作品ID获取Pixiv图片'
    static ILLUST_URL = 'https://www.pixiv.net/ajax/illust/{ARTWORK_ID}'

    constructor(ctx: Context, config: Config) {
        super(ctx, config)
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

    private async getIllustDetail(
        context: Context,
        illustId: string
    ): Promise<PixivIllustResponse> {
        const url = PixivGetByID.ILLUST_URL.replace(
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
} 