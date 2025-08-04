import { Schema } from 'koishi'

export interface Config {
  isR18: boolean
  r18P: number
  excludeAI: boolean
  isProxy: boolean
  proxyHost: string
  baseUrl: string
  maxConcurrency: number
  forwardMessage: boolean
  defaultSourceProvider: string[]
  isLog: boolean
  pixiv: {
    phpSESSID: string
    userId: string
  }
  danbooru?: {
    keyPairs: { login: string; apiKey: string }[]
  }
  e621?: {
    keyPairs: { login: string; apiKey: string }[]
  }
  gelbooru?: {
    keyPairs: { apiKey: string }[]
  }
  lolibooru?: {
    keyPairs: { login: string; password: string }[]
  }
  sankaku?: {
    keyPairs: {
      login: string
      password: string
      tokenType?: string
      accessToken?: string
    }[]
  }
  konachan?: {
    keyPairs: { login: string; password: string }[]
  }
  yande?: {
    keyPairs: { login: string; password: string }[]
  }
  imageProcessing: {
    confusion: boolean
    compress: boolean
    compressQuality: number
    isFlip: boolean
    flipMode: 'horizontal' | 'vertical' | 'both'
  }
  autoRecall: {
    enable: boolean
    delay: number
  }
  messageBefore: string
  showTags: boolean
}

export const Config: Schema<Config> = Schema.intersect([
  // 通用设置
  Schema.object({
    isR18: Schema.boolean().default(false).description('是否允许返回 R18 内容'),

    messageBefore: Schema.string()
      .default('不可以涩涩哦~')
      .description('触发响应时的消息，留空则不发送'),

    showTags: Schema.boolean().default(true).description('是否显示图片标签'),

    excludeAI: Schema.boolean()
      .default(false)
      .description('是否排除 AI 生成作品'),

    maxConcurrency: Schema.number()
      .default(1)
      .description('最大并发请求数')
      .min(1)
      .max(10)
      .step(1),

    forwardMessage: Schema.boolean()
      .default(true)
      .description('是否以转发消息格式发送图片'),

    autoRecall: Schema.object({
      enable: Schema.boolean().default(false).description('是否启用自动撤回'),
      delay: Schema.number()
        .default(30)
        .description('自动撤回延迟时间（秒）')
        .min(1)
        .max(120)
        .step(1)
    })
  }).description('通用设置'),

  // 图片处理设置
  Schema.object({
    imageProcessing: Schema.object({
      confusion: Schema.boolean()
        .default(false)
        .description('是否启用图片混淆处理（对某些平台有奇效）'),

      compress: Schema.boolean()
        .default(false)
        .description(
          '是否压缩图片（能大幅度提升发送的速度，但是对图片质量有影响）'
        ),

      compressQuality: Schema.percent()
        .default(65)
        .description('图片压缩质量')
        .min(1)
        .max(100)
        .step(1),

      isFlip: Schema.boolean()
        .default(false)
        .description('是否启用图片翻转处理'),

      flipMode: Schema.union([
        Schema.const('horizontal').description('水平翻转'),
        Schema.const('vertical').description('垂直翻转'),
        Schema.const('both').description('水平和垂直翻转')
      ])
        .default('horizontal')
        .description('图片翻转模式')
    }).description('图片处理设置')
  }),

  // R18 内容设置
  Schema.object({
    r18P: Schema.percent()
      .default(0.1)
      .description('R18 内容出现的概率（仅当 isR18 为 true 时生效）')
      .min(0)
      .max(1)
      .step(0.01)
  }).description('R18 内容设置'),

  // 代理设置
  Schema.object({
    isProxy: Schema.boolean().default(false).description('是否使用代理'),
    proxyHost: Schema.string()
      .default('http://127.0.0.1:7890')
      .description('代理服务器地址'),
    baseUrl: Schema.string()
      .default('i.pixiv.re')
      .description('图片反代服务的地址')
  }).description('代理设置'),

  // 图源设置
  Schema.object({
    defaultSourceProvider: Schema.array(
      Schema.union([
        Schema.const('danbooru').description('Danbooru API'),
        Schema.const('e621').description('E621 API'),
        Schema.const('gelbooru').description('Gelbooru API'),
        Schema.const('konachan').description('Konachan API'),
        Schema.const('lolibooru').description('Lolibooru API'),
        Schema.const('lolicon').description('Lolicon API'),
        Schema.const('lolisuki').description('Lolisuki API'),
        Schema.const('pdiscovery').description('Pixiv Discovery'),
        Schema.const('pfollowing').description('Pixiv Following'),
        Schema.const('safebooru').description('Safebooru API'),
        Schema.const('sankaku').description('Sankaku API'),
        Schema.const('yande').description('Yande.re API')
      ])
    )
      .description('选择默认图片来源（可多选）')
      .default(['lolicon'])
      .role('select')
  }).description('图源设置'),

  // Pixiv 设置
  Schema.object({
    pixiv: Schema.object({
      phpSESSID: Schema.string()
        .description(
          'Pixiv 的 PHPSESSID，用于访问个性化内容返回的图片分级取决于该 Pixiv 账号所有者的分级设置'
        )
        .role('secret')
        .default(''),
      userId: Schema.string()
        .description('Pixiv 用户 ID，用于获取关注列表')
        .default('')
    }).description('Pixiv 设置')
  }),

  // Danbooru 设置
  Schema.object({
    danbooru: Schema.object({
      keyPairs: Schema.array(
        Schema.object({
          login: Schema.string().required().description('Danbooru 用户名'),
          apiKey: Schema.string()
            .required()
            .role('secret')
            .description('Danbooru API Key')
        })
      )
        .default([])
        .description('Danbooru API 鉴权信息')
    }).description('Danbooru 设置')
  }),

  // E621 设置
  Schema.object({
    e621: Schema.object({
      keyPairs: Schema.array(
        Schema.object({
          login: Schema.string().required().description('E621 用户名'),
          apiKey: Schema.string()
            .required()
            .role('secret')
            .description('E621 API Key')
        })
      )
        .default([])
        .description('E621 API 鉴权信息')
    }).description('E621 设置')
  }),

  // Gelbooru 设置
  Schema.object({
    gelbooru: Schema.object({
      keyPairs: Schema.array(
        Schema.object({
          apiKey: Schema.string()
            .required()
            .role('secret')
            .description('Gelbooru API Key')
        })
      )
        .default([])
        .description('Gelbooru API 鉴权信息')
    }).description('Gelbooru 设置')
  }),

  // Lolibooru 设置
  Schema.object({
    lolibooru: Schema.object({
      keyPairs: Schema.array(
        Schema.object({
          login: Schema.string().required().description('Lolibooru 用户名'),
          password: Schema.string()
            .required()
            .role('secret')
            .description('Lolibooru 密码')
        })
      )
        .default([])
        .description('Lolibooru API 鉴权信息')
    }).description('Lolibooru 设置')
  }),

  // Sankaku 设置
  Schema.object({
    sankaku: Schema.object({
      keyPairs: Schema.array(
        Schema.object({
          login: Schema.string()
            .required()
            .description('Sankaku Complex 用户名'),
          password: Schema.string()
            .required()
            .role('secret')
            .description('Sankaku Complex 密码'),
          tokenType: Schema.string().hidden().default('Bearer'),
          accessToken: Schema.string().hidden()
        })
      )
        .default([])
        .description('Sankaku Complex API 鉴权信息')
    }).description('Sankaku Complex 设置'),
    konachan: Schema.object({
      keyPairs: Schema.array(
        Schema.object({
          login: Schema.string().required().description('Konachan 用户名'),
          password: Schema.string()
            .required()
            .role('secret')
            .description('Konachan 密码')
        })
      )
        .default([])
        .description('Konachan API 鉴权信息')
    }).description('Konachan 设置'),
    yande: Schema.object({
      keyPairs: Schema.array(
        Schema.object({
          login: Schema.string().required().description('Yande.re 用户名'),
          password: Schema.string()
            .required()
            .role('secret')
            .description('Yande.re 密码')
        })
      )
        .default([])
        .description('Yande.re API 鉴权信息')
    }).description('Yande.re 设置')
  }),

  // 日志设置
  Schema.object({
    isLog: Schema.boolean().default(false).description('是否输出debug日志')
  }).description('日志设置')
])

export const name = 'pixluna'

export default Config
