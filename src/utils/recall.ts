import type { Bot, Context, Session } from "koishi"

export async function deleteMessage(ctx: Context, bot: Bot, channelId: string, messageId: string) {
  try {
    await bot.deleteMessage(channelId, messageId)
  } catch (error) {
    ctx.logger("recall").warn("撤回消息时发生错误", {
      channelId,
      messageId,
      error
    })
  }
}

export async function setupAutoRecall(
  ctx: Context,
  session: Session,
  messageIds: string[],
  timeout: number = 60000
) {
  const channelId = session.channelId
  if (!messageIds?.length || !channelId) return

  const logger = ctx.logger("recall")
  logger.debug("设置消息自动撤回", {
    channelId: session.channelId,
    messageIds,
    timeout
  })

  ctx.setTimeout(async () => {
    for (const messageId of messageIds) {
      await deleteMessage(ctx, session.bot, channelId, messageId)
    }
  }, timeout)
}
