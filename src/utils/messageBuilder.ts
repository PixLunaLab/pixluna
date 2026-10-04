import type { Context, Session, Element } from "koishi"
import type * as Koishi from "koishi"
import type { GeneralImageData } from "./type"
import type { Config } from "../config"
import { setupAutoRecall } from "./recall"
const { h } = require("koishi") as typeof Koishi

export async function sendImageMessages(
  ctx: Context,
  config: Config,
  session: Session,
  messages: Element[]
) {
  let messageIds: string[]
  try {
    const content = config.forwardMessage
      ? h(
          "message",
          { forward: true },
          messages.map((message) =>
            h("message", message.type === "message" ? message.children : [message])
          )
        )
      : h("", messages)
    messageIds = await session.send(content)
  } catch {
    ctx.logger("pixluna").warn("发送消息失败")
    messageIds = await session.send(
      createAtMessage(session.userId, "消息发送失败了喵，账号可能被风控")
    )
  }
  if (config.autoRecall.enable && messageIds.length) {
    await setupAutoRecall(ctx, session, messageIds, config.autoRecall.delay * 1000)
  }
}

export function renderImageMessage(
  image: GeneralImageData & { data: Buffer; mimeType: string },
  config?: Config
): Element {
  const elements = [
    h.image(image.data, image.mimeType),
    h("text", { content: `\ntitle：${image.title}\n` }),
    h("text", { content: `id：${image.id}\n` })
  ]

  if (config?.showTags !== false) {
    elements.push(
      h("text", {
        content: `tags：${image.tags.map((item: string) => `#${item}`).join(" ")}\n`
      })
    )
  }

  return h("", elements)
}

export function createAtMessage(userId: string | undefined, content: string) {
  return h("", [userId ? h("at", { id: userId }) : "", h("text", { content: ` ${content}` })])
}

export function renderMultipleImageMessage(
  images: (GeneralImageData & { data: Buffer; mimeType: string })[],
  config?: Config
): Element {
  const elements = []

  // 添加第一张图片的信息
  const firstImage = images[0]
  elements.push(
    h("text", { content: `title：${firstImage.title}\n` }),
    h("text", { content: `id：${firstImage.id}\n` }),
    h("text", { content: `共 ${images.length} 页\n\n` })
  )

  if (config?.showTags !== false) {
    elements.push(
      h("text", {
        content: `tags：${firstImage.tags.map((item: string) => `#${item}`).join(" ")}\n\n`
      })
    )
  }

  // 添加所有图片
  images.forEach((image, index) => {
    elements.push(
      h("text", { content: `第 ${index + 1} 页:\n` }),
      h.image(image.data, image.mimeType),
      h("text", { content: "\n" })
    )
  })

  return h("", elements)
}
