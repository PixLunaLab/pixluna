import sharp from 'sharp'
import type { Context } from 'koishi'
import type Config from '../config'

export async function qualityImage(
  _ctx: Context,
  imageBuffer: Buffer,
  config: Config
) {
  let image = sharp(imageBuffer)

  const qualifiedImage = await image
    .png({ quality: config.imageProcessing.compressQuality })
    .toBuffer()

  image.destroy()
  image = undefined

  return qualifiedImage
}

export async function mixImage(
  ctx: Context,
  imageBuffer: Buffer,
  config: Config
) {
  if (config.imageProcessing.compress) {
    imageBuffer = await qualityImage(ctx, imageBuffer, config)
  }

  let image = sharp(imageBuffer)

  const { width, height } = await image.metadata()

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })

  // 随机选择一个点进行修改
  const randomX = Math.floor(Math.random() * width)
  const randomY = Math.floor(Math.random() * height)
  const idx = (randomY * width + randomX) * info.channels

  // 修改 R 通道
  data[idx] = data[idx] + 1 <= 255 ? data[idx] + 1 : data[idx] - 1
  // 修改 G 通道
  data[idx + 1] =
    data[idx + 1] + 1 <= 255 ? data[idx + 1] + 1 : data[idx + 1] - 1
  // 修改 B 通道
  data[idx + 2] =
    data[idx + 2] + 1 <= 255 ? data[idx + 2] + 1 : data[idx + 2] - 1

  // 释放内存
  image.destroy()

  image = sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels
    }
  })

  const processedImageBuffer = await image.png().toBuffer()

  image.destroy()
  image = undefined

  return processedImageBuffer
}

async function flipImage(
  image: sharp.Sharp,
  mode: Config['imageProcessing']['flipMode']
): Promise<sharp.Sharp> {
  switch (mode) {
    case 'horizontal':
      return image.flop()
    case 'vertical':
      return image.flip()
    case 'both':
      return image.flip().flop()
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
  let image = sharp(imageBuffer)

  if (config.imageProcessing.isFlip) {
    image = await flipImage(image, config.imageProcessing.flipMode)
  }

  if (config.imageProcessing.confusion) {
    const result = await mixImage(ctx, await image.toBuffer(), config)
    image.destroy()
    return result
  }
  if (config.imageProcessing.compress && !hasRegularUrl) {
    const result = await qualityImage(ctx, await image.toBuffer(), config)
    image.destroy()
    return result
  }

  const result = await image.toBuffer()
  image.destroy()
  return result
}
