import { setTimeout as delay } from "node:timers/promises"

export class ParallelPool<T = unknown> {
  private readonly tasks: (() => Promise<T>)[] = []

  constructor(
    private readonly limit: number,
    private readonly interval = 0
  ) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("最大并发数必须是正整数")
    }
  }

  add(task: () => Promise<T>): this {
    this.tasks.push(task)
    return this
  }

  async run(): Promise<T[]> {
    const results: T[] = new Array(this.tasks.length)
    let cursor = 0
    let nextStart = 0
    const worker = async () => {
      while (cursor < this.tasks.length) {
        const index = cursor++
        const now = Date.now()
        const wait = Math.max(0, nextStart - now)
        nextStart = Math.max(now, nextStart) + this.interval
        if (wait) await delay(wait)
        results[index] = await this.tasks[index]()
      }
    }
    await Promise.all(Array.from({ length: Math.min(this.limit, this.tasks.length) }, worker))
    return results
  }
}
