import { Context, h, Logger } from 'koishi'
import type Config from './config'
import { createLogger, setLoggerLevel } from './utils/logger'
import { getPixivImageByID } from './providers/getImage'
import { ParallelPool, taskTime } from './utils/taskManager'
import { render } from './utils/renderer'
import { getProvider, Providers } from './providers/main'
import { createAtMessage } from './utils/messageBuilder'

export let logger: Logger

export function apply(ctx: Context, config: Config) {
    logger = createLogger(ctx)
    setupLogger(config)

    // Main
    ctx.command('pixluna [tag:text]', '来张色图')
        .alias('色图')
        .option('number', '-n <value:number>', {
            fallback: 1
        })
        .option('source', '-s <source:string>', { fallback: '' })
        .action(async ({ session, options }, tag) => {
            return await handleMainCommand(ctx, config, session, options, tag)
        })

    ctx.command('pixluna.source', '显示可用的图片来源').action(
        async ({ session }) => {
            await handleSourceCommand(session)
        }
    )

    // Get
    ctx.command('pixluna.get', '直接通过图源获取图片')

    ctx.command('pixluna.get.pixiv <pid:string>', '通过 pid 获取图片')
        .option('pages', '-p <pages:number>', { fallback: 0 })
        .action(async ({ session, options }, pid) => {
            return await getPixivImageByID(ctx, config, session.userId, {
                pid,
                page: options.pages
            })
        })
}

async function handleMainCommand(
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

async function handleSourceCommand(session: any) {
    const availableSources = Object.entries(Providers)
    const message = h('message', [
        h('text', { content: '可用的图片来源：\n' }),
        ...availableSources.map(([source, Provider]) =>
            h('text', { content: `- ${source}: ${Provider.description}\n` })
        )
    ])
    await session.send(message)
}

function setupLogger(config: Config) {
    if (config.isLog) {
        setLoggerLevel(Logger.DEBUG)
    }
}

export * from './config'
