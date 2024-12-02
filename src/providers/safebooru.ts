import { Context } from 'koishi'
import { Config } from '../config'
import {
    CommonSourceRequest,
    GeneralImageData,
    ImageMetaData,
    ImageSourceMeta,
    SourceProvider,
    SourceResponse
} from '../utils/type'
import { logger } from '../index'

interface SafebooruPost {
    id: number
    directory: string
    image: string
    tags: string
    owner: string
    rating: string
    sample: boolean
    created_at: string
}

export class SafebooruSourceProvider extends SourceProvider {
    static description = '通过 Safebooru API 获取图片'
    protected endpoint = 'https://safebooru.org/index.php'

    async getMetaData(
        { context }: { context: Context },
        props: CommonSourceRequest
    ): Promise<SourceResponse<ImageMetaData>> {
        try {
            const params = {
                page: 'dapi',
                s: 'post',
                q: 'index',
                json: '1',
                limit: '1',
                tags: `${props.tag ? props.tag.replace(/\|/g, ' ') : ''} sort:random`
            }

            const url = `${this.endpoint}?${new URLSearchParams(params).toString()}`

            const res = await context.http.get<SafebooruPost[]>(url, {
                proxyAgent: this.config.isProxy
                    ? this.config.proxyHost
                    : undefined
            })

            if (!Array.isArray(res) || res.length === 0) {
                return {
                    status: 'error',
                    data: new Error('No image data returned')
                }
            }

            const post = res[0]
            const originalUrl = `https://safebooru.org/images/${post.directory}/${post.image}?${post.id}`
            const sampleUrl = post.sample
                ? `https://safebooru.org/samples/${post.directory}/sample_${post.image}?${post.id}`
                : originalUrl

            const generalImageData: GeneralImageData = {
                id: post.id,
                title: `Safebooru - ${post.id}`,
                author: post.owner.replace(/_/g, ' '),
                r18: !['safe', 'general'].includes(post.rating),
                tags: post.tags.split(' '),
                extension: post.image.split('.').pop(),
                aiType: 0,
                uploadDate: new Date(post.created_at).getTime(),
                urls: {
                    original: originalUrl,
                    regular: sampleUrl
                }
            }

            logger.debug('成功获取图片元数据', { metadata: generalImageData })

            return {
                status: 'success',
                data: {
                    url: this.config.compress ? sampleUrl : originalUrl,
                    urls: {
                        regular: sampleUrl,
                        original: originalUrl
                    },
                    raw: generalImageData
                }
            }
        } catch (error) {
            return {
                status: 'error',
                data: error
            }
        }
    }

    getMeta(): ImageSourceMeta {
        return {
            referer: 'https://safebooru.org'
        }
    }

    setConfig(config: Config) {
        this.config = config
    }
}
