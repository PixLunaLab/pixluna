import {Schema} from "koishi";

export interface Config {
  isR18: boolean;
  isProxy: boolean;
  proxyHost: string;
  r18P: number;
  excludeAI: boolean;
  imageConfusion: boolean;
}

// @ts-ignore
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    isR18: Schema.boolean().default(false).description('是否开启R18'),
    isProxy: Schema.boolean().default(false).description('是否使用代理'),
    excludeAI: Schema.boolean().default(false).description('是否排除 AI 作品'),
    imageConfusion: Schema.boolean().default(false).description('是否绕过图片检测'),
  }),
  Schema.union([
    Schema.object({
      isProxy: Schema.const(false),
    }),
    Schema.object({
      isProxy: Schema.const(true),
      proxyHost: Schema.string().default('http://127.0.0.1:7890').description('代理地址'),
    })
  ]),
  Schema.union([
    Schema.object({
      isR18: Schema.const(false),
    }),
    Schema.object({
      isR18: Schema.const(true),
      r18P: Schema.percent().default(0.1).description('R18概率')
        .min(0).max(1).step(0.01),
    }),
  ]),
  Schema.object({
    imageConfusion: Schema.const(true),
  })
]);

export default Config;
