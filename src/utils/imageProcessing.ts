import Vips from 'wasm-vips'
import type { Context } from 'koishi'
import type Config from '../config'

export async function qualityImage(
  _ctx: Context,
  imageBuffer: Buffer,
  config: Config
): Promise<Buffer> {
  const vips = await Vips()
  using image = vips.Image.newFromBuffer(imageBuffer)

  const qualifiedImage = image.writeToBuffer('.png', {
    Q: config.imageProcessing.compressQuality
  })

  return Buffer.from(qualifiedImage)
}

export async function mixImage(
  ctx: Context,
  imageBuffer: Buffer,
  config: Config
): Promise<Buffer> {
  if (config.imageProcessing.compress) {
    imageBuffer = await qualityImage(ctx, imageBuffer, config)
  }

  const vips = await Vips()
  using image = vips.Image.newFromBuffer(imageBuffer)

  const width = image.width
  const height = image.height
  const bands = image.bands

  const data = image.writeToBuffer('.raw')

  const dataArray = new Uint8Array(data.buffer)

  const randomX = Math.floor(Math.random() * width)
  const randomY = Math.floor(Math.random() * height)
  const idx = (randomY * width + randomX) * bands

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

  const buffer = Buffer.from(dataArray.buffer)
  using newImage = vips.Image.newFromBuffer(buffer)

  const processedImageBuffer = newImage.writeToBuffer('.png')

  return Buffer.from(processedImageBuffer)
}

async function flipImage(
  image: any,
  mode: Config['imageProcessing']['flipMode']
): Promise<any> {
  switch (mode) {
    case 'horizontal':
      return image.fliphor()
    case 'vertical':
      return image.flipver()
    case 'both':
      return image.flipver().fliphor()
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
  const vips = await Vips()
  using image = vips.Image.newFromBuffer(imageBuffer)

  let processedImage = image

  if (config.imageProcessing.isFlip) {
    processedImage = await flipImage(
      processedImage,
      config.imageProcessing.flipMode
    )
  }

  if (config.imageProcessing.confusion) {
    const buffer = Buffer.from(processedImage.writeToBuffer('.png'))
    return await mixImage(ctx, buffer, config)
  }
  if (config.imageProcessing.compress && !hasRegularUrl) {
    const buffer = Buffer.from(processedImage.writeToBuffer('.png'))
    return await qualityImage(ctx, buffer, config)
  }

  return Buffer.from(processedImage.writeToBuffer('.png'))
}
