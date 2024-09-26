import { Bot, Context, Dict, remove, Schema, sleep, Time } from 'koishi'

export interface Config {
  timeout?: number
}

export const Config: Schema<Config> = Schema.object({
  timeout: Schema.natural().role('ms').default(Time.hour).description('消息保留的时间。'),
})

export const name = 'recall'

export function apply(ctx: Context, { timeout }: Config) {
  const logger = ctx.logger('recall')
  ctx.i18n.define('zh-CN', require('./locales/zh-CN'))

  ctx = ctx.guild()
  const recent: Dict<string[]> = {}

  ctx.on('send', (session) => {
    const list = recent[session.channelId] ||= []
    list.unshift(session.messageId)
    ctx.setTimeout(() => remove(list, session.messageId), timeout)
  })

  ctx.command('recall [count:number]', { authority: 2 })
    .action(async ({ session }, count = 1) => {
      const list = recent[session.channelId]
      if (session.quote) {
        const index = list?.findIndex(id => id === session.quote.id)
        if (index) list.splice(index, 1)
        await deleteMessage(ctx, session.bot, session.channelId, session.quote.id)
        return
      }
      if (!list) return session.text('.no-recent')
      const removal = list.splice(0, count)
      const delay = ctx.root.config.delay.broadcast
      if (!list.length) delete recent[session.channelId]
      for (let index = 0; index < removal.length; index++) {
        if (index && delay) await sleep(delay)
        await deleteMessage(ctx, session.bot, session.channelId, removal[index])
      }
    })
}

// Export the deleteMessage function
export async function deleteMessage(ctx: Context, bot: Bot, channelId: string, messageId: string) {
  try {
    await bot.deleteMessage(channelId, messageId)
  } catch (error) {
    const logger = ctx.logger('recall')
    logger.warn(error)
  }
}
