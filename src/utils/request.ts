import type { Context } from 'koishi'
import type { GeneralImageData, SourceProvider } from './type'
import { taskTime } from './taskManager'
import { processImage } from './imageProcessing'
import { getProvider } from '../providers'
import { logger } from '../index'
import { detectMimeType } from './mimeUtils'
import type {} from '@koishijs/plugin-proxy-agent'
import type Config from '../config'

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
      headers.Referer = provider.getMeta().referer
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
  if (!getProvider(ctx, config, specificProvider)) {
    throw new Error('未选择有效的图片来源，请检查配置')
  }

  const metadata = await getProvider(ctx, config, specificProvider).getMetaData(
    { context: ctx },
    {
      r18: config.isR18 && Math.random() < config.r18P,
      excludeAI: config.excludeAI,
      // 直接传递标签，不再预处理标签，留给各个提供器处理
      tag: tag || void 0,
      proxy: config.baseUrl ? config.baseUrl : void 0
    }
  )

  if (metadata.status === 'error') return null

  const [buffer, mimeType] = await fetchImageBuffer(
    ctx,
    config,
    metadata.data.url,
    getProvider(ctx, config, specificProvider)
  )

  const data = await taskTime(ctx, 'processImage', async () => {
    const imageBuffer = Buffer.from(buffer)
    return await processImage(
      ctx,
      imageBuffer,
      config,
      !!metadata.data.urls?.regular
    )
  })

  return {
    ...metadata.data.raw,
    data,
    mimeType,
    raw: metadata.data.raw
  }
}
