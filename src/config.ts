import { Schema } from "koishi";

export interface Config {
  isR18: boolean;
  r18P: number;
  excludeAI: boolean;
  isProxy: boolean;
  proxyHost: string;
  baseUrl: string;
  imageConfusion: boolean;
  maxConcurrency: number;
  forwardMessage: boolean;
  compress: boolean;
  srcProvider: string;
  willRecall: boolean;
  recallTime: number;
}

export const Config: Schema<Config> = Schema.intersect([
  // 通用设置
  Schema.object({
    isR18: Schema.boolean()
      .default(false)
      .description("是否允许返回 R18 内容。"),

    excludeAI: Schema.boolean()
      .default(false)
      .description("是否排除 AI 生成作品。"),

    imageConfusion: Schema.boolean()
      .default(false)
      .description("是否启用图片混淆处理。（对某些平台有奇效）"),

    maxConcurrency: Schema.number()
      .default(1)
      .description("最大并发请求数。")
      .min(1)
      .max(10)
      .step(1),

    forwardMessage: Schema.boolean()
      .default(true)
      .description("是否以转发消息格式发送图片。"),

    compress: Schema.boolean()
      .default(false)
      .description("是否压缩图片（能大幅度提升发送的速度，但是对图片质量有影响）"),

    srcProvider: Schema.union([
      Schema.const('lolicon').description('Lolicon API'),
      Schema.const('none').description('无')
    ])
      .default('lolicon')
      .description("图片来源"),

  }).description("通用设置"),

  // R18 内容设置
  Schema.object({
    isR18: Schema.const(true),
    r18P: Schema.percent()
      .default(0.1)
      .description("R18 内容出现的概率。")
      .min(0)
      .max(1)
      .step(0.01),
  }).description("R18 内容设置"),

  // 自动撤回设置
  Schema.object({
    willRecall: Schema.boolean().default(false).description("是否启用自动撤回功能。"),
    recallTime: Schema.number().default(60000).description("消息存活时间")
  }).description("自动撤回功能"),

  // 代理设置
  Schema.object({
    isProxy: Schema.boolean().default(false).description("是否使用代理。"),
    proxyHost: Schema.string()
      .default("http://127.0.0.1:7890")
      .description("代理服务器地址。"),
    baseUrl: Schema.string()
      .default("i.pixiv.re")
      .description("图片反代服务的地址。"),
  }).description("代理设置"),
]);

export const name = "pixiv";

export default Config;
