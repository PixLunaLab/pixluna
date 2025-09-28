import type { Context } from 'koishi'
import type Config from './config'
import { commandGet } from './commands/get'
import { commandSource } from './commands/source'

export function registerCommand(ctx: Context, config: Config) {
  commandGet(ctx, config)
  commandSource(ctx, config)
}
