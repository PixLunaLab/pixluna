import { h } from 'koishi'
import type { GeneralImageData } from './type'
import type { Config } from '../config'

export function renderImageMessage(
  image: GeneralImageData & { data: Buffer; mimeType: string },
  config?: Config
): h {
  const elements = [
    h.image(image.data, image.mimeType),
    h('text', { content: `\ntitle：${image.title}\n` }),
    h('text', { content: `id：${image.id}\n` })
  ]

  if (config?.showTags !== false) {
    elements.push(
      h('text', {
        content: `tags：${image.tags.map((item: string) => `#${item}`).join(' ')}\n`
      })
    )
  }

  return h('', elements)
}

export function createAtMessage(userId: string, content: string) {
  return h('', [h('at', { id: userId }), h('text', { content: ` ${content}` })])
}

export function renderMultipleImageMessage(
  images: (GeneralImageData & { data: Buffer; mimeType: string })[],
  config?: Config
): h {
  const elements = []

  // 添加第一张图片的信息
  const firstImage = images[0]
  elements.push(
    h('text', { content: `title：${firstImage.title}\n` }),
    h('text', { content: `id：${firstImage.id}\n` }),
    h('text', { content: `共 ${images.length} 页\n\n` })
  )

  if (config?.showTags !== false) {
    elements.push(
      h('text', {
        content: `tags：${firstImage.tags.map((item: string) => `#${item}`).join(' ')}\n\n`
      })
    )
  }

  // 添加所有图片
  images.forEach((image, index) => {
    elements.push(
      h('text', { content: `第 ${index + 1} 页:\n` }),
      h.image(image.data, image.mimeType),
      h('text', { content: '\n' })
    )
  })

  return h('', elements)
}
