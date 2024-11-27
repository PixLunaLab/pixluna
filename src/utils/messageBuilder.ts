import { h } from 'koishi'
import { GeneralImageData } from './type'

export function renderImageMessage(
    image: GeneralImageData & { data: Buffer; mimeType: string }
): h {
    return h('', [
        h.image(image.data, image.mimeType),
        h('text', { content: `\ntitle：${image.title}\n` }),
        h('text', { content: `id：${image.id}\n` }),
        h('text', {
            content: `tags：${image.tags.map((item: string) => '#' + item).join(' ')}\n`
        })
    ])
}

export function createAtMessage(userId: string, content: string) {
    return h('', [
        h('at', { id: userId }),
        h('text', { content: ` ${content}` })
    ])
}