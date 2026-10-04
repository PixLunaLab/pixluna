import type { Context } from "koishi"
import type * as Koishi from "koishi"
import type Config from "../config"
import { getRemoteImage } from "./request"
import { renderImageMessage } from "./messageBuilder"
const { h } = require("koishi") as typeof Koishi

export async function render(
  ctx: Context,
  config: Config,
  tag?: string,
  specificProvider?: string
) {
  try {
    const image = await getRemoteImage(ctx, tag, config, specificProvider)
    return renderImageMessage(image, config)
  } catch (e) {
    ctx.logger("pixluna").warn("图片获取失败")

    const message = e instanceof Error ? e.message : "上游请求失败"
    return h("message", [h("text", { content: `图片获取失败了喵~，${message}` })])
  }
}
