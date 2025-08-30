import type { Context } from 'koishi'
import type { SourceProvider } from './utils/type'
import type { Config } from './config'
import { shuffleArray } from './utils/shuffle'
import { resolveProvider } from './utils/providerRegistry'

import './providers/danbooru'
import './providers/e621'
import './providers/gelbooru'
import './providers/konachan'
import './providers/lolibooru'
import './providers/loliconLike'
import './providers/pixiv'
import './providers/safebooru'
import './providers/sankaku'
import './providers/yande'

export function getProvider(
  ctx: Context,
  config: Config,
  specificProvider?: string
): SourceProvider {
  if (specificProvider) {
    const ProviderClass = resolveProvider(specificProvider)
    if (ProviderClass) {
      return new ProviderClass(ctx, config)
    }
    throw new Error(`未找到提供程序：${specificProvider}`)
  }

  if (!config.defaultSourceProvider?.length) {
    throw new Error('未配置任何图片来源')
  }

  const shuffledProviders = shuffleArray(config.defaultSourceProvider)
  const selectedProvider = shuffledProviders[0]
  const ProviderClass = resolveProvider(selectedProvider)

  if (ProviderClass) {
    return new ProviderClass(ctx, config)
  }
  throw new Error(`未找到提供程序：${selectedProvider}`)
}
