import assert from "node:assert/strict"
import { test } from "vitest"
import type { Context } from "koishi"
import type { Config } from "../src/config"
import { DanbooruSourceProvider } from "../src/providers/danbooru"
import { GelbooruSourceProvider } from "../src/providers/gelbooru"
import { E621SourceProvider } from "../src/providers/e621"
import { YandeSourceProvider } from "../src/providers/yande"
import { SafebooruSourceProvider } from "../src/providers/safebooru"
import { LoliconSourceProvider } from "../src/providers/lolicon"

const config = {
  isR18: true,
  isProxy: false,
  imageProcessing: { compress: true },
  gelbooru: { keyPairs: [{ apiKey: "secret", userId: "42" }] }
} as unknown as Config

function contextWith(response: unknown, capture?: (url: string, body: unknown) => void): Context {
  return {
    http: {
      get: async (url: string, options: unknown) => {
        capture?.(url, options)
        return response
      },
      post: async (url: string, body: unknown) => {
        capture?.(url, body)
        return response
      }
    }
  } as unknown as Context
}

const booruPost = {
  id: 1,
  file_url: "https://example.org/original.png?token=value",
  sample_url: "https://example.org/sample.jpg",
  large_file_url: "https://example.org/sample.jpg",
  tags: "landscape",
  tag_string: "landscape",
  tag_string_artist: "artist",
  owner: "artist",
  author: "artist",
  rating: "g",
  created_at: 1700000000
}
const pixivPost = {
  pid: 1,
  p: 0,
  uid: 2,
  title: "Landscape",
  author: "Artist",
  r18: false,
  tags: ["landscape"],
  ext: "png",
  aiType: 1,
  uploadDate: 1700000000000,
  urls: { original: "https://example.org/original.png", regular: "https://example.org/sample.jpg" }
}

test("Gelbooru compresses to sample and includes both authentication fields", async () => {
  let requestUrl = ""
  const ctx = contextWith({ post: [booruPost] }, (url) => {
    requestUrl = url
  })
  const provider = new GelbooruSourceProvider(ctx, config)
  provider.setConfig(config)
  const result = await provider.getMetaData({ context: ctx }, { r18: false })
  assert.equal(result.status, "success")
  if (result.status !== "success") return
  assert.equal(result.data.url, booruPost.sample_url)
  assert.equal(result.data.raw.extension, "jpg")
  assert.equal(new URL(requestUrl).searchParams.get("user_id"), "42")
  assert.equal(new URL(requestUrl).searchParams.get("api_key"), "secret")
})

test("safe Danbooru requests reject sensitive and restricted responses even when globally enabled", async () => {
  for (const rating of ["s", "q", "e"]) {
    const ctx = contextWith([{ ...booruPost, rating }])
    const provider = new DanbooruSourceProvider(ctx, config)
    const result = await provider.getMetaData({ context: ctx }, { r18: false })
    assert.equal(result.status, "error")
  }
})

test("AI exclusion examines e621 meta tags rather than just general tags", async () => {
  const ctx = contextWith({
    posts: [
      {
        ...booruPost,
        rating: "s",
        file: { url: booruPost.file_url },
        sample: { url: null },
        tags: { general: ["landscape"], artist: ["artist"], meta: ["ai_generated"] }
      }
    ]
  })
  const result = await new E621SourceProvider(ctx, config).getMetaData(
    { context: ctx },
    { excludeAI: true }
  )
  assert.equal(result.status, "error")
})

test("legacy numeric timestamps and missing samples remain usable", async () => {
  const ctx = contextWith([{ ...booruPost, rating: "s", sample_url: "" }])
  const result = await new YandeSourceProvider(ctx, config).getMetaData({ context: ctx }, {})
  assert.equal(result.status, "success")
  if (result.status !== "success") return
  assert.equal(result.data.url, booruPost.file_url)
  assert.equal(result.data.raw.extension, "png")
  assert.equal(result.data.raw.uploadDate, 1700000000000)
})

test("Safebooru trusts supplied sample URL, not a guessed PNG sample filename", async () => {
  const ctx = contextWith([
    { ...booruPost, rating: "safe", directory: 1, image: "original.png", sample: true }
  ])
  const result = await new SafebooruSourceProvider(ctx, config).getMetaData({ context: ctx }, {})
  assert.equal(result.status, "success")
  if (result.status === "success") assert.equal(result.data.url, booruPost.sample_url)
})

test("Lolicon returns errors for disallowed AI, restricted responses, empty results and failed network requests", async () => {
  for (const response of [
    { error: "", data: [{ ...pixivPost, aiType: 2 }] },
    { error: "", data: [{ ...pixivPost, r18: true }] },
    { error: "", data: [] },
    { error: "upstream rejected request", data: [pixivPost] }
  ]) {
    const ctx = contextWith(response)
    const result = await new LoliconSourceProvider(ctx, config).getMetaData(
      { context: ctx },
      { r18: false, excludeAI: true }
    )
    assert.equal(result.status, "error")
  }
  const ctx = {
    http: {
      post: async () => {
        throw new Error("credential=secret")
      }
    }
  } as unknown as Context
  const result = await new LoliconSourceProvider(ctx, config).getMetaData({ context: ctx }, {})
  assert.equal(result.status, "error")
  assert.equal(String(result.data).includes("secret"), false)
})
