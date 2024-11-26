import { Context, h } from 'koishi'
import type Config from './config'
import { ParallelPool, taskTime } from './utils/taskManager'
import { createAtMessage, render } from './utils/renderer'
import { getProvider, Providers } from './main/providers'
import { logger } from './index'

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
    const availableSources = Object.entries(Providers)
    const message = h('message', [
        h('text', { content: '可用的图片来源：\n' }),
        ...availableSources.map(([source, Provider]) =>
            h('text', { content: `- ${source}: ${Provider.description}\n` })
        )
    ])
    await session.send(message)
}
