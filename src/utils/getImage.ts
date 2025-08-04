import type { Context } from 'koishi'
import type Config from '../config'
import { PixivGetByIDProvider } from '../providers/pixiv'

export async function getPixivImageByID(
  ctx: Context,
  config: Config,
  userId: string,
  options: { pid: string; page: number; all?: boolean }
) {
  const provider = new PixivGetByIDProvider(ctx, config)
  if (options.all) {
    return provider.getAllImagesWithAtMessage(userId, options)
  }
  return provider.getImageWithAtMessage(userId, options)
}
