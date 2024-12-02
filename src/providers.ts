import { Context } from 'koishi'
import { SourceProvider } from './utils/type'
import { DanbooruSourceProvider } from './providers/danbooru'
import { E621SourceProvider } from './providers/e621'
import { GelbooruSourceProvider } from './providers/gelbooru'
import { LolibooruSourceProvider } from './providers/lolibooru'
import {
    LoliconSourceProvider,
    LolisukiSourceProvider
} from './providers/loliconLike'
import {
    PixivDiscoverySourceProvider,
    PixivFollowingSourceProvider
} from './providers/pixiv'
import { SafebooruSourceProvider } from './providers/safebooru'
import { SankakuSourceProvider } from './providers/sankaku'
import type { Config } from './config'
import { shuffleArray } from './utils/shuffle'

export type ProviderTypes =
    | 'danbooru'
    | 'e621'
    | 'gelbooru'
    | 'lolibooru'
    | 'lolicon'
    | 'lolisuki'
    | 'pdiscovery'
    | 'pfollowing'
    | 'safebooru'
    | 'sankaku'

export const Providers: {
    [K in ProviderTypes]: typeof SourceProvider & { description: string }
} = {
    danbooru: DanbooruSourceProvider,
    e621: E621SourceProvider,
    gelbooru: GelbooruSourceProvider,
    lolibooru: LolibooruSourceProvider,
    lolicon: LoliconSourceProvider,
    lolisuki: LolisukiSourceProvider,
    pdiscovery: PixivDiscoverySourceProvider,
    pfollowing: PixivFollowingSourceProvider,
    safebooru: SafebooruSourceProvider,
    sankaku: SankakuSourceProvider
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
