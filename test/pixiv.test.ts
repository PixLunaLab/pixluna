import assert from "node:assert/strict"
import { test, vi, onTestFinished } from "vitest"
import type { Context } from "koishi"
import type { Config } from "../src/config"
import {
  PixivDiscoverySourceProvider,
  PixivFollowingSourceProvider,
  PixivGetByIDProvider
} from "../src/providers/pixiv"
import * as shuffling from "../src/utils/shuffle"

const config = {
  isR18: true,
  r18P: 0.5,
  excludeAI: false,
  isProxy: true,
  proxyHost: "http://127.0.0.1:10809",
  baseUrl: "",
  maxConcurrency: 1,
  forwardMessage: false,
  defaultSourceProvider: ["pdiscovery"],
  isLog: false,
  pixiv: { phpSESSID: "test-cookie", refreshToken: "", userId: "7" },
  imageProcessing: {
    confusion: false,
    compress: false,
    compressionLevel: 80,
    isFlip: false,
    flipMode: "horizontal"
  },
  autoRecall: { enable: false, delay: 1000 },
  messageBefore: "",
  showTags: true,
  apiDelay: 0
} satisfies Config
type Options = { headers?: Record<string, string>; proxyAgent?: string }
type Call = { method: string; url: string; body?: string; options: Options }
function context(handler: (call: Call) => unknown): Context {
  return {
    http: {
      get: (url: string, options: Options) => handler({ method: "GET", url, options }),
      post: (url: string, body: string, options: Options) =>
        handler({ method: "POST", url, body, options })
    }
  } as unknown as Context
}
function appArtwork(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: "cat moon",
    user: { id: 8, name: "artist" },
    x_restrict: 0,
    create_date: "2025-01-01T00:00:00Z",
    tags: [{ name: "cat" }, { name: "moon" }],
    illust_ai_type: 1,
    type: "illust",
    page_count: 1,
    meta_single_page: { original_image_url: `https://i.pximg.net/img/${id}.jpg` },
    meta_pages: [],
    ...overrides
  }
}
interface WebArtwork {
  id: string
  title: string
  userName: string
  xRestrict: number
  createDate: string
  tags: { tags: { tag: string }[] }
  aiType: number
  pageCount: number
  illustType: number
}
function webArtwork(id: string, overrides: Partial<WebArtwork> = {}): WebArtwork {
  return {
    id,
    title: "cat moon",
    userName: "artist",
    xRestrict: 0,
    createDate: "2025-01-01T00:00:00Z",
    tags: { tags: [{ tag: "cat" }, { tag: "moon" }] },
    aiType: 1,
    pageCount: 1,
    illustType: 0,
    ...overrides
  }
}
const tokenConfig = {
  ...config,
  pixiv: { ...config.pixiv, refreshToken: "test-refresh" }
} satisfies Config
const oauth = {
  response: {
    access_token: "test-access",
    refresh_token: "test-rotated",
    expires_in: 3600,
    user: { id: "7" }
  }
}

test("cookie discovery enforces every keyword, request-specific safe and AI filters", async () => {
  const details: Record<string, WebArtwork> = {
    "1": webArtwork("1", { xRestrict: 1 }),
    "2": webArtwork("2", { aiType: 2 }),
    "3": webArtwork("3", { title: "cat", tags: { tags: [{ tag: "cat" }] } }),
    "4": webArtwork("4")
  }
  const ctx = context(({ url, options }) => {
    assert.equal(options.proxyAgent, config.proxyHost)
    assert.equal(options.headers?.Cookie, "PHPSESSID=test-cookie")
    if (url.includes("/discovery"))
      return { error: false, body: { illusts: Object.keys(details).map((id) => ({ id })) } }
    const match = /\/illust\/(\d+)(\/pages)?$/.exec(url)
    assert.ok(match, url)
    return {
      error: false,
      body: match[2]
        ? [{ urls: { original: `https://i.pximg.net/img/${match[1]}.jpg` } }]
        : details[match[1]]
    }
  })
  const provider = new PixivDiscoverySourceProvider(ctx, config)
  const result = await provider.getMetaData(
    { context: ctx },
    { tag: "cat,moon", r18: false, excludeAI: true }
  )
  assert.equal(result.status, "success")
  assert.equal(result.data.raw.id, "4")
  const absent = await provider.getMetaData({ context: ctx }, { tag: "cat,missing", r18: false })
  assert.equal(absent.status, "error")
})

test("cookie following accepts sole last candidate instead of off-by-one rejection", async () => {
  const ctx = context(({ url }) => {
    if (url.includes("/following")) return { error: false, body: { users: [{ userId: "8" }] } }
    if (url.includes("/profile/all")) return { error: false, body: { illusts: { "42": null } } }
    if (url.endsWith("/42/pages"))
      return { error: false, body: [{ urls: { original: "https://i.pximg.net/img/42.jpg" } }] }
    if (url.endsWith("/42")) return { error: false, body: webArtwork("42") }
    throw new Error(`Unexpected endpoint: ${url}`)
  })
  const result = await new PixivFollowingSourceProvider(ctx, config).getMetaData(
    { context: ctx },
    { r18: false }
  )
  assert.equal(result.status, "success")
  assert.equal(result.data.raw.id, "42")
})

test("token exchange is shared across providers and concurrent requests; direct pages use actual URLs", async () => {
  let exchanges = 0
  const ctx = context(async ({ method, url, body, options }) => {
    assert.equal(options.proxyAgent, config.proxyHost)
    if (method === "POST") {
      exchanges++
      const form = new URLSearchParams(body)
      assert.equal(form.get("grant_type"), "refresh_token")
      assert.equal(form.get("refresh_token"), "test-refresh")
      assert.ok(options.headers?.["X-Client-Hash"])
      await Promise.resolve()
      return oauth
    }
    assert.equal(options.headers?.Authorization, "Bearer test-access")
    assert.equal(options.headers?.Cookie, undefined)
    if (url.includes("/v1/illust/detail"))
      return {
        illust: appArtwork(42, {
          page_count: 2,
          meta_pages: [
            { image_urls: { original: "https://i.pximg.net/img/page-a.png" } },
            { image_urls: { original: "https://i.pximg.net/img/page-b.jpg" } }
          ]
        })
      }
    if (url.includes("/v1/search/illust"))
      return {
        illusts: [
          appArtwork(1, { x_restrict: 1 }),
          appArtwork(2, { illust_ai_type: 2 }),
          appArtwork(3)
        ]
      }
    throw new Error(`Unexpected endpoint: ${url}`)
  })
  const direct = new PixivGetByIDProvider(ctx, tokenConfig)
  const discovery = new PixivDiscoverySourceProvider(ctx, tokenConfig)
  const [page, selected] = await Promise.all([
    direct.getImageByPid(ctx, "42", 1),
    discovery.getMetaData({ context: ctx }, { tag: "cat,moon", r18: false, excludeAI: true })
  ])
  assert.equal(exchanges, 1)
  assert.equal(page.status, "success")
  assert.equal(page.data.url, "https://i.pximg.net/img/page-b.jpg")
  assert.equal(selected.status, "success")
  assert.equal(selected.data.raw.id, "3")
  assert.equal((await direct.getImageByPid(ctx, "42", -1)).status, "error")
  assert.equal((await direct.getImageByPid(ctx, "42", 2)).status, "error")
  assert.equal((await direct.getImageByPid(ctx, "42x", 0)).status, "error")
})

test("short-lived token refresh uses rotated refresh token and does not cross contexts", async () => {
  let exchanges = 0
  const handler = ({ method, body }: Call) => {
    if (method === "POST") {
      exchanges++
      assert.equal(
        new URLSearchParams(body).get("refresh_token"),
        exchanges === 2 ? "test-rotated" : "test-refresh"
      )
      return { response: { ...oauth.response, expires_in: exchanges === 1 ? 1 : 3600 } }
    }
    return { illust: appArtwork(42) }
  }
  const ctx = context(handler)
  const provider = new PixivGetByIDProvider(ctx, tokenConfig)
  assert.equal((await provider.getImageByPid(ctx, "42")).status, "success")
  assert.equal((await provider.getImageByPid(ctx, "42")).status, "success")
  const other = context(handler)
  assert.equal(
    (await new PixivGetByIDProvider(other, tokenConfig).getImageByPid(other, "42")).status,
    "success"
  )
  assert.equal(exchanges, 3)
})

test("token following paginates artist works and applies all filters", async () => {
  const ctx = context(({ method, url }) => {
    if (method === "POST") return oauth
    if (url.includes("/v1/user/following"))
      return { user_previews: [{ user: { id: 8 } }], next_url: null }
    if (url.includes("/v1/user/illusts") && url.includes("offset=30"))
      return { illusts: [appArtwork(3)], next_url: null }
    if (url.includes("/v1/user/illusts"))
      return {
        illusts: [appArtwork(1, { x_restrict: 1 }), appArtwork(2, { illust_ai_type: 2 })],
        next_url: "https://app-api.pixiv.net/v1/user/illusts?user_id=8&offset=30"
      }
    throw new Error(`Unexpected endpoint: ${url}`)
  })
  const result = await new PixivFollowingSourceProvider(ctx, tokenConfig).getMetaData(
    { context: ctx },
    { tag: "cat,moon", excludeAI: true, r18: false }
  )
  assert.equal(result.status, "success")
  assert.equal(result.data.raw.id, "3")
})

test("rejected token never falls back to cookie or leaks HTTP credentials", async () => {
  let gets = 0
  const ctx = context(({ method }) => {
    if (method === "POST") throw new Error("request included test-refresh and test-cookie")
    gets++
    return {}
  })
  const result = await new PixivGetByIDProvider(ctx, tokenConfig).getImageByPid(ctx, "42")
  assert.equal(result.status, "error")
  assert.equal(gets, 0)
  assert.doesNotMatch(String(result.data), /test-refresh|test-cookie/)
})

test("direct artworks obey configured R18 and AI blocks and reject missing authentication", async () => {
  const ctx = context(({ method }) =>
    method === "POST" ? oauth : { illust: appArtwork(42, { x_restrict: 1, illust_ai_type: 2 }) }
  )
  const safe = new PixivGetByIDProvider(ctx, { ...tokenConfig, isR18: false })
  assert.equal((await safe.getImageByPid(ctx, "42")).status, "error")
  const noAI = new PixivGetByIDProvider(ctx, { ...tokenConfig, excludeAI: true })
  assert.equal((await noAI.getImageByPid(ctx, "42")).status, "error")
  const missing = new PixivGetByIDProvider(ctx, {
    ...config,
    pixiv: { ...config.pixiv, phpSESSID: "" }
  })
  assert.equal((await missing.getImageByPid(ctx, "42")).status, "error")
})

test("upstream errors and off-origin pagination remain errors instead of unrelated fallback", async () => {
  let foreignCalls = 0
  const ctx = context(({ method, url }) => {
    if (method === "POST") return oauth
    if (url.startsWith("https://unexpected.example")) foreignCalls++
    return { user_previews: [], next_url: "https://unexpected.example/steal" }
  })
  const result = await new PixivFollowingSourceProvider(ctx, tokenConfig).getMetaData(
    { context: ctx },
    {}
  )
  assert.equal(result.status, "error")
  assert.equal(foreignCalls, 0)
  const bad = context(() => ({ error: true, body: null }))
  assert.equal(
    (await new PixivDiscoverySourceProvider(bad, config).getMetaData({ context: bad }, {})).status,
    "error"
  )
})

test("token artwork selection reaches shared image download using Pixiv referer and proxy", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS9sAAAAASUVORK5CYII=",
    "base64"
  )
  let downloaded = false
  const ctx = context(({ method, url, options }) => {
    if (method === "POST") return oauth
    if (url.includes("/v1/illust/detail")) return { illust: appArtwork(42) }
    assert.equal(url, "https://i.pximg.net/img/42.jpg")
    assert.equal(options.headers?.Referer, "https://www.pixiv.net/")
    assert.equal(options.headers?.Authorization, undefined)
    assert.equal(options.proxyAgent, config.proxyHost)
    downloaded = true
    return png
  })
  const result = await new PixivGetByIDProvider(ctx, tokenConfig).getImageWithBuffer("42")
  assert.equal(downloaded, true)
  assert.equal(result.mimeType, "image/png")
  assert.deepEqual(result.data, png)
})

test.each(["discovery", "following"])(
  "cookie %s skips animations without discarding later matching images",
  async (mode) => {
    const random = vi.spyOn(shuffling, "shuffleArray").mockImplementation((values) => [...values])
    onTestFinished(() => random.mockRestore())
    const ctx = context(({ url }) => {
      if (url.includes("/discovery"))
        return { error: false, body: { illusts: [{ id: "1" }, { id: "2" }] } }
      if (url.includes("/following")) return { error: false, body: { users: [{ userId: "8" }] } }
      if (url.includes("/profile/all"))
        return { error: false, body: { illusts: { "1": null, "2": null } } }
      if (url.endsWith("/1")) return { error: false, body: webArtwork("1", { illustType: 2 }) }
      if (url.endsWith("/2")) return { error: false, body: webArtwork("2") }
      if (url.endsWith("/2/pages"))
        return { error: false, body: [{ urls: { original: "https://i.pximg.net/img/2.jpg" } }] }
      throw new Error(`Unexpected endpoint: ${url}`)
    })
    const Provider =
      mode === "discovery" ? PixivDiscoverySourceProvider : PixivFollowingSourceProvider
    const result = await new Provider(ctx, config).getMetaData({ context: ctx }, { r18: false })
    assert.equal(result.status, "success")
    if (result.status === "success") assert.equal(result.data.raw.id, "2")
    const direct = await new PixivGetByIDProvider(ctx, config).getImageByPid(ctx, "1")
    assert.equal(direct.status, "error")
  }
)
