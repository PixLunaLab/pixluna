import { Context, Logger } from 'koishi'
import type Config from './config'
import { createLogger, setLoggerLevel } from './utils/logger'
import { handleSourceCommand, mainPixlunaCommand } from './command'
import { getPixivImageByID } from './main/providers/getImage'

export let logger: Logger

export function apply(ctx: Context, config: Config) {
    logger = createLogger(ctx)
    setupLogger(config)

    ctx.command('pixluna [tag:text]', '来张色图')
        .alias('色图')
        .option('n', '-n <value:number>', {
            fallback: 1
        })
        .option('source', '-s <source:string>', { fallback: '' })
        .action(async ({ session, options }, tag) => {
            return await mainPixlunaCommand(ctx, config, session, options, tag)
        })

    ctx.command('pixluna.source', '显示可用的图片来源').action(
        async ({ session }) => {
            await handleSourceCommand(session)
        }
    )

    ctx.command('pixluna.get', '直接通过图源获取图片')
        .subcommand('.pixiv <pid:string>', '通过 PID 获取 Pixiv 图片')
        .option('pages', '-p <pages:number>', { fallback: 0 })
        .action(async ({ session, options }, pid) => {
            return await getPixivImageByID(ctx, config, session.userId, {
                pid,
                page: options.pages
            })
        })
}

function setupLogger(config: Config) {
    if (config.isLog) {
        setLoggerLevel(Logger.DEBUG)
    }
}

export * from './config'
