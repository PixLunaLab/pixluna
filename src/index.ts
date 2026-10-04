import type { Context, Element, Logger as KoishiLogger } from "koishi"
import type * as Koishi from "koishi"
import type Config from "./config"
import { createLogger, setLoggerLevel } from "./utils/logger"
import { ParallelPool } from "./utils/taskManager"
import { render } from "./utils/renderer"
import { resolveProvider } from "./utils/providerRegistry"
import { createAtMessage, sendImageMessages } from "./utils/messageBuilder"
import { registerCommand } from "./command"
// Use Koishi's Node CJS entry in both bundles; its ESM loader fails on current Node.
const { Logger } = require("koishi") as typeof Koishi

export let logger: KoishiLogger

export const inject = ["http"]

export function apply(ctx: Context, config: Config) {
  logger = createLogger(ctx)
  setLoggerLevel(config.isLog ? Logger.DEBUG : Logger.INFO)

  ctx
    .command("pixluna [tag:text]", "来张色图")
    .alias("色图")
    .option("number", "-n <value:number>", {
      fallback: 1
    })
    .option("source", "-s <source:string>", { fallback: "" })
    .option("tag", "-t <tags:string>", { fallback: "" })
    .action(async ({ session, options = {} }, tag) => {
      if (!session) return
      const count = options.number ?? 1
      if (!Number.isInteger(count) || count <= 0) {
        return createAtMessage(session.userId, "图片数量必须是大于 0 的整数哦~")
      }

      if (options.source && !resolveProvider(options.source)) {
        return createAtMessage(session.userId, `未找到提供程序：${options.source}`)
      }
      if (!options.source && !config.defaultSourceProvider?.length) {
        return createAtMessage(session.userId, "未配置任何图片来源")
      }
      if (config.messageBefore) {
        await session.send(config.messageBefore)
      }
      const pool = new ParallelPool<Element>(config.maxConcurrency, config.apiDelay)
      for (let i = 0; i < Math.min(10, count); i++) {
        pool.add(() => render(ctx, config, options.tag || tag, options.source))
      }
      await sendImageMessages(ctx, config, session, await pool.run())
    })

  registerCommand(ctx, config)
}

export * from "./config"
