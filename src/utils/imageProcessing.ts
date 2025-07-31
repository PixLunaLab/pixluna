import { loadPyodide, type PyodideInterface } from 'pyodide'
import type { Context } from 'koishi'
import type Config from '../config'
import { logger } from '../index'

let pyodide: PyodideInterface | null = null
let pythonFunctionsLoaded = false

async function initPyodide(): Promise<PyodideInterface> {
  if (pyodide && pythonFunctionsLoaded) return pyodide

  if (!pyodide) {
    pyodide = await loadPyodide()
    logger.debug('Installing packages from Pyodide distribution...')
    await pyodide.loadPackage([
      'https://cdn.jsdelivr.net/pyodide/v0.28.0/full/pillow-11.2.1-cp313-cp313-pyodide_2025_0_wasm32.whl',
      'https://cdn.jsdelivr.net/pyodide/v0.28.0/full/numpy-2.2.5-cp313-cp313-pyodide_2025_0_wasm32.whl'
    ])
    logger.debug('Successfully installed packages from Pyodide distribution')
  }

  if (!pythonFunctionsLoaded) {
    try {
      pyodide.runPython(`
try:
    from PIL import Image
    import numpy as np
    print('PIL and numpy imported successfully')
except ImportError as e:
    print(f'Import error: {e}')
    raise e
      `)
    } catch (error) {
      logger.error('Failed to import required packages:', error)
      throw new Error('Required packages are not available')
    }

    pyodide.runPython(`
import io
import base64
from PIL import Image
import numpy as np
from js import Uint8Array

def buffer_to_image(buffer_data):
    buffer_bytes = bytes(buffer_data)
    return Image.open(io.BytesIO(buffer_bytes))

def image_to_buffer(image, format='PNG', quality=None):
    buffer = io.BytesIO()
    if format.upper() == 'PNG':
        if quality is not None:
            image.save(buffer, format=format, optimize=True)
        else:
            image.save(buffer, format=format)
    else:
        if quality is not None:
            image.save(buffer, format=format, quality=quality)
        else:
            image.save(buffer, format=format)
    return buffer.getvalue()

def compress_image(buffer_data, quality=80):
    image = buffer_to_image(buffer_data)

    if quality < 100:
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        return image_to_buffer(image, 'JPEG', quality)
    else:
        return image_to_buffer(image, 'PNG')

def mix_image_pixels(buffer_data):
    image = buffer_to_image(buffer_data)

    if image.mode != 'RGB':
        image = image.convert('RGB')

    width, height = image.size

    pixels = image.load()

    import random
    x = random.randint(0, width - 1)
    y = random.randint(0, height - 1)

    r, g, b = pixels[x, y]

    r = min(255, r + 1) if r < 255 else max(0, r - 1)
    g = min(255, g + 1) if g < 255 else max(0, g - 1)
    b = min(255, b + 1) if b < 255 else max(0, b - 1)

    pixels[x, y] = (r, g, b)

    return image_to_buffer(image, 'PNG')

def flip_image(buffer_data, mode='none'):
    image = buffer_to_image(buffer_data)

    if mode == 'horizontal':
        image = image.transpose(Image.FLIP_LEFT_RIGHT)
    elif mode == 'vertical':
        image = image.transpose(Image.FLIP_TOP_BOTTOM)
    elif mode == 'both':
        image = image.transpose(Image.FLIP_LEFT_RIGHT)
        image = image.transpose(Image.FLIP_TOP_BOTTOM)

    return image_to_buffer(image, 'PNG')
    `)
    pythonFunctionsLoaded = true
  }

  return pyodide
}

export async function qualityImage(
  _ctx: Context,
  imageBuffer: Buffer,
  config: Config
) {
  const py = await initPyodide()

  const uint8Array = new Uint8Array(imageBuffer)

  py.globals.set('buffer_data', uint8Array)
  py.globals.set('quality', config.imageProcessing.compressQuality)

  const result = py.runPython(`
compressed_buffer = compress_image(buffer_data, quality)
compressed_buffer
  `)

  return Buffer.from(result)
}

export async function mixImage(
  ctx: Context,
  imageBuffer: Buffer,
  config: Config
) {
  if (config.imageProcessing.compress) {
    imageBuffer = await qualityImage(ctx, imageBuffer, config)
  }

  const py = await initPyodide()

  const uint8Array = new Uint8Array(imageBuffer)

  py.globals.set('buffer_data', uint8Array)

  const result = py.runPython(`
mixed_buffer = mix_image_pixels(buffer_data)
mixed_buffer
  `)

  return Buffer.from(result)
}

async function flipImageBuffer(
  _ctx: Context,
  imageBuffer: Buffer,
  mode: Config['imageProcessing']['flipMode']
): Promise<Buffer> {
  const py = await initPyodide()

  const uint8Array = new Uint8Array(imageBuffer)

  py.globals.set('buffer_data', uint8Array)
  py.globals.set('mode', mode || 'none')

  const result = py.runPython(`
flipped_buffer = flip_image(buffer_data, mode)
flipped_buffer
  `)
  return Buffer.from(result)
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
