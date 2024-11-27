import { Context, h } from 'koishi'
import Config from '../config'
import { getRemoteImage } from './request'
import { renderImageMessage } from './messageBuilder'

export async function render(
    ctx: Context,
    config: Config,
    tag?: string,
    specificProvider?: string
) {
    try {
        const image = await getRemoteImage(ctx, tag, config, specificProvider)

        if (!image) {
            return h('message', [h('text', { content: '没有获取到喵\n' })])
        }

        return renderImageMessage(image)
    } catch (e) {
        ctx.logger.error(e)

        return h('message', [h('text', { content: `图片获取失败了喵~，${e}` })])
    }
}
