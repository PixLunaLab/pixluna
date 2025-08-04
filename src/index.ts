import { type Context, h, Logger } from 'koishi'
import type Config from './config'
import { createLogger, setLoggerLevel } from './utils/logger'
import { ParallelPool, taskTime } from './utils/taskManager'
import { render } from './utils/renderer'
import { getProvider } from './providers'
import { createAtMessage } from './utils/messageBuilder'
import { registerCommand } from './command'
import { setupAutoRecall } from './utils/recall'

export let logger: Logger

export function apply(ctx: Context, config: Config) {
  logger = createLogger(ctx)
  setupLogger(config)

  ctx
    .command('pixluna', '来张色图')
    .alias('色图')
    .option('number', '-n <value:number>', {
      fallback: 1
    })
    .option('source', '-s <source:string>', { fallback: '' })
    .option('tag', '-t <tags:string>', { fallback: '' })
    .action(async ({ session, options }) => {
      if (!Number.isInteger(options.number) || options.number <= 0) {
        return createAtMessage(session.userId, '图片数量必须是大于0的整数哦~')
      }

      if (config.messageBefore) {
        await session.send(config.messageBefore)
      }

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

      for (let i = 0; i < Math.min(10, options.number); i++) {
        pool.add(
          taskTime(ctx, `${i + 1} image`, async () => {
            const message = await render(
              ctx,
              mergedConfig,
              options.tag,
              options.source
            )
            messages.push(message)
          })
        )
      }

      await pool.run()

      let messageIds: string[] = []
      try {
        const ids = await taskTime(ctx, 'send message', () => {
          const combinedMessage = h('message', messages)
          if (config.forwardMessage) {
            return session.send(
              h('message', { forward: config.forwardMessage }, messages)
            )
          }
          return session.send(combinedMessage)
        })
        messageIds = Array.isArray(ids) ? ids : [ids]
      } catch (e) {
        logger.error('发送消息时发生错误', { error: e })
        const errorMessageId = await session.send(
          createAtMessage(session.userId, '消息发送失败了喵，账号可能被风控\n')
        )
        if (errorMessageId) {
          messageIds = messageIds.concat(
            Array.isArray(errorMessageId) ? errorMessageId : [errorMessageId]
          )
        }
      }

      if (messageIds.length > 0 && config.autoRecall.enable) {
        await setupAutoRecall(
          ctx,
          session,
          messageIds,
          config.autoRecall.delay * 1000
        )
      }
    })

  registerCommand(ctx, config)
}

function setupLogger(config: Config) {
  if (config.isLog) {
    setLoggerLevel(Logger.DEBUG)
  }
}

export * from './config'
