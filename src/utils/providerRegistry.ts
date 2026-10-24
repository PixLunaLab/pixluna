import type { Context } from "koishi"
import type { Config } from "../config"
import type { SourceProvider } from "./type"

export type ProviderConstructor = {
  new (ctx: Context, config: Config): SourceProvider
  description?: string
}

declare global {
  var __PIXLUNA_PROVIDERS__: Map<string, ProviderConstructor> | undefined
}

const providers = (globalThis.__PIXLUNA_PROVIDERS__ ??= new Map<string, ProviderConstructor>())

export function registerProvider(alias: string, provider: ProviderConstructor) {
  providers.set(alias, provider)
}

export function resolveProvider(name: string): ProviderConstructor | undefined {
  return providers.get(name)
}

export function listProviders(): string[] {
  return [...providers.keys()]
}
