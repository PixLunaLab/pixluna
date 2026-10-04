import assert from "node:assert/strict"
import { test, onTestFinished, vi } from "vitest"
import type { Context as KoishiContext, Element, h as H } from "koishi"
import type * as Koishi from "koishi"
const { Bot, Context, h } = require("koishi") as typeof Koishi
import Vips from "wasm-vips"
import { apply, Config } from "../src/index"
import { ParallelPool } from "../src/utils/taskManager"
import { getRemoteImage, fetchImageBuffer } from "../src/utils/request"
import { processImage } from "../src/utils/imageProcessing"
import { registerProvider } from "../src/utils/providerRegistry"
import {
  SourceProvider,
  type CommonSourceRequest,
  type ImageMetaData,
  type SourceResponse
} from "../src/utils/type"
import * as shuffling from "../src/utils/shuffle"

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEn8AAAAASUVORK5CYII=",
  "base64"
)

class TestBot extends Bot<KoishiContext> {
  messages: { id: string; content: Element[] }[] = []
  deleted: string[] = []
  constructor(ctx: KoishiContext) {
    super(ctx, {}, "test")
    this.user = { id: "bot" }
  }
  async createMessage(_channel: string, content: H.Fragment) {
    const message = { id: String(this.messages.length + 1), content: h.normalize(content) }
    this.messages.push(message)
    return [{ id: message.id }]
  }
  async deleteMessage(_channel: string, id: string) {
    this.deleted.push(id)
  }
}

function createApp() {
  const ctx = new Context()
  const config = Config({} as Config)
  config.apiDelay = 0
  config.messageBefore = ""
  config.forwardMessage = false
  let requests = 0
  // HTTP is the only external boundary replaced; commands and sessions are real Koishi objects.
  ctx.http = {
    post: async (_url: string, body: { tag?: string[] }) => {
      requests++
      const found = body.tag?.includes("blue sky")
      return {
        error: "",
        data: [
          {
            pid: found ? 42 : 7,
            title: found ? "matched artwork" : "random artwork",
            author: "artist",
            r18: false,
            tags: ["blue sky"],
            ext: "png",
            aiType: 0,
            uploadDate: 0,
            urls: { original: "https://images.example/test.png" }
          }
        ]
      }
    },
    get: async () => png
  } as unknown as KoishiContext["http"]
  apply(ctx, config)
  const botScope = ctx.plugin(TestBot)
  const bot = ctx.bots[0] as TestBot
  const session = bot.session({
    user: { id: "user" },
    channel: { id: "channel", type: 0 },
    message: { id: "incoming", content: "" }
  })
  return {
    ctx,
    config,
    bot,
    session,
    requests: () => requests,
    close: async () => {
      botScope.dispose()
      await ctx.stop()
    }
  }
}

test("queued work obeys maxConcurrency and preserves request order", async () => {
  const pool = new ParallelPool<number>(2)
  const gates = Array.from({ length: 3 }, () => Promise.withResolvers<void>())
  const started: number[] = []
  for (let i = 0; i < 3; i++)
    pool.add(async () => {
      started.push(i)
      await gates[i].promise
      return i
    })
  assert.deepEqual(started, [])
  const result = pool.run()
  assert.deepEqual(started, [0, 1])
  gates[1].resolve()
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(started, [0, 1, 2])
  gates[2].resolve()
  gates[0].resolve()
  assert.deepEqual(await result, [0, 1, 2])
})
test("keyword text, alias and explicit -t select the intended artwork", async () => {
  const app = createApp()
  onTestFinished(() => app.close())
  await app.session.execute("pixluna blue sky")
  assert.match(app.bot.messages.at(-1)!.content.join(""), /id：42/)
  await app.session.execute('色图 -t "blue sky" ignored')
  assert.match(app.bot.messages.at(-1)!.content.join(""), /id：42/)
  assert.equal(app.requests(), 2)
})
test("invalid quantities and unknown sources do not make upstream requests", async () => {
  const app = createApp()
  onTestFinished(() => app.close())
  for (const command of ["pixluna -n 0", "pixluna -n -1", "pixluna -n 1.5", "pixluna -s missing"]) {
    await app.session.execute(command)
  }
  assert.equal(app.requests(), 0)
  assert.equal(app.bot.messages.length, 4)
  assert.match(app.bot.messages[3].content.join(""), /未找到提供程序/)
})
test("quantity cap, forward nodes, hidden tags and recall work through a session", async () => {
  const app = createApp()
  onTestFinished(() => {
    vi.useRealTimers()
    return app.close()
  })
  app.config.autoRecall.enable = true
  app.config.forwardMessage = true
  app.config.showTags = false
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  await app.session.execute("pixluna -n 12 -s lolicon blue sky")
  assert.equal(app.requests(), 10)
  const envelope = app.bot.messages[0].content[0]
  assert.equal(envelope.attrs.forward, true)
  assert.equal(envelope.children.filter((node) => node.type === "message").length, 10)
  assert.doesNotMatch(envelope.toString(), /tags：/)
  await vi.advanceTimersByTimeAsync(app.config.autoRecall.delay * 1000)
  assert.deepEqual(app.bot.deleted, [app.bot.messages[0].id])
})

test("provider selection is reused for metadata, configuration and image referer", async () => {
  const config = Config({} as Config)
  config.defaultSourceProvider = ["test-a", "test-b"]
  const random = vi
    .spyOn(shuffling, "shuffleArray")
    .mockImplementationOnce((values) => [...values])
    .mockImplementationOnce((values) => [...values].reverse())
    .mockImplementationOnce((values) => [...values])
  onTestFinished(() => random.mockRestore())
  let initialized = false
  let selected = ""
  let referer = ""
  class Provider extends SourceProvider {
    endpoint = "https://a.example/"
    setConfig() {
      initialized = true
    }
    getMeta() {
      return { referer: this.endpoint }
    }
    async getMetaData(
      _context: { context: KoishiContext },
      _props: CommonSourceRequest
    ): Promise<SourceResponse<ImageMetaData>> {
      selected = this.endpoint
      const raw = {
        id: 1,
        title: "",
        author: "",
        r18: false,
        tags: [],
        extension: "png",
        aiType: 0,
        uploadDate: 0,
        urls: { original: `${this.endpoint}image.png` }
      }
      return { status: "success", data: { url: raw.urls.original, urls: raw.urls, raw } }
    }
  }
  class OtherProvider extends Provider {
    endpoint = "https://b.example/"
  }
  registerProvider("test-a", Provider)
  registerProvider("test-b", OtherProvider)
  // Only the downloader's HTTP response is stubbed.
  const ctx = {
    http: {
      get: async (_url: string, options: { headers: { Referer: string } }) => {
        referer = options.headers.Referer
        return png
      }
    }
  } as unknown as KoishiContext
  try {
    const result = await getRemoteImage(ctx, "", config)
    assert.equal(initialized, true)
    assert.equal(referer, selected)
    assert.equal(result.mimeType, "image/png")
    assert.deepEqual(result.data, png)
  } finally {
    globalThis.__PIXLUNA_PROVIDERS__!.delete("test-a")
    globalThis.__PIXLUNA_PROVIDERS__!.delete("test-b")
  }
})

test("HTML upstream responses are rejected rather than sent as PNG", async () => {
  const config = Config({} as Config)
  // The response deliberately represents a CDN challenge page.
  const ctx = {
    http: { get: async () => Buffer.from("<html>challenge</html>") }
  } as unknown as KoishiContext
  await assert.rejects(
    fetchImageBuffer(ctx, config, "https://images.example/fail"),
    /不是支持的图片格式/
  )
})

test("real Vips processing flips both axes, changes one pixel, and compresses to WebP", async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.stop())
  const vips = await Vips({ dynamicLibraries: [] })
  vips.concurrency(1)
  vips.Cache.max(0)
  const image = vips.Image.newFromMemory(
    Uint8Array.from([10, 20, 30, 40]),
    2,
    2,
    1,
    vips.BandFormat.uchar
  )
  const input = Buffer.from(image.writeToBuffer(".png", { compression: 0 }))
  image.delete()
  const config = Config({} as Config)
  config.imageProcessing.isFlip = true
  config.imageProcessing.flipMode = "both"
  const flipped = vips.Image.newFromBuffer(await processImage(ctx, input, config, false))
  assert.deepEqual(Array.from(flipped.writeToMemory()), [40, 30, 20, 10])
  flipped.delete()
  config.imageProcessing.isFlip = false
  config.imageProcessing.confusion = true
  const confused = vips.Image.newFromBuffer(await processImage(ctx, input, config, false))
  const changed = Array.from(confused.writeToMemory()).filter(
    (pixel, index) => pixel !== [10, 20, 30, 40][index]
  )
  assert.equal(changed.length, 1)
  confused.delete()
  config.imageProcessing.confusion = false
  config.imageProcessing.compress = true
  const source = vips.Image.black(64, 64)
  const uncompressed = Buffer.from(source.writeToBuffer(".png", { compression: 0 }))
  source.delete()
  const compressed = await processImage(ctx, uncompressed, config, false)
  assert.ok(compressed.byteLength < uncompressed.byteLength)
  const output = vips.Image.newFromBuffer(compressed)
  assert.equal(output.width, 64)
  assert.equal(output.height, 64)
  assert.equal(compressed.subarray(8, 12).toString(), "WEBP")
  output.delete()
  await assert.rejects(processImage(ctx, Buffer.from("corrupt image"), config, false))
})
