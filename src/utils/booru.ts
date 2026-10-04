export function booruTags(tag = ""): string {
  return tag
    .split(/[,，]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ")
}

export function isSafeRating(rating: string): boolean {
  return ["s", "safe", "g", "general"].includes(rating)
}

export function isAiTag(tags: string[]): boolean {
  return tags.some((tag) =>
    /^(?:ai[_ -](?:generated|assisted)(?:_content)?|ai生成|aiイラスト|ai绘画|ai繪畫)$/i.test(tag)
  )
}

export function imageExtension(url: string): string {
  return new URL(url).pathname.split(".").pop() || ""
}

export function uploadTime(value: string | number | { s: number }): number {
  if (typeof value === "object") return value.s * 1000
  if (typeof value === "number") return value * 1000
  return new Date(value).getTime()
}
