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
import { logger } from '../../index'

export interface BaseSourceRequest {
    r18?: number
    num?: number
    uid?: number[]
    keyword?: string
    tag?: string[]
    size?: string[]
    proxy?: string
    excludeAI?: boolean
}

export interface BaseResponse {
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

export abstract class BaseLoliconProvider extends SourceProvider {
    protected declare ctx: Context
    protected declare config: Config
    protected abstract RANDOM_IMAGE_URL: string

    constructor(ctx: Context, config: Config) {
        super(ctx, config)
        this.ctx = ctx
        this.config = config
    }

    async getMetaData(
        { context }: { context: Context },
        props: CommonSourceRequest
    ): Promise<SourceResponse<ImageMetaData>> {
        const requestParams: BaseSourceRequest = {
            r18: props.r18 ? 1 : 0,
            num: 1,
            size: props.size,
            keyword: props.tag || undefined,
            tag: props.tag ? [props.tag] : undefined,
            excludeAI: props.excludeAI,
            proxy: props.proxy
        }

        const res = await context.http.post<BaseResponse>(
            this.RANDOM_IMAGE_URL,
            requestParams,
            {
                proxyAgent: this.config.isProxy
                    ? this.config.proxyHost
                    : undefined
            }
        )

        if (res.error || !res.data || res.data.length === 0) {
            return {
                status: 'error',
                data: new Error(res.error || 'No image data returned')
            }
        }

        const imageData = res.data[0]
        const url = this.config.compress
            ? imageData.urls.original
            : imageData.urls.regular || imageData.urls.original

        const generalImageData: GeneralImageData = {
            id: imageData.pid,
            title: imageData.title,
            author: imageData.author,
            r18: imageData.r18,
            tags: imageData.tags,
            extension: imageData.ext,
            aiType: imageData.aiType,
            uploadDate: imageData.uploadDate,
            urls: imageData.urls
        }

        logger.debug('成功获取图片元数据', { metadata: generalImageData })

        return {
            status: 'success',
            data: {
                url,
                urls: {
                    regular: imageData.urls.regular,
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
            referer: 'https://www.pixiv.net/'
        }
    }
} 