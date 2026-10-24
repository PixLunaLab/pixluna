import type { Context } from "koishi"
import type Config from "../config"
import Vips from "wasm-vips"

export function detectImageFormat(buffer: Buffer): string | null {
  if (buffer.length < 12) return null

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg"
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png"
  }

  // GIF: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return "image/gif"
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
    return "image/webp"
  }

  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return "image/bmp"
  }

  // AVIF: ... 66 74 79 70 61 76 69 66
  const format = buffer.subarray(4, 12).toString("ascii")
  if (format === "ftypavif" || format === "ftypavis") {
    return "image/avif"
  }

  return null
}

let vipsPromise: Promise<typeof Vips> | undefined

function getVips() {
  return (vipsPromise ??= Vips({ dynamicLibraries: [] }).then((vips) => {
    vips.concurrency(1)
    vips.Cache.max(0)
    return vips
  }))
}

function getCompressionLevel(config: Config): number {
  return Math.max(0, Math.min(9, config.imageProcessing.compressionLevel))
}

export async function processImage(
  ctx: Context,
  imageBuffer: Buffer,
  config: Config
): Promise<Buffer> {
  const vips = await getVips()
  let image: Vips.Image | null = null
  const intermediateImages: Vips.Image[] = []

  try {
    image = vips.Image.newFromBuffer(imageBuffer)
    if (image.getTypeof("n-pages") && image.getInt("n-pages") > 1) {
      throw new Error("动态图不支持图片处理，请关闭压缩、翻转和混淆后重试")
    }
    let processedImage = image

    if (config.imageProcessing.isFlip) {
      const { flipMode } = config.imageProcessing
      if (flipMode === "horizontal" || flipMode === "both") {
        const flipped = processedImage.flipHor()
        intermediateImages.push(flipped)
        processedImage = flipped
      }
      if (flipMode === "vertical" || flipMode === "both") {
        const flipped = processedImage.flipVer()
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

    const level = getCompressionLevel(config)
    const out = config.imageProcessing.compress
      ? processedImage.writeToBuffer(".webp", { Q: 100 - level * 8 })
      : processedImage.writeToBuffer(".png", { compression: level })
    return Buffer.from(out)
  } catch (error) {
    ctx.logger("pixluna").warn("图片处理失败")
    throw error instanceof Error ? error : new Error("图片处理失败")
  } finally {
    for (let i = intermediateImages.length - 1; i >= 0; i--) {
      intermediateImages[i][Symbol.dispose]()
    }
    image?.[Symbol.dispose]()
  }
}
