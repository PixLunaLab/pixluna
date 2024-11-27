import { Context } from 'koishi'
import Config from './config'
import { commandGet } from './commands/get'
import { commandSource } from './commands/source'

export async function registerCommand(ctx: Context, config: Config) {
    await commandGet(ctx, config)
    await commandSource(ctx, config)
}
