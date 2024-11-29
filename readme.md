<div align="center">

<img src="./images/Image_1727599920514.png">

<i>多图源整合式涩图插件！（正在开发中）</i>

[![npm](https://img.shields.io/npm/v/koishi-plugin-pixluna?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-pixluna)

</div>

## 功能

- [x] 基于更改像素的图片混淆以实现稳定涩涩
- [x] 可选过滤 AI 作品
- [x] 自定义反代地址
- [x] 指定随机图片的数量
- [x] 指定 R18 作品出现概率
- [x] 多并发获取图片
- [x] 可选是否以转发的形式打包发送图片
- [x] 压缩图片（开启后不发送原图，提升发送速度）

## TODO（画饼 ing...）

- [ ] 支持更多的平台
- [ ] 自主判断平台是否能够支持以转发的方式打包发送

## 配置项

| 参数 | 作用 | 默认值 |
|---|:---:|---|
| isR18 | 是否随机R18图片 | false |
| isProxy | 是否启用代理 | false |
| R18P | 随机图片中R18的概率，别开太高哦~，仅在isR18为真时有效 | 0.1  |
| excludeAI | 排除AI作品 | false |
| proxyHost | 代理服务器的地址，仅在isProxy为真时有效 | http://127.0.0.1:7890 |
| baseUrl | 图片反向代理服务的域名 | i.pixiv.re |
| imageConfusion | 是否开启图片混淆以尝试绕过哈希审查 | false |
| formatMessage | 是否以转发消息的形式发送图片 | true |
| maxConcurrency | 最大并发数 | 1 |
| compress | 是否压缩图片 | false |

## 使用方法

指令为 `pixluna` ，输入 `pixluna` 即可，后面可以跟上关键词
如
```
pixluna 黑丝
```
即可随机获取一张黑丝的图片

-n 选项为指定获取的图片数量，默认为一张，最大不超过10张，如
```
pixluna -n 5 黑丝
```
即可随机获取5张黑丝的图片，关键词一定要放在最后面

## 贡献者名单

<a href="https://github.com/PixLunaLab/pixluna/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=PixLunaLab/pixluna" />
</a>
