import { Context } from 'koishi'
import { getPixivImageByID } from '../providers/getImage'
import Config from '../config'

export async function commandGet(ctx: Context, config: Config) {
    ctx.command('pixluna.get', '直接通过图源获取图片')

    ctx.command('pixluna.get.pixiv <pid:string>', '通过 pid 获取图片')
        .option('pages', '-p <pages:number>', { fallback: 0 })
        .action(async ({ session, options }, pid) => {
            return await getPixivImageByID(ctx, config, session.userId, {
                pid,
                page: options.pages
            })
        })
}
