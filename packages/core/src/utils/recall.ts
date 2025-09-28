import type { Bot, Context } from 'koishi'

export async function deleteMessage(
  ctx: Context,
  bot: Bot,
  channelId: string,
  messageId: string
) {
  try {
    await bot.deleteMessage(channelId, messageId)
  } catch (error) {
    ctx.logger('recall').warn('撤回消息时发生错误', {
      channelId,
      messageId,
      error
    })
  }
}

export async function setupAutoRecall(
  ctx: Context,
  session: any,
  messageIds: string[],
  timeout: number = 60000
) {
  if (!messageIds?.length) return

  const logger = ctx.logger('recall')
  logger.debug('设置消息自动撤回', {
    channelId: session.channelId,
    messageIds,
    timeout
  })

  setTimeout(async () => {
    for (const messageId of messageIds) {
      await deleteMessage(ctx, session.bot, session.channelId, messageId)
    }
  }, timeout)
}
