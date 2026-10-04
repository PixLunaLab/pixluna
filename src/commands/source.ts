import type { Context } from "koishi"
import type * as Koishi from "koishi"
import type Config from "../config"
import { listProviders, resolveProvider } from "../utils/providerRegistry"
const { h } = require("koishi") as typeof Koishi

export function commandSource(ctx: Context, _config: Config) {
  ctx.command("pixluna.source", "查看图源").action(async ({ session }) => {
    if (!session) return
    const availableAliases = listProviders()
    const message = h("message", [
      h("text", { content: "可用的图片来源：\n" }),
      ...availableAliases.map((alias) => {
        const Ctor = resolveProvider(alias)
        const desc = Ctor?.description || ""
        return h("text", { content: `- ${alias}: ${desc}\n` })
      })
    ])
    await session.send(message)
  })
}
