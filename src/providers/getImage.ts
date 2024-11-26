import { Context } from 'koishi'
import type Config from '../config'
import { PixivGetByID } from './pixiv/pixivGetByID'
import { createAtMessage, renderImageMessage } from '../utils/renderer'

export async function getPixivImageByID(
    ctx: Context,
    config: Config,
    userId: string,
    options: { pid: string; page: number }
) {
    if (!options.pid) {
        return createAtMessage(userId, '请提供作品 ID (PID)')
    }

    const provider = new PixivGetByID(ctx, config)

    try {
        const imageData = await provider.getImageWithBuffer(
            options.pid,
            options.page
        )
        return renderImageMessage(imageData)
    } catch (e) {
        ctx.logger.error(e)
        const errorMessage = e instanceof Error ? e.message : String(e)
        return createAtMessage(userId, errorMessage || '获取图片失败')
    }
}
