import { Context, h } from 'koishi'
import type Config from './config'
import { ParallelPool, taskTime } from './utils/data'
import { render, renderImageMessage } from './main/renderer'
import { getProvider, Providers } from './main/providers'
import { logger } from './index'
import { PixivFollowingSourceProvider } from './main/providers/pixiv-following'
import { fetchImageBuffer } from './utils/imageFetcher'

import { GeneralImageData } from './utils/type'

export async function mainPixlunaCommand(
    ctx: Context,
    config: Config,
    session: any,
    options: any,
    tag?: string
) {
    if (!Number.isInteger(options.n) || options.n <= 0) {
        return createAtMessage(session.userId, '图片数量必须是大于0的整数哦~')
    }

    await session.send('不可以涩涩哦~')

    const sourceProviders = Array.isArray(config.defaultSourceProvider)
        ? config.defaultSourceProvider
        : [config.defaultSourceProvider]

    const mergedConfig: Config = {
        ...config,
        defaultSourceProvider: options.source
            ? [options.source]
            : sourceProviders
    }

    if (options.source) {
        try {
            getProvider(ctx, {
                ...mergedConfig,
                defaultSourceProvider: [options.source]
            })
        } catch (error) {
            return createAtMessage(session.userId, error.message)
        }
    }

    const messages: h[] = []
    const pool = new ParallelPool<void>(config.maxConcurrency)

    for (let i = 0; i < Math.min(10, options.n); i++) {
        pool.add(
            taskTime(ctx, `${i + 1} image`, async () => {
                const message = await render(
                    ctx,
                    mergedConfig,
                    tag,
                    options.source
                )
                messages.push(message)
            })
        )
    }

    await pool.run()

    let id: string[]
    try {
        id = await taskTime(ctx, 'send message', () => {
            const combinedMessage = h('message', messages)
            if (config.forwardMessage) {
                return session.send(
                    h('message', { forward: config.forwardMessage }, messages)
                )
            }
            return session.send(combinedMessage)
        })
    } catch (e) {
        logger.error('发送消息时发生错误', { error: e })
    }

    if (id === undefined || id.length === 0) {
        logger.error('消息发送失败', { reason: '账号可能被风控' })
        return createAtMessage(
            session.userId,
            '消息发送失败了喵，账号可能被风控\n'
        )
    }
}

export async function handleSourceCommand(session: any) {
    const availableSources = Object.keys(Providers)
    const message = h('message', [
        h('text', { content: '可用的图片来源：\n' }),
        ...availableSources.map((source) =>
            h('text', { content: `- ${source}\n` })
        )
    ])
    await session.send(message)
}

export async function getPixivImageByIDCommand(
    ctx: Context,
    config: Config,
    session: any,
    options: { pid: string; page: number }
) {
    if (!options.pid) {
        return createAtMessage(session.userId, '请提供作品 ID (PID)')
    }

    const provider = new PixivFollowingSourceProvider(ctx, config)
    const result = await provider.getImageByPid(ctx, options.pid, options.page)

    if (result.status === 'error') {
        const errorMessage =
            result.data instanceof Error
                ? result.data.message
                : String(result.data)
        return createAtMessage(session.userId, errorMessage || '获取图片失败')
    }

    try {
        const [arrayBuffer, mimeType] = await fetchImageBuffer(
            ctx,
            config,
            result.data.url,
            provider
        )
        const buffer = Buffer.from(arrayBuffer)

        const imageData: GeneralImageData & { data: Buffer; mimeType: string } =
            {
                data: buffer,
                mimeType,
                id: result.data.raw.id,
                title: result.data.raw.title,
                tags: result.data.raw.tags,
                author: result.data.raw.author,
                r18: result.data.raw.r18,
                extension: result.data.raw.extension,
                aiType: result.data.raw.aiType,
                uploadDate: result.data.raw.uploadDate,
                urls: result.data.raw.urls
            }

        return renderImageMessage(imageData)
    } catch (e) {
        ctx.logger.error(e)
        return createAtMessage(session.userId, `图片获取失败：${e}`)
    }
}

function createAtMessage(userId: string, content: string) {
    return h('', [
        h('at', { id: userId }),
        h('text', { content: ` ${content}` })
    ])
}
