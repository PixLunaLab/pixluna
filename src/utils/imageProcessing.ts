import type { Context } from 'koishi'
import type Config from '../config'
import { Jimp } from 'jimp'
import { logger } from '../index'

function getPngDeflateLevel(config: Config): number {
  return Math.max(0, Math.min(9, config.imageProcessing.compressionLevel ?? 6))
}

export async function qualityImage(
  imageBuffer: Buffer,
  config: Config
): Promise<Buffer> {
  try {
    const image = await Jimp.read(imageBuffer)
    const compressionLevel = getPngDeflateLevel(config)
    ;(image as any).deflateLevel = compressionLevel
    const buffer = await (image as any).getBuffer('image/png')
    return buffer
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
  if (config.imageProcessing.compress) {
    imageBuffer = await qualityImage(imageBuffer, config)
  }
  try {
    const image = await Jimp.read(imageBuffer)

    const width = image.bitmap.width
    const height = image.bitmap.height
    const dataArray = image.bitmap.data

    const randomX = Math.floor(Math.random() * width)
    const randomY = Math.floor(Math.random() * height)
    const idx = (randomY * width + randomX) * 4

    dataArray[idx] =
      dataArray[idx] + 1 <= 255 ? dataArray[idx] + 1 : dataArray[idx] - 1
    dataArray[idx + 1] =
      dataArray[idx + 1] + 1 <= 255
        ? dataArray[idx + 1] + 1
        : dataArray[idx + 1] - 1
    dataArray[idx + 2] =
      dataArray[idx + 2] + 1 <= 255
        ? dataArray[idx + 2] + 1
        : dataArray[idx + 2] - 1

    const compressionLevel = getPngDeflateLevel(config)
    const buffer = await (image as any).getBuffer('image/png', {
      deflateLevel: compressionLevel
    })
    return buffer
  } catch (err) {
    logger.warn('mixImage: decode failed, return original buffer', { err })
    return imageBuffer
  }
}

async function flipImage(
  image: any,
  mode: Config['imageProcessing']['flipMode']
): Promise<any> {
  switch (mode) {
    case 'horizontal':
      return image.flip(true, false)
    case 'vertical':
      return image.flip(false, true)
    case 'both':
      return image.flip(true, true)
    default:
      return image
  }
}

export async function processImage(
  ctx: Context,
  imageBuffer: Buffer,
  config: Config,
  hasRegularUrl: boolean
): Promise<Buffer> {
  try {
    const image = await Jimp.read(imageBuffer)

    let processedImage = image

    if (config.imageProcessing.isFlip) {
      processedImage = await flipImage(
        processedImage,
        config.imageProcessing.flipMode
      )
    }

    if (config.imageProcessing.confusion) {
      const buffer = await (processedImage as any).getBuffer('image/png')
      return await mixImage(buffer, config)
    }
    if (config.imageProcessing.compress && !hasRegularUrl) {
      const buffer = await (processedImage as any).getBuffer('image/png')
      return await qualityImage(buffer, config)
    }

    return await (processedImage as any).getBuffer('image/png')
  } catch (err) {
    ctx.logger?.warn?.('processImage: decode failed, return original buffer', {
      err
    })
    return imageBuffer
  }
}
