import type { Context } from 'koishi'
import type { GeneralImageData, SourceProvider } from './type'
import { taskTime } from './taskManager'
import { processImage } from './imageProcessing'
import { getProvider } from '../providers'
import { logger } from '../index'
import { detect_mime } from '../wasm/bindings'
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

    const mimeType = detect_mime(new Uint8Array(response))
    logger.debug('检测到 MIME 类型', { mimeType })

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

  const hasRegular = !!metadata.data.urls?.regular
  const doFlip = !!config.imageProcessing.isFlip
  const doConfuse = !!config.imageProcessing.confusion
  const doCompress = !!config.imageProcessing.compress && !hasRegular

  const MAX_PROCESS_BYTES = 32 * 1024 * 1024
  const isTooLarge = (buffer as ArrayBuffer).byteLength >= MAX_PROCESS_BYTES

  if (!isTooLarge && (doFlip || doConfuse || doCompress)) {
    const data = await taskTime(ctx, 'processImage', async () => {
      const imageBuffer = Buffer.from(buffer)
      return await processImage(ctx, imageBuffer, config, hasRegular)
    })

    const processedMimeType = detect_mime(new Uint8Array(data))

    return {
      ...metadata.data.raw,
      data,
      mimeType: processedMimeType,
      raw: metadata.data.raw
    }
  } else {
    if (isTooLarge && (doFlip || doConfuse || doCompress)) {
      logger.warn('图片过大，已跳过处理并原样发送', {
        sizeMB:
          Math.round(((buffer as ArrayBuffer).byteLength / 1024 / 1024) * 10) /
          10
      })
    }
    const data = Buffer.from(buffer)
    return {
      ...metadata.data.raw,
      data,
      mimeType,
      raw: metadata.data.raw
    }
  }
}
