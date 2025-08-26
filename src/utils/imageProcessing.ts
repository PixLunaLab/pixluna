import { Jimp } from 'jimp'
import type { Context } from 'koishi'
import type Config from '../config'

async function toPNGBuffer(image: any): Promise<Buffer> {
  const buf = await image.getBuffer('image/png')
  return Buffer.from(buf as Buffer)
}

async function toJPEGBuffer(image: any, quality: number): Promise<Buffer> {
  image.quality(Math.max(1, Math.min(100, Math.round(quality))))
  const buf = await image.getBuffer('image/jpeg')
  return Buffer.from(buf as Buffer)
}

export async function qualityImage(
  _ctx: Context,
  imageBuffer: Buffer,
  config: Config
) {
  const img = await Jimp.read(imageBuffer)

  const q = config.imageProcessing.compressQuality
  if (q < 100) {
    const { data, width, height } = img.bitmap as any
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]
        const a = data[idx + 3] / 255
        if (a < 1) {
          data[idx] = Math.round(r * a + 255 * (1 - a))
          data[idx + 1] = Math.round(g * a + 255 * (1 - a))
          data[idx + 2] = Math.round(b * a + 255 * (1 - a))
          data[idx + 3] = 255
        }
      }
    }
    return await toJPEGBuffer(img as any, q)
  }

  return await toPNGBuffer(img)
}

export async function mixImage(
  ctx: Context,
  imageBuffer: Buffer,
  config: Config
) {
  if (config.imageProcessing.compress) {
    imageBuffer = await qualityImage(ctx, imageBuffer, config)
  }

  const img = await Jimp.read(imageBuffer)
  const width = img.bitmap.width
  const height = img.bitmap.height

  const x = Math.floor(Math.random() * width)
  const y = Math.floor(Math.random() * height)

  const adjust = (v: number) => {
    if (v < 255) return Math.min(255, v + 1)
    return Math.max(0, v - 1)
  }

  const idx = (width * y + x) << 2
  const data = (img.bitmap as any).data
  data[idx] = adjust(data[idx])
  data[idx + 1] = adjust(data[idx + 1])
  data[idx + 2] = adjust(data[idx + 2])

  return await toPNGBuffer(img)
}

async function flipImageBuffer(
  _ctx: Context,
  imageBuffer: Buffer,
  mode: Config['imageProcessing']['flipMode']
): Promise<Buffer> {
  const img = await Jimp.read(imageBuffer)

  if (mode === 'horizontal')
    (img as any).flip({ horizontal: true, vertical: false })
  else if (mode === 'vertical')
    (img as any).flip({ horizontal: false, vertical: true })
  else if (mode === 'both')
    (img as any).flip({ horizontal: true, vertical: true })

  return await toPNGBuffer(img)
}

export async function processImage(
  ctx: Context,
  imageBuffer: Buffer,
  config: Config,
  hasRegularUrl: boolean
): Promise<Buffer> {
  let currentBuffer = imageBuffer

  if (config.imageProcessing.isFlip) {
    currentBuffer = await flipImageBuffer(
      ctx,
      currentBuffer,
      config.imageProcessing.flipMode
    )
  }

  if (config.imageProcessing.confusion) {
    return await mixImage(ctx, currentBuffer, config)
  }

  if (config.imageProcessing.compress && !hasRegularUrl) {
    return await qualityImage(ctx, currentBuffer, config)
  }

  return currentBuffer
}
