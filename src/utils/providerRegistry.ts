import type { Context } from 'koishi'
import type { Config } from '../config'
import type { SourceProvider } from './type'

export type ProviderCtor = new (ctx: Context, config: Config) => SourceProvider

declare global {
  var __PIX_LUNA_PROVIDERS__: Map<string, ProviderCtor> | undefined
}

const globalKey = '__PIX_LUNA_PROVIDERS__'

function ensureRegistry(): Map<string, ProviderCtor> {
  const g = globalThis as any
  if (!g[globalKey]) {
    g[globalKey] = new Map<string, ProviderCtor>()
  }
  return g[globalKey] as Map<string, ProviderCtor>
}

export function registerProvider(
  aliases: string | string[],
  ctor: ProviderCtor
) {
  const reg = ensureRegistry()
  const list = Array.isArray(aliases) ? aliases : [aliases]
  for (const raw of list) {
    const alias = String(raw).trim()
    if (!alias) continue
    const existing = reg.get(alias)
    if (!existing || existing !== ctor) {
      reg.set(alias, ctor)
    }
  }
}

export function resolveProvider(name: string): ProviderCtor | undefined {
  const reg = ensureRegistry()
  return reg.get(name)
}

export function listProviders(): string[] {
  const reg = ensureRegistry()
  return Array.from(reg.keys())
}
