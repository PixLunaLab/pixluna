import type { Context } from "koishi"
import type { SourceProvider } from "./utils/type"
import type { Config } from "./config"
import { shuffleArray } from "./utils/shuffle"
import { resolveProvider } from "./utils/providerRegistry"

import "./providers/danbooru"
import "./providers/e621"
import "./providers/gelbooru"
import "./providers/konachan"
import "./providers/lolicon"
import "./providers/pixiv"
import "./providers/safebooru"
import "./providers/sankaku"
import "./providers/yande"

export function getProvider(
  ctx: Context,
  config: Config,
  specificProvider?: string
): SourceProvider {
  const selectedProvider = specificProvider || shuffleArray(config.defaultSourceProvider)[0]
  if (!selectedProvider) {
    throw new Error("未配置任何图片来源")
  }
  const ProviderClass = resolveProvider(selectedProvider)
  if (!ProviderClass) {
    throw new Error(`未找到提供程序：${selectedProvider}`)
  }
  return new ProviderClass(ctx, config)
}
