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
