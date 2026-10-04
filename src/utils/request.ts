import type { Context } from "koishi"
import type { GeneralImageData, ImageMetaData, SourceProvider } from "./type"
import { processImage, detectImageFormat } from "./imageProcessing"
import { getProvider } from "../providers"
import type {} from "@koishijs/plugin-proxy-agent"
import type Config from "../config"

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

export async function fetchImageBuffer(
  ctx: Context,
  config: Config,
  url: string,
  provider?: SourceProvider
): Promise<[ArrayBuffer, string]> {
  const meta = provider?.getMeta()
  const headers: Record<string, string> = { "User-Agent": meta?.userAgent || USER_AGENT }
  const referer = meta?.referer
  if (referer) headers.Referer = referer
  let response: ArrayBuffer
  try {
    response = await ctx.http.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      proxyAgent: config.isProxy ? config.proxyHost : "",
      headers
    })
  } catch {
    throw new Error("图片下载失败，请检查图源、代理和图片反代设置")
  }
  const buffer = Buffer.isBuffer(response) ? response : Buffer.from(response)
  const mimeType = await detectImageFormat(buffer)
  if (!mimeType) throw new Error("图源返回的不是支持的图片格式")
  return [response, mimeType]
}

export async function getRemoteImage(
  ctx: Context,
  tag: string | undefined,
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
  const r18 = config.isR18 && Math.random() < config.r18P
  const metadata = await provider.getMetaData(
    { context: ctx },
    {
      r18,
      excludeAI: config.excludeAI,
      tag: tag?.trim() || undefined,
      proxy: config.baseUrl || undefined
    }
  )
  if (metadata.status === "error") {
    throw metadata.data instanceof Error ? metadata.data : new Error("图源未返回符合条件的图片")
  }
  if ((!r18 && metadata.data.raw.r18) || (config.excludeAI && metadata.data.raw.aiType === 2)) {
    throw new Error("图源返回的图片不符合内容过滤设置")
  }
  return downloadImage(ctx, config, metadata.data, provider)
}

export async function downloadImage(
  ctx: Context,
  config: Config,
  metadata: ImageMetaData,
  provider: SourceProvider
): Promise<GeneralImageData & { data: Buffer; mimeType: string; raw: GeneralImageData }> {
  const [buffer, mimeType] = await fetchImageBuffer(ctx, config, metadata.url, provider)
  const original = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const hasRegular =
    metadata.url === metadata.urls.regular && metadata.urls.regular !== metadata.urls.original
  const needsProcessing =
    config.imageProcessing.isFlip ||
    config.imageProcessing.confusion ||
    (config.imageProcessing.compress && !hasRegular)
  let data: Buffer = original
  let resultMimeType = mimeType
  if (needsProcessing) {
    if (original.byteLength >= 32 * 1024 * 1024) {
      throw new Error("图片超过 32 MiB，无法安全进行图片处理")
    }
    data = await processImage(ctx, original, config, hasRegular)
    const processedMimeType = await detectImageFormat(data)
    if (!processedMimeType) throw new Error("图片处理结果格式无效")
    resultMimeType = processedMimeType
  }
  return { ...metadata.raw, data, mimeType: resultMimeType, raw: metadata.raw }
}
