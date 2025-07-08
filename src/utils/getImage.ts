import type { Context } from 'koishi'
import type Config from '../config'
import { PixivGetByIDProvider } from '../providers/pixiv'

export async function getPixivImageByID(
  ctx: Context,
  config: Config,
  userId: string,
  options: { pid: string; page: number }
) {
  const provider = new PixivGetByIDProvider(ctx, config)
  return provider.getImageWithAtMessage(userId, options)
}
