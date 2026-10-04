import type { Context } from "koishi"
import type * as Koishi from "koishi"
import { getPixivImageByID } from "../providers/getImage"
import type Config from "../config"
import { sendImageMessages } from "../utils/messageBuilder"
const { h } = require("koishi") as typeof Koishi

export function commandGet(ctx: Context, config: Config) {
  ctx.command("pixluna.get", "直接通过图源获取图片")

  ctx
    .command("pixluna.get.pixiv <pid:string>", "通过 pid 获取图片")
    .option("pages", "-p <pages:number>", { fallback: 0 })
    .option("all", "-a")
    .action(async ({ session, options = {} }, pid) => {
      if (!session) return
      if (config.messageBefore) await session.send(config.messageBefore)
      const message = await getPixivImageByID(ctx, config, session.userId || "", {
        pid,
        page: options.pages ?? 0,
        all: options.all
      })
      await sendImageMessages(ctx, config, session, h.normalize(message))
    })
}
