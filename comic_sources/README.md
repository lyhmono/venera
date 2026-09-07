# Venera 漫画源合集

35 个源，全部经沙箱 + 双网络环境（容器直连 / 代理）健康检查。

> 已剔除 7 个双网络环境均不可达的死源（详见维护一节）。
> 2026-09 新增 4 源（一次元书源移植）：神奇漫画 / 武芊漫画 / 漫画1234 / 250漫画。

## 订阅方式

venera → 设置 → 漫画源 → 订阅 → 填入：

```
https://cdn.jsdelivr.net/gh/lyhmono/venera@master/comic_sources/index.json
```

（或原始文件：`https://raw.githubusercontent.com/lyhmono/venera/master/comic_sources/index.json`，venera 两种都认）

## 健康度图例

- ✅ 全链路可用（沙箱实测：搜索→详情→章节→图片 URL 全通）
- ⚠️ 主链路可用（搜索/详情通；图片端点未全部验证或需登录/CF 通行）
- 🔒 需要登录或 Cloudflare 浏览器验证（非源损坏）
- ⛔ 站死 / 端点已改（建议清理）

## 源列表

### 我维护的 8 个源（本仓库自研）

| 源 | 状态 | 说明 |
|---|---|---|
| gmh.js G社漫画 | ✅ | v1.3：移动端真搜索 `/s/{关键词}`（原桌面版搜索为推荐流已弃用）；512章/56图；URL/slug 直进保留 |
| guazi.js 瓜子漫画 | ✅ | 真搜索；JSON-LD 顺序图；搜索栏支持 ID/URL 直进 + 标题匹配 |
| wmanhua.js W漫画 | ✅ | 站点无真搜索（假推荐流）；URL/ID 直进 + 爬站标题匹配兜底；章节走官方内部 API 全量 |
| miaoqu.js 妙趣漫画 | ✅ | 无搜索接口；slug/URL 直进 + 首页/分类池匹配；图片走站点 jsjiami 解密 |
| sqmh.js 神奇漫画 | ✅ | 一次元移植（sqmh.app/Next.js）；真搜索 24 结果/21 章/87 图全链路 |
| wuqian.js 武芊漫画 | ✅ | 一次元移植（mkzcdn 纯 API）；真搜索 18 结果/15 章/10 图 |
| mh1234m.js 漫画1234 | ✅ | 一次元移植（m.wmh1234.com）；真搜索 18 结果/284 章/21 图；/go/ 中转页跳 reader 图床 |
| mh250.js 250漫画 | ✅ | 一次元移植（mh250.com）；搜索路径动态轮换（b41→ae6→6fb，源内自动提取 msearchurl）；100 结果/8 章/6 图 |

### 官方池（27 个，上游 venera-app/venera-configs 镜像）

| 源 | 状态 | 备注 |
|---|---|---|
| hcomic.js | ✅ | 沙箱全链路通 |
| jcomic.js | ✅ | 沙箱全链路通 |
| baihehui.js | 🔒 | 上游新源（百合会 yamibo.com）；explore 分区可达，搜索需站点登录 |
| manga_dex.js | ⚠️ | explore 分区可达；搜索 API 演进中，沙箱解析失败 |
| komiic.js | ✅ | 221 章 194 图 |
| manwaba.js | ✅ | 漫蛙吧 |
| baozi.js | ⚠️ | 77 结果 1187 章；镜像图床需正确线路 |
| goda.js | ⚠️ | 章节抽屉走 API（沙箱被 Referer 校验挡，真机正常） |
| copy_manga.js / copy_manga_multi_accounts.js | ⚠️ | 启动自取 network2 API 域名，容器内 TLS reset，真机大概率正常 |
| hot_manga.js | ⚠️ | 结果+详情通；图片 CDN 未验证 |
| manhuaren.js | ⚠️ | 结果+详情通；连载分组摊平小 bug 上游未修 |
| nhentai.js / wnacg.js | ⚠️ | 结果通；图片需 cookies/会员 |
| ikmmh.js / lanraragi.js / mxs.js | ⚠️ | 端点 200 但"海贼"0 结果（关键词策略/演示库空） |
| ccc.js | ⚠️ | 搜索返回 HTML（接口或已改版） |
| comick.js | ⚠️ | 复查翻案：双网络环境 50 结果全通（旧 422 为历史误判）；图片 CDN 未验证 |
| zaimanhua.js | ⚠️ | 复查翻案：直连 20 结果通（此前容器代理双挂为误判，已从 ⛔ 更正） |
| ehentai.js | 🔒 | 无独立搜索（登录态走 e-hentai 逻辑） |
| picacg.js / komga.js / kavita.js | 🔒 | 需登录（第三方服务/自托管） |
| mycomic.js | 🔒 | Cloudflare 验证拦截 |
| mh18.js | ⚠️ | 403 需 CF 浏览器过盾 |
| jm.js | ⚠️ | 域名列表加密刷新（容器缺 AES 完整链，真机大概率正常） |

> 判定口径：容器代理能达且逻辑通过 = 可用；登录/CF 门槛 ≠ 坏；两环境都连不上 = 判死。
> 官方源问题请提 https://github.com/venera-app/venera-configs ，自研 4 源问题提本仓库 issue。

## 维护

- 官方池为上游 venera-app/venera-configs 的镜像，需要更新时手动 `cp` 覆盖本目录即可
- index.json 含全部 31 源的 jsdelivr 直链

### 已剔除的死源（2026-09 复查，双网络环境均不可达）

| 源 | 死因 |
|---|---|
| shonen_jump_plus.js | 端点 410（公开接口已关） |
| comic_walker.js | access_token 接口已废 |
| happy.js | TLS 双路握手不通 |
| manhuagui.js | 双路连接失败（站迁移或死） |
| mh1234.js | 页面可达但解析全崩（站结构已变） |
| ykmh.js | 全站 403 双路拦截 |
| hitomi.js | 旧 reader 接口已废（galleryblock 404） |

### 一次元书源处理记录（2026-09）

| 一次元源 | 处理 |
|---|---|
| 820 G站 | 情报并入 gmh.js v1.3（移动端真搜索），不再单独建源 |
| 922/925/912/905 | 已移植为 mh1234m / sqmh / wuqian / mh250（全部沙箱验证） |
| 891 漫画家 | 不发布：站点对容器出口 IP 掐连接（三代理+直连全灭），无法验证 |
| 866 YYDS | 不发布：服务端区域封锁（"The region has been denied"），双路全死 |
