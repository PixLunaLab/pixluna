import { Context } from 'koishi'
import { GeneralImageData, SourceProvider } from './type'
import { taskTime } from './taskManager'
import { mixImage, qualityImage } from './imageProcessing'
import { getProvider } from '../providers/main'
import { logger } from '../index'
import { detectMimeType } from './mimeUtils'
import type {} from '@koishijs/plugin-proxy-agent'
import Config from '../config'

export const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

export async function fetchImageBuffer(
    ctx: Context,
    config: Config,
    url: string,
    provider?: SourceProvider
): Promise<[ArrayBuffer, string]> {
    return taskTime(ctx, 'fetchImage', async () => {
        const headers: Record<string, string> = {
            'User-Agent': USER_AGENT
        }

        if (provider?.getMeta?.()?.referer) {
            headers['Referer'] = provider.getMeta().referer
        }

        const response = await ctx.http.get(url, {
            responseType: 'arraybuffer',
            proxyAgent: config.isProxy ? config.proxyHost : undefined,
            headers
        })

        const mimeType = detectMimeType(response)
        logger.debug('检测到MIME类型', { mimeType })

        return [response, mimeType]
    })
}

export async function getRemoteImage(
    ctx: Context,
    tag: string,
    config: Config,
    specificProvider?: string
): Promise<
    GeneralImageData & {
        data: Buffer
        mimeType: string
        raw: GeneralImageData
    }
> {
    const provider = getProvider(ctx, config, specificProvider)
    if (!provider) {
        throw new Error('未选择有效的图片来源，请检查配置')
    }

    let sharp
    try {
        sharp = (await import('sharp'))?.default
    } catch {}

    if ((config.imageConfusion || config.compress) && !sharp) {
        ctx.logger.warn(
            '启用了图片混淆或者图片压缩选项，但是没有检查到安装 sharp 服务，这些配置将无效。请安装 sharp 服务。'
        )
    }

    const commonParams = {
        r18: config.isR18 && Math.random() < config.r18P,
        excludeAI: config.excludeAI,
        tag: tag ? tag.split(' ').join('|') : void 0,
        proxy: config.baseUrl ? config.baseUrl : void 0
    }

    const metadata = await provider.getMetaData(
        {
            context: ctx
        },
        commonParams
    )

    if (metadata.status === 'error') {
        return null
    }

    const response = metadata.data
    const { url, urls } = response

    const [buffer, mimeType] = await fetchImageBuffer(
        ctx,
        config,
        url,
        provider
    )

    const imageBuffer = Buffer.from(buffer)

    const data = await taskTime(ctx, 'mixImage', async () => {
        if (config.imageConfusion && sharp) {
            return await mixImage(ctx, imageBuffer, config)
        }

        if (config.compress && !urls.regular && sharp) {
            return await qualityImage(ctx, imageBuffer, config)
        }

        return imageBuffer
    })

    return {
        ...metadata.data.raw,
        data,
        mimeType,
        raw: metadata.data.raw
    }
}
