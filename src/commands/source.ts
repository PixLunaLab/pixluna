import { type Context, h } from 'koishi'
import { Providers } from '../providers'
import type Config from '../config'

export function commandSource(ctx: Context, _config: Config) {
  ctx.command('pixluna.source', '查看图源').action(async ({ session }) => {
    const availableSources = Object.entries(Providers)
    const message = h('message', [
      h('text', { content: '可用的图片来源：\n' }),
      ...availableSources.map(([source, Provider]) =>
        h('text', { content: `- ${source}: ${Provider.description}\n` })
      )
    ])
    await session.send(message)
  })
}
