import { Context } from 'koishi'
import { Config } from '../config'
import { taskTime } from './taskManager'
import type {} from '@koishijs/plugin-proxy-agent'
import { logger } from '../index'
import { SourceProvider } from './type'

function detectMimeType(buffer: ArrayBuffer): string {
    const arr = new Uint8Array(buffer).subarray(0, 4)
    let header = ''
    for (let i = 0; i < arr.length; i++) {
        header += arr[i].toString(16)
    }

    switch (header) {
        case '89504e47':
            return 'image/png'
        case 'ffd8ffe0':
        case 'ffd8ffe1':
        case 'ffd8ffe2':
            return 'image/jpeg'
        case '47494638':
            return 'image/gif'
        default:
            return 'application/octet-stream'
    }
}

export const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

export async function fetchImageBuffer(
    ctx: Context,
    config: Config,
    url: string,
    provider?: SourceProvider
): Promise<[ArrayBuffer, string]> {
    return taskTime(ctx, 'fetchImage', async () => {
        const headers: Record<string, string> = {
            'User-Agent': USER_AGENT
        }

        if (provider?.getMeta?.()?.referer) {
            headers['Referer'] = provider.getMeta().referer
        }

        const response = await ctx.http.get(url, {
            responseType: 'arraybuffer',
            proxyAgent: config.isProxy ? config.proxyHost : undefined,
            headers
        })

        const mimeType = detectMimeType(response)
        logger.debug('检测到MIME类型', { mimeType })

        return [response, mimeType]
    })
}
