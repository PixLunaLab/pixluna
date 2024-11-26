import { Context } from 'koishi'
import Config from '../config'
import { GeneralImageData } from '../utils/type'
import { taskTime } from '../utils/data'
import { mixImage, qualityImage } from '../utils/imageProcessing'
import { fetchImageBuffer } from '../utils/imageFetcher'
import { getProvider } from './providers'

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

    // 将 ArrayBuffer 转换为 Buffer
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
