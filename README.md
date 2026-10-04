<div align="center">

<img src="./images/Image_1727599920514.png">

<i>多图源整合式涩图插件！（正在开发中）</i>

[![npm](https://img.shields.io/npm/v/koishi-plugin-pixluna?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-pixluna)

</div>

## 功能

- [x] 图片像素混淆与水平、垂直或双向翻转（不保证绕过平台审核）
- [x] 可选过滤 AI 作品
- [x] 自定义反代地址
- [x] 指定随机图片的数量
- [x] 指定 R18 作品出现概率
- [x] 多并发获取图片
- [x] 可选是否以转发的形式打包发送图片
- [x] 图片压缩：优先使用图源提供的缩略图，否则本地转为 WebP

## 支持图源

使用 `pixluna.source` 查看当前注册图源。命令中的 `-s` 接受下表标识。

| 标识         | 图源              | 接入说明                                                                         |
| ------------ | ----------------- | -------------------------------------------------------------------------------- |
| `lolicon`    | Lolicon           | 无需账号；逗号分隔的标签为 AND，标签内 `\|` 为 OR                                |
| `pdiscovery` | Pixiv 推荐 / 搜索 | 支持 refresh token 或 PHPSESSID                                                  |
| `pfollowing` | Pixiv 已关注画师  | 支持上述两种认证；Cookie 模式还需用户 ID                                         |
| `danbooru`   | Danbooru          | 可选 `danbooru.keyPairs`，每项为 `login`、`apiKey`；搜索限制由账号等级决定       |
| `e621`       | e621              | 可选 `e621.keyPairs`，每项为 `login`、`apiKey`                                   |
| `gelbooru`   | Gelbooru          | 配置 `gelbooru.keyPairs`，每项必须包含 `userId`、`apiKey`；匿名 API 可能返回 401 |
| `konachan`   | Konachan          | 可选 `konachan.keyPairs`，每项为 `login`、`password`                             |
| `safebooru`  | Safebooru         | 无需账号，仅支持安全内容                                                         |
| `sankaku`    | Sankaku           | 配置 `sankaku.keyPairs`，每项为 `login`、`password`                              |
| `yande`      | Yande.re          | 可选 `yande.keyPairs`，每项为 `login`、`password`                                |

- 过滤同时作用于请求与返回结果：安全请求不会接受受限作品；`excludeAI` 拒绝图源标记为 AI 或带有已知 AI 标签的作品，但无法识别上游未标注的 AI 内容
- Danbooru 的安全请求使用 `general`。

## TODO（画饼 ing...）

- [ ] 支持更多的平台
- [ ] 自主判断平台是否能够支持以转发的方式打包发送

## 配置项

| 参数                               | 作用                                                                    | 默认值                  |
| ---------------------------------- | ----------------------------------------------------------------------- | ----------------------- |
| `defaultSourceProvider`            | 默认随机选择的图源，可多选                                              | `["lolicon"]`           |
| `isR18`                            | 是否允许受限作品，PID 取图同样受此开关约束                              | `false`                 |
| `r18P`                             | 随机请求受限作品的概率，仅在 `isR18` 开启时有效                         | `0.1`                   |
| `excludeAI`                        | 排除已标记的 AI 作品                                                    | `false`                 |
| `isProxy`                          | 是否通过网络代理访问 API 和下载图片                                     | `false`                 |
| `proxyHost`                        | 网络代理地址                                                            | `http://127.0.0.1:7890` |
| `baseUrl`                          | Pixiv / Lolicon 图片反代域名或 HTTP(S) 地址；留空访问原始 `i.pximg.net` | 空                      |
| `maxConcurrency`                   | 并发请求数，1–10；任务按请求顺序输出                                    | `1`                     |
| `apiDelay`                         | 请求调度及 Pixiv 遍历间隔，毫秒                                         | `1600`                  |
| `forwardMessage`                   | 是否使用合并转发格式，需适配器支持                                      | `true`                  |
| `messageBefore`                    | 取图前提示，留空不发送                                                  | `不可以涩涩哦~`         |
| `showTags`                         | 是否显示图片标签                                                        | `true`                  |
| `imageProcessing.confusion`        | 修改一个像素                                                            | `false`                 |
| `imageProcessing.isFlip`           | 开启图片翻转                                                            | `false`                 |
| `imageProcessing.flipMode`         | `horizontal`、`vertical` 或 `both`                                      | `horizontal`            |
| `imageProcessing.compress`         | 使用缩略图或本地压缩                                                    | `false`                 |
| `imageProcessing.compressionLevel` | 压缩等级，0–9                                                           | `6`                     |
| `autoRecall.enable`                | 自动撤回已发送的结果消息                                                | `false`                 |
| `autoRecall.delay`                 | 撤回延迟，秒                                                            | `30`                    |
| `isLog`                            | 调试日志                                                                | `false`                 |

本地代理示例：启用 `isProxy`，设置 `proxyHost: http://127.0.0.1:10809`。它与 `baseUrl` 是两项独立设置；关闭网络代理时不会继承宿主的全局代理。旧配置若显式设置了无法访问的 `i.pixiv.re`，应清空 `baseUrl` 或改为可用反代。

图片翻转和混淆不依赖压缩开关；需要本地处理且图片达到 32 MiB 时会拒绝处理。API 拒绝、空结果、分级不符、图片下载或格式错误均会报告失败。

## 使用方法

```text
pixluna 风景
色图 -n 3 -s lolicon 风景
pixluna -s e621 -t landscape
pixluna.source
pixluna.get.pixiv 作品ID -p 0
pixluna.get.pixiv 作品ID --all
```

- `pixluna` 与 `色图` 为同一入口；位置参数接受含空格的关键词，显式 `-t` 优先。
- `-n` 必须为正整数，最多获取 10 张；`-s` 可覆盖默认图源。
- Pixiv PID 页码从 `0` 开始；越界会报错，`--all` 获取全部原图页，暂不支持 Pixiv 动图。
- Pixiv 随机取图以逗号分隔多个关键词，全部匹配标题或标签。Cookie 模式在推荐或关注候选中筛选；refresh token 模式的 `pdiscovery` 有关键词时调用搜索 API。无匹配结果不会退回随机无关图片。
- `pfollowing` 遍历公开关注列表，并随机检查最多 10 位画师；结果继承过滤规则。

## Pixiv 认证

推荐在 `pixiv.refreshToken` 中填写账号的 OAuth refresh token，可通过 [PixivPy 提供的获取方式说明](https://github.com/upbit/pixivpy#pixivpy3) 准备凭据。

- 非空 refresh token 优先于 Cookie；推荐、关键词搜索、关注画师、PID 单页与全部页面均使用 App API。
- 自动缓存 access token，提前刷新即将过期的令牌，并合并同一账号的并发换取请求。服务端轮换后的 refresh token 在当前运行实例中保留，不自动改写 Koishi 配置；原凭据失效时需更新配置。
- refresh token 认证失败会明确报错。
- 留空 `pixiv.refreshToken` 时使用 `pixiv.phpSESSID`。Cookie 模式访问关注列表还需 `pixiv.userId`；token 模式从认证响应获取账号 ID。
- PID 入口也执行 `isR18`、`excludeAI`、图片处理、标签显示、转发和撤回设置。

## 开发与运行环境

在 Yarn 工作区安装依赖后执行：

```sh
yarn lint          # oxlint + oxlint-tsgolint：类型感知规则与 TypeScript 类型错误
yarn format        # oxfmt
yarn format:check
yarn test          # Vitest 行为回归
yarn build         # tsdown：CJS、ESM 和各自的类型声明
```

> Node 26 的内置 fetch 与 Koishi 代理插件使用的 Undici 6 不兼容，会在请求出网前报 `invalid onError method`。宿主可通过 Yarn `resolutions` 将 `@cordisjs/plugin-proxy-agent/undici` 定向升级为 `^7.30.0`，重新安装依赖并重启 Koishi；该覆盖应放在宿主工作区根 `package.json`。此依赖版本要求 Node >= 20.18.1。

## Wiki

[PixLunaLab/pixluna | DeepWiki](http://deepwiki.com/PixLunaLab/pixluna)（英语）

## 贡献者名单

<a href="https://github.com/PixLunaLab/pixluna/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=PixLunaLab/pixluna" />
</a>

## 特别鸣谢

- [koishi-plugin-booru](https://github.com/koishijs/koishi-plugin-booru) 提供的部分图源实现代码
- [@rinkuto/koishi-plugin-pixiv](https://github.com/rinkuto/koishi-plugin-pixiv) 提供的最初插件实现思路
