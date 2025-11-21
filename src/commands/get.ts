import type { Context } from 'koishi'
import { getPixivImageByID } from '../providers/getImage'
import type Config from '../config'

export function commandGet(ctx: Context, config: Config) {
  ctx.command('pixluna.get', '直接通过图源获取图片')

  ctx
    .command('pixluna.get.pixiv <pid:string>', '通过 pid 获取图片')
    .option('pages', '-p <pages:number>', { fallback: 0 })
    .option('all', '-a')
    .action(async ({ session, options }, pid) => {
      return await getPixivImageByID(ctx, config, session.userId, {
        pid,
        page: options.pages,
        all: options.all
      })
    })
}
