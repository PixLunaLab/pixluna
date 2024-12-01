import { Context } from 'koishi'
import { SourceProvider } from './utils/type'
import { LoliconSourceProvider } from './providers/loliconLike'
import { LolisukiSourceProvider } from './providers/loliconLike'
import { PixivDiscoverySourceProvider } from './providers/pixiv/pixivDiscovery'
import { PixivFollowingSourceProvider } from './providers/pixiv/pixivFollowing'
import type { Config } from './config'
import { shuffleArray } from './utils/shuffle'

export type ProviderTypes = 'lolicon' | 'lolisuki' | 'pdiscovery' | 'pfollowing'

export const Providers: {
    [K in ProviderTypes]: typeof SourceProvider & { description: string }
} = {
    lolicon: LoliconSourceProvider,
    lolisuki: LolisukiSourceProvider,
    pdiscovery: PixivDiscoverySourceProvider,
    pfollowing: PixivFollowingSourceProvider
}

export function getProvider(
    ctx: Context,
    config: Config,
    specificProvider?: string
): SourceProvider {
    if (specificProvider) {
        const ProviderClass = Providers[specificProvider]
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
    const ProviderClass = Providers[selectedProvider]

    if (ProviderClass) {
        return new ProviderClass(ctx, config)
    }
    throw new Error(`未找到提供程序：${selectedProvider}`)
}
