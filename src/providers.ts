import { Context } from 'koishi'
import { SourceProvider } from './utils/type'
import {
    LoliconSourceProvider,
    LolisukiSourceProvider
} from './providers/loliconLike'
import {
    PixivDiscoverySourceProvider,
    PixivFollowingSourceProvider
} from './providers/pixiv'
import type { Config } from './config'
import { shuffleArray } from './utils/shuffle'
import { DanbooruSourceProvider } from './providers/danbooru'
import { E621SourceProvider } from './providers/e621'
import { GelbooruSourceProvider } from './providers/gelbooru'

export type ProviderTypes =
    | 'lolicon'
    | 'lolisuki'
    | 'pdiscovery'
    | 'pfollowing'
    | 'danbooru'
    | 'e621'
    | 'gelbooru'

export const Providers: {
    [K in ProviderTypes]: typeof SourceProvider & { description: string }
} = {
    lolicon: LoliconSourceProvider,
    lolisuki: LolisukiSourceProvider,
    pdiscovery: PixivDiscoverySourceProvider,
    pfollowing: PixivFollowingSourceProvider,
    danbooru: DanbooruSourceProvider,
    e621: E621SourceProvider,
    gelbooru: GelbooruSourceProvider
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
