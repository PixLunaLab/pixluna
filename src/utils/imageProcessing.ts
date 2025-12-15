import type { Context } from 'koishi'
import type Config from '../config'
import { logger } from '../index'
import Vips from 'wasm-vips'

export async function detectImageFormat(
  buffer: Buffer
): Promise<string | null> {
  if (buffer.length < 12) return null

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png'
  }

  // GIF: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif'
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }

  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return 'image/bmp'
  }

  // AVIF: ... 66 74 79 70 61 76 69 66
  if (buffer.length >= 12) {
    const avifCheck = buffer.subarray(4, 12).toString('ascii')
    if (avifCheck === 'ftypavif' || avifCheck === 'ftypavis') {
      return 'image/avif'
    }
  }

  return null
}

const vipsPromise = Vips({
  dynamicLibraries: []
}).then((vips) => {
  vips.concurrency(1)
  vips.Cache.max(0)
  return vips
})

let vipsInstance: Awaited<typeof vipsPromise> | null = null

async function getVips() {
  if (!vipsInstance) {
    vipsInstance = await vipsPromise
  }
  return vipsInstance
}

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
  const vips = await getVips()
  let image: any = null

  try {
    const level = getPngDeflateLevel(config)
    image = vips.Image.newFromBuffer(imageBuffer)
    const out = image.writeToBuffer('.png', { compression: level })
    return Buffer.from(out)
  } catch (err) {
    logger.warn('qualityImage: decode failed, return original buffer', {
      err
    })
    return imageBuffer
  } finally {
    if (image) {
      try {
        image[Symbol.dispose]()
      } catch (_e) {}
    }
  }
}

export async function mixImage(
  imageBuffer: Buffer,
  config: Config
): Promise<Buffer> {
  if (config.imageProcessing.compress) {
    imageBuffer = await qualityImage(imageBuffer, config)
  }

  const vips = await getVips()
  let image: any = null
  let black: any = null
  let sub: any = null
  let newImage: any = null

  try {
    image = vips.Image.newFromBuffer(imageBuffer)

    const randomX = Math.floor(Math.random() * image.width)
    const randomY = Math.floor(Math.random() * image.height)

    const pixel = image.getpoint(randomX, randomY)
    for (let i = 0; i < pixel.length; i++) {
      pixel[i] += pixel[i] < 255 ? 1 : -1
    }

    black = vips.Image.black(1, 1)
    sub = black.newFromImage(pixel)
    newImage = image.insert(sub, randomX, randomY)

    const level = getPngDeflateLevel(config)
    const out = newImage.writeToBuffer('.png', { compression: level })
    return Buffer.from(out)
  } catch (err) {
    logger.warn('mixImage: decode failed, return original buffer', { err })
    return imageBuffer
  } finally {
    if (newImage) newImage[Symbol.dispose]?.()
    if (sub) sub[Symbol.dispose]?.()
    if (black) black[Symbol.dispose]?.()
    if (image) image[Symbol.dispose]?.()
  }
}

export async function processImage(
  ctx: Context,
  imageBuffer: Buffer,
  config: Config,
  _hasRegularUrl: boolean
): Promise<Buffer> {
  const vips = await getVips()
  let image: any = null
  const intermediateImages: any[] = []

  try {
    image = vips.Image.newFromBuffer(imageBuffer)
    let processedImage = image

    if (config.imageProcessing.isFlip) {
      const flipMode = mapFlipMode(config.imageProcessing.flipMode)
      if (flipMode === 1) {
        const flipped = processedImage.flipHor()
        intermediateImages.push(flipped)
        processedImage = flipped
      } else if (flipMode === 2) {
        const flipped = processedImage.flipVer()
        intermediateImages.push(flipped)
        processedImage = flipped
      } else if (flipMode === 3) {
        const flippedH = processedImage.flipHor()
        intermediateImages.push(flippedH)
        const flipped = flippedH.flipVer()
        intermediateImages.push(flipped)
        processedImage = flipped
      }
    }

    if (config.imageProcessing.confusion) {
      const randomX = Math.floor(Math.random() * processedImage.width)
      const randomY = Math.floor(Math.random() * processedImage.height)

      const pixel = processedImage.getpoint(randomX, randomY)
      for (let i = 0; i < pixel.length; i++) {
        pixel[i] += pixel[i] < 255 ? 1 : -1
      }

      const black = vips.Image.black(1, 1)
      intermediateImages.push(black)
      const sub = black.newFromImage(pixel)
      intermediateImages.push(sub)
      const confused = processedImage.insert(sub, randomX, randomY)
      intermediateImages.push(confused)
      processedImage = confused
    }

    const level = getPngDeflateLevel(config)
    const out = processedImage.writeToBuffer('.png', { compression: level })
    return Buffer.from(out)
  } catch (err) {
    ctx.logger?.warn?.('processImage: decode failed, return original buffer', {
      err
    })
    return imageBuffer
  } finally {
    for (let i = intermediateImages.length - 1; i >= 0; i--) {
      intermediateImages[i]?.[Symbol.dispose]?.()
    }
    if (image) image[Symbol.dispose]?.()
  }
}
