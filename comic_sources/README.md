# Venera 漫画源合集

45 个源，全部经沙箱 + 双网络环境（容器直连 / mihomo 代理）健康检查。

> 已剔除 7 个双网络环境均不可达的死源（详见维护一节）。
> 2026-09 新增 14 源（一次元 130 包移植）：神奇漫画 / 武芊漫画 / 漫画1234 / 250漫画 / 漫画家 / 92漫画 / 漫画屋 / 顶漫画 / MangaRead / 鸟鸟韩漫 / MissKon图集 / Buondua图集 / Everia图集 / x漫画。

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

### 我维护的 18 个源（本仓库自研）

| 源 | 状态 | 说明 |
|---|---|---|
| gmh.js G社漫画 | ✅ | v1.3：移动端真搜索 `/s/{关键词}`（原桌面版搜索为推荐流已弃用）；512章/56图；URL/slug 直进保留 |
| guazi.js 瓜子漫画 | ✅ | 真搜索；JSON-LD 顺序图；搜索栏支持 ID/URL 直进 + 标题匹配 |
| wmanhua.js W漫画 | ✅ | 站点无真搜索（假推荐流）；URL/ID 直进 + 爬站标题匹配兜底；章节走官方内部 API 全量 |
| miaoqu.js 妙趣漫画 | ✅ | 无搜索接口；slug/URL 直进 + 首页/分类池匹配；图片走站点 jsjiami 解密（2026-09 修复 document stub 覆盖问题） |
| sqmh.js 神奇漫画 | ✅ | 一次元移植（sqmh.app/Next.js）；真搜索 24 结果/21 章/87 图全链路 |
| wuqian.js 武芊漫画 | ✅ | 一次元移植（mkzcdn 纯 API）；真搜索 18 结果/15 章/10 图 |
| mh1234m.js 漫画1234 | ✅ | 一次元移植（m.wmh1234.com）；真搜索 18 结果/284 章/21 图；/go/ 中转页跳 reader 图床（v1.1 适配站点 mint-* 新模板，a[data-chapter-id] 章节） |
| mh250.js 250漫画 | ✅ | 一次元移植（mh250.com）；搜索路径动态轮换（b41→ae6→6fb，源内自动提取 msearchurl）；100 结果/8 章/6 图 |
| mhjia.js 漫画家 | ✅ | 一次元移植（mhjia.com，韩漫为主）；mihomo 代理验证 20 结果/15 章/51 图；⚠️ 站点掐数据中心 IP，家宽网络直接用 |
| mh92.js 92漫画 | ✅ | 一次元移植（www.92mh.com）；h5 站图片明文；38 结果/6 章/3 图 |
| mhua5.js 漫画屋 | ✅ | 一次元移植（mhua5.com/mccms）；oss.mkzcdn 图床；30 结果/2 章/10 图（v1.1 探索改首页 SSR，列表页是 Vue 壳） |
| dingmanhua.js 顶漫画 | ✅ | 一次元移植（dingmanhua.com）；阅读页内联 JS 拼图片 URL（pasd+i.webp）；23 结果/24 章/34 图 |
| mangaread.js MangaRead | ✅ | 一次元移植（mangaread.org/wp-manga 英语站）；12 结果/39 章/53 图 |
| nnhanman.js 鸟鸟韩漫 | ✅ | 一次元移植（nnhm95+nnhanman5 双域自动切换）；mihomo 验证 18 结果/7 章/147 图 |
| misskon.js MissKon图集 | ✅ | 一次元移植（WP 图集站）；blogspot+wes.misskon 双图床；12 结果/16 图 |
| buondua.js Buondua图集 | ✅ | 一次元移植；i2.buondua 签名直链；16 结果/41 图 |
| everia.js Everia图集 | ✅ | 一次元移植（日韩写真 WP 站）；japan/korea/cosplay 分区；16 结果/38 探索/21 图 |
| xmanhua.js x漫画 | ✅ | 一次元移植（xmanhua.com 日漫繁体站）；chapterimage.ashx eval-packer 解包（纯 JS 实现）；12 结果/234 章/2 图 |

### 官方池（27 个，上游 venera-app/venera-configs 镜像，2026-09-08 全量复查）

| 源 | 状态 | 备注 |
|---|---|---|
| jm.js 禁漫天堂 | ✅ | v1.4.2：图片分流先探活再采用（官方轮换池混死域已根治）；搜索 80/详情/61 图 |
| comick.js | ✅ | 50 结果/2548 章/51 图全链路（复查翻案，旧 0 图为测试工具 epId 缺陷误判） |
| komiic.js | ✅ | mihomo 验证 67 结果/94 图 |
| jcomic.js | ✅ | mihomo 验证 30 结果/99 图 |
| hcomic.js | ✅ | mihomo 验证 10 结果/40 图 |
| manwaba.js 漫蛙吧 | ✅ | mihomo 验证 20 结果/302 章/11 图 |
| nhentai.js | ✅ | mihomo 验证 25 结果/221 图（单章本走 maxPage 字段，ch=0 为设计） |
| wnacg.js 紳士漫畫 | ✅ | mihomo 验证 24 结果/20 图 |
| zaimanhua.js 再漫画 | ⚠️ | v1.1 loadEp 加 encodeURIComponent；书库大批下架（20 结果仅 1 本活），站点问题非源问题；活书全链路 16/20 章/56 图 |
| mxs.js 漫小肆 | ✅ | 8 结果/144 章/100 图（沙箱补 Comment stub 后全绿） |
| ikmmh.js 爱看漫 | ✅ | 100 结果/29 图 |
| goda.js GoDa漫画 | ✅ | 30 结果/4 章/181 图 |
| hot_manga.js 热辣漫画 | ✅ | 20 结果/53 章/181 图（复测通过，旧 404 为章节 slug 临时性） |
| manhuaren.js 漫画人 | ⚠️ | 搜索 22 结果/详情通；站点重构详情页（连载页 URL 字段解析 null），上游待修 |
| baozi.js 包子漫画 | ⚠️ | 搜索 89/详情 1187 章；图片 API appcn.baozimh.com 对 Node TLS 指纹 403（curl/真机 Dart 正常），真机可用性未知 |
| baihehui.js 百合会 | 🔒 | explore 分区可达（24 卡片）；搜索跳登录页，需站点账号 |
| manga_dex.js MangaDex | ⚠️ | explore 3 分区可达；搜索 API "Network response was not ok"（mihomo 亦然），疑似 API 演进，上游待修 |
| ccc.js CCC追漫台 | ⚠️ | explore 24 卡片；搜索 API 500 + 返回 HTML，接口改版，上游待修 |
| copy_manga.js / copy_manga_multi_accounts.js 拷贝漫画 | ⛔ | 全部已知域"服務器升級中"404 页；proxy 亦 404，站暂死（历史上活过，待其恢复后复查） |
| picacg.js Picacg | 🔒 | API 可达但需会员登录（"Not logged in"） |
| mh18.js 18漫画 | ✅ | v2.0.0 整站重写：18mh.org 死→18mh.net 新模板；搜索 48/详情/23 图全链路（mihomo 验证） |
| ehentai.js | 🔒 | 无独立搜索接口（走 e-hentai 登录态逻辑）；上游设计如此 |
| komga.js / kavita.js / lanraragi.js | 🔒 | 自托管服务，需用户自己的服务器 |
| mycomic.js | 🔒 | Cloudflare 浏览器验证拦截 |

> 判定口径：容器直连或 mihomo 代理任一路全链路通过 = ✅/⚠️ 可用；登录/CF 门槛 ≠ 坏；两路都连不上且无登录理由 = 判死。
> 官方源问题请提 https://github.com/venera-app/venera-configs ，自研 18 源问题提本仓库 issue。

## 维护

- 官方池为上游 venera-app/venera-configs 的镜像，需要更新时手动 `cp` 覆盖本目录即可
- index.json 含全部 45 源的 jsdelivr 直链
- 沙箱检查器：`/opt/data/check_one.js`（需 cheerio + undici），单章本与 grouped-chapters 已支持

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
| 891 漫画家 | 已移植为 mhjia（mihomo 换 IP 后全链路验证 20/15/51；站点掐数据中心 IP，家宽可用） |
| 866 YYDS | 不发布：服务端区域封锁（"The region has been denied"），双路+mihomo 全 403 |
| 37/38 x漫画 | 已移植为 xmanhua（eval-packer 纯 JS 解包，mihomo 验证 12/234/2） |
| 奇漫屋 qmanwu2 | 不发布：指纹 JS 风控盾，容器无法过验证 |

### jm.js 禁漫天堂维护记录（v1.4.2, 2026-09）

- v1.4.2：`refreshImgUrl` 探活机制——官方 `/setting` API 返回的 `img_host` 先 HEAD 探活（200 才采用），死域自动落到 9 域静态池轮换（池内全部探活通过）。根因：官方分流轮换池混着被墙死域（cdn-msp12/cdn-msp.jmdanjonproxy.xyz ECONNRESET），旧逻辑拿到就用导致整源图片全挂
- API fallback：cdnbea.net / cdnhth.net / cdngwc.cc / cdnhth.club（云鹤提供，实测直连+mihomo 全 200）
- url 改指本仓库（上游 venera-configs 的域名列表已过期，避免刷新回滚旧域）
- 实测：搜索 80 结果/详情/61 图全绿

### mh18.js 18漫画维护记录（v2.0.0, 2026-09）

- 旧域 18mh.org 整站 403（双路），新域 18mh.net 且全站换模板，旧选择器（.pb-2/.slicarda/#mangachapters）全废
- v2.0.0 整站重写：搜索 `/comic/search/{kw}`、卡片 `ul.dx-novel-list`、章节 `/comic/chapter/{id}/{n}`、图片明文（dzuxta CDN，auth_key 签名）
- mihomo 验证：搜索 48 / 详情 / 23 图全链路
- 登录功能暂缺（新站认证体系未摸清）
