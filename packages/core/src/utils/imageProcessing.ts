import type { Context } from 'koishi'
import type Config from '../config'
import { logger } from '../index'
import { quality_image, mix_image, process_image } from 'pixluna-rslib'

function getPngDeflateLevel(config: Config): number {
  return Math.max(0, Math.min(9, config.imageProcessing.compressionLevel ?? 6))
}

function mapFlipMode(mode: Config['imageProcessing']['flipMode']): number {
  switch (mode) {
    case 'horizontal':
      return 1
    case 'vertical':
      return 2
    case 'both':
      return 3
    default:
      return 0
  }
}

export async function qualityImage(
  imageBuffer: Buffer,
  config: Config
): Promise<Buffer> {
  try {
    const level = getPngDeflateLevel(config)
    const out = quality_image(new Uint8Array(imageBuffer), level)
    return Buffer.from(out)
  } catch (err) {
    logger.warn('qualityImage: decode failed, return original buffer', {
      err
    })
    return imageBuffer
  }
}

export async function mixImage(
  imageBuffer: Buffer,
  config: Config
): Promise<Buffer> {
  try {
    if (config.imageProcessing.compress) {
      imageBuffer = await qualityImage(imageBuffer, config)
    }
    const level = getPngDeflateLevel(config)
    const out = mix_image(new Uint8Array(imageBuffer), level)
    return Buffer.from(out)
  } catch (err) {
    logger.warn('mixImage: decode failed, return original buffer', { err })
    return imageBuffer
  }
}

export async function processImage(
  ctx: Context,
  imageBuffer: Buffer,
  config: Config,
  hasRegularUrl: boolean
): Promise<Buffer> {
  try {
    const out = process_image(
      new Uint8Array(imageBuffer),
      !!config.imageProcessing.isFlip,
      mapFlipMode(config.imageProcessing.flipMode),
      !!config.imageProcessing.confusion,
      !!config.imageProcessing.compress,
      getPngDeflateLevel(config),
      !!hasRegularUrl
    )
    return Buffer.from(out)
  } catch (err) {
    ctx.logger?.warn?.('processImage: decode failed, return original buffer', {
      err
    })
    return imageBuffer
  }
}

