import { SourceProvider } from "../utils/type";
import { LoliconSourceProvider } from "./providers/lolicon";
import { LolisukiSourceProvider } from "./providers/lolisuki";
import { PixivSourceProvider } from "./providers/pixiv";
import type { Config } from "../config";

export type ProviderTypes = "none" | "lolicon" | "lolisuki" | "pixiv";

export const Providers: {
  [K in ProviderTypes]: typeof SourceProvider;
} = {
  "none": null,
  "lolicon": LoliconSourceProvider,
  "lolisuki": LolisukiSourceProvider,
  "pixiv": PixivSourceProvider,
};

export function getProvider(config: Config): typeof SourceProvider {
  return Providers[config.defaultSourceProvider];
}
