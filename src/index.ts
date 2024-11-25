import { Context, Logger } from 'koishi'
import type Config from './config'
import { createLogger, setLoggerLevel } from './utils/logger'
import {
    getPixivImageByIDCommand,
    handleSourceCommand,
    mainPixlunaCommand
} from './command'

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

        .subcommand('.source', '显示可用的图片来源')
        .action(async ({ session }) => {
            await handleSourceCommand(session)
        })

        .subcommand('.get.pixiv', '通过 PID 获取 Pixiv 图片')
        .option('pid', '-p <pid:string>')
        .option('page', '-n <page:number>', { fallback: 0 })
        .action(async ({ session, options }) => {
            return await getPixivImageByIDCommand(ctx, config, session, options)
        })
}

function setupLogger(config: Config) {
    if (config.isLog) {
        setLoggerLevel(Logger.DEBUG)
    }
}

export * from './config'
