// ============ 图片解码：官方 venera-configs/goda.js 同源纯算法 ============
// G社(g-mh.org)/GoDa/guazi系共用 v2.apikk.top API 与 J7r..nQ 图片混淆。
// 此解码器移植自 keiyoushi/extensions-source，无 atob/TextDecoder 依赖，直接可用。

const STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const CUSTOM = "_-9876543210abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DECODE_PREFIX = "J7r";
const DECODE_MARKER1 = "kD";
const DECODE_MARKER2 = "W4s";
const DECODE_SUFFIX = "nQ";
const DECODE_GROUP = 7;

// 预计算的查找表：自定义字母表字符码 → 标准 base64url 字符码（-1 表示无效）
const DECODE_TABLE = new Array(128).fill(-1);
for (let i = 0; i < CUSTOM.length; i++) {
    DECODE_TABLE[CUSTOM.charCodeAt(i)] = STD.charCodeAt(i);
}

function decodeChapterImages(input) {
    if (typeof input !== "string" || !input.startsWith(DECODE_PREFIX) || !input.endsWith(DECODE_SUFFIX)) {
        throw "未知的章节数据格式";
    }
    const body = input.substring(DECODE_PREFIX.length, input.length - DECODE_SUFFIX.length);
    const payloadLen = body.length - DECODE_MARKER1.length - DECODE_MARKER2.length;
    if (payloadLen <= 0) {
        throw "未知的章节数据格式";
    }

    const aLen = Math.floor(payloadLen / 3);
    const bLen = Math.floor((payloadLen - aLen) / 2);
    const cLen = payloadLen - aLen - bLen;

    const part1 = body.substring(0, bLen);
    const marker1 = body.substring(bLen, bLen + DECODE_MARKER1.length);
    const part2 = body.substring(bLen + DECODE_MARKER1.length, bLen + DECODE_MARKER1.length + cLen);
    const marker2 = body.substring(bLen + DECODE_MARKER1.length + cLen, bLen + DECODE_MARKER1.length + cLen + DECODE_MARKER2.length);
    const part3 = body.substring(bLen + DECODE_MARKER1.length + cLen + DECODE_MARKER2.length);

    if (marker1 !== DECODE_MARKER1 || marker2 !== DECODE_MARKER2 || part3.length !== aLen) {
        throw "未知的章节数据格式";
    }

    // 重新排序：段3 + 段1 + 段2
    const reordered = part3 + part1 + part2;

    // 去锯齿：每隔一个 GROUP 长度的块做反转
    let unzigzagged = "";
    for (let i = 0, block = 0; i < reordered.length; i += DECODE_GROUP, block++) {
        const chunk = reordered.substring(i, Math.min(i + DECODE_GROUP, reordered.length));
        unzigzagged += (block % 2 === 1) ? chunk.split('').reverse().join('') : chunk;
    }

    // 将自定义字母表映射为标准 base64url
    let standard = "";
    for (let i = 0; i < unzigzagged.length; i++) {
        const code = unzigzagged.charCodeAt(i);
        const mapped = code < DECODE_TABLE.length ? DECODE_TABLE[code] : -1;
        if (mapped < 0) {
            throw "无效的章节数据字符";
        }
        standard += String.fromCharCode(mapped);
    }

    // Base64 解码（纯 JS 实现，venera 运行时不支持 atob）。先将 base64url 转为标准 base64。
    const standardBase64 = standard.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeBase64(standardBase64);
    return JSON.parse(json);
}

/**
 * 纯 JavaScript base64 解码器（venera 运行时缺少 atob）。
 * 将 base64 解码为字节字符，供 JSON 解析使用。
 */
function decodeBase64(str) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    str = str.replace(/=+$/, "");

    let result = "";
    let i = 0;
    while (i < str.length) {
        const enc1 = chars.indexOf(str.charAt(i));
        const enc2 = chars.indexOf(str.charAt(i + 1));
        const enc3 = str.charAt(i + 2) ? chars.indexOf(str.charAt(i + 2)) : -1;
        const enc4 = str.charAt(i + 3) ? chars.indexOf(str.charAt(i + 3)) : -1;

        if (enc1 < 0 || enc2 < 0) {
            throw "Invalid base64 character";
        }

        result += String.fromCharCode((enc1 << 2) | (enc2 >> 4));
        if (enc3 >= 0) {
            result += String.fromCharCode(((enc2 & 15) << 4) | (enc3 >> 2));
        }
        if (enc4 >= 0) {
            result += String.fromCharCode(((enc3 & 3) << 6) | enc4);
        }

        i += 4;
    }
    return result;
}


// line 2/3 -> CDN 域名路由
function imageHost(line, route) {
  route = route || "c";
  const map = {
    c: { 2: "https://c-nd2-1.6wm.top", default: "https://c-nd3-1.6wm.top" },
    t: { 2: "https://t-nd2-1.6wm.top", default: "https://t-nd3-1.6wm.top" }
  };
  const grp = map[route] || map.c;
  return line === 2 ? grp[2] : grp.default;
}

// 从 HTML 抓漫画条目列表

const API = "https://v2.apikk.top";
const WEB = "https://m.g-mh.org";
const UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const HDRS = { "User-Agent": UA, "Referer": WEB + "/" };

function parseComicList(html) {
  const doc = new HtmlDocument(html);
  const out = [];
  const seen = {};
  const as_ = doc.querySelectorAll("a");
  for (let i = 0; i < as_.length; i++) {
    const a = as_[i];
    const href = (a.attributes && a.attributes.href) || "";
    if (!href.startsWith("/manga/") || href.startsWith("/manga-")) continue;
    const slug = href.replace("/manga/", "").replace(/\/$/, "");
    if (seen[slug]) continue;
    const img = a.querySelector("img");
    const h3 = a.querySelector("h3");
    if (!img || !h3) continue;
    const src = (img.attributes && img.attributes.src) || "";
    if (!src || src.startsWith("/assets")) continue;
    seen[slug] = true;
    out.push({
      id: slug,
      title: h3.text.trim(),
      subtitle: "",
      cover: src,
      tags: [],
      description: ""
    });
  }
  return out;
}

class Gmh extends ComicSource {

  name = "G社漫画";
  key = "gmh";
  version = "1.3.0";
  minAppVersion = "1.0.0";
  url = WEB;

  // ---------- 探索页 ----------
  explore = [
    {
      title: "热门推荐",
      type: "multiPageComicList",
      load: async (page) => {
        let res = await Network.get(WEB + "/hots" + (page > 1 ? "?p=" + page : ""), { headers: HDRS });
        let comics = parseComicList(res.body);
        return { comics, maxPage: 10 };
      }
    },
    {
      title: "最新更新",
      type: "multiPageComicList",
      load: async (page) => {
        let res = await Network.get(WEB + "/dayup" + (page > 1 ? "?p=" + page : ""), { headers: HDRS });
        let comics = parseComicList(res.body);
        return { comics, maxPage: 10 };
      }
    },
    {
      title: "最新上架",
      type: "multiPageComicList",
      load: async (page) => {
        let res = await Network.get(WEB + "/newss" + (page > 1 ? "?p=" + page : ""), { headers: HDRS });
        let comics = parseComicList(res.body);
        return { comics, maxPage: 10 };
      }
    }
  ];

  // ---------- 分类 ----------
  category = {
    title: "G社漫画分类",
    parts: [
      {
        name: "地区",
        type: "fixed",
        categories: ["国漫", "日本漫画", "韩国漫画"],
        itemType: "category",
        categoryParams: ["cn", "jp", "kr"]
      },
      {
        name: "标签",
        type: "fixed",
        categories: ["穿越", "恋爱", "热血", "系统", "玄幻"],
        itemType: "category",
        categoryParams: ["chuanyue", "lianai", "rexue", "xitong", "xuanhuan"]
      }
    ],
    enableRankingPage: false
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      let path;
      if (["cn", "jp", "kr"].indexOf(param) >= 0) path = "/manga-genre/" + param;
      else path = "/manga-tag/" + param;
      let res = await Network.get(WEB + path + (page > 1 ? "?p=" + page : ""), { headers: HDRS });
      let comics = parseComicList(res.body);
      return { comics, maxPage: 30 };
    }
  };

  // ---------- 搜索 ----------
  // 增强: 输入漫画页URL/slug 直进详情；否则走移动端真搜索 /s/{关键词}
  // (v1.3: 桌面版 /s/?q= 是推荐流，移动版 /s/{kw} 才是真搜索——实测"斗罗"精确命中斗罗系列)
  search = {
    load: async (keyword, options, page) => {
      // 1) slug/URL 直进
      var slug = null;
      var q = (keyword || "").trim();
      var murl = q.match(/g-mh\.org\/manga\/([\w-]+)/) || q.match(/^\/manga\/([\w-]+)/);
      if (murl) slug = murl[1];
      else if (/^[a-z0-9][\w-]{2,}$/.test(q) && !/[\s一-鿿]/.test(q)) slug = q;
      if (slug) {
        try {
          var info = await this.comic.loadInfo(slug);
          if (info && info.title && info.chapters && Object.keys(info.chapters).length > 0) {
            return {
              comics: [{ id: slug, title: info.title, subtitle: info.subtitle || "", cover: info.cover || "", tags: [], description: "" }],
              maxPage: 1
            };
          }
        } catch (e) { /* 继续站内搜 */ }
      }
      // 2) 移动端真搜索
      var url = WEB + "/s/" + encodeURIComponent(keyword) + (page > 1 ? "?p=" + page : "");
      var res = await Network.get(url, { headers: HDRS });
      if (res.status !== 200) throw "HTTP " + res.status;
      var comics = parseComicList(res.body);
      return { comics, maxPage: 1 };
    }
  };

  // ---------- 详情 ----------
  comic = {
    loadInfo: async (id) => {
      let res = await Network.get(WEB + "/manga/" + id, { headers: HDRS });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      const doc = new HtmlDocument(html);

      const titleMatch = html.match(/og:title"[^>]*content="([^"]+)"/);
      let title = titleMatch ? titleMatch[1] : id;
      title = title.split("-")[0].trim();

      let cover = "";
      const ogImg = html.match(/og:image"[^>]*content="([^"]+)"/);
      if (ogImg) cover = ogImg[1];

      const authors = [];
      doc.querySelectorAll("a").forEach(a => {
        if (!a.attributes || !a.attributes.href || a.attributes.href.indexOf("/manga-author/") !== 0) return;
        const t = a.text.trim();
        if (t && authors.indexOf(t) < 0) authors.push(t);
      });

      const tags = {};
      const genres = [];
      doc.querySelectorAll("a").forEach(a => {
        if (!a.attributes || !a.attributes.href || a.attributes.href.indexOf("/manga-genre/") !== 0) return;
        const t = a.text.trim().replace(/[,，]\s*$/, "").trim();
        if (t && genres.indexOf(t) < 0) genres.push(t);
      });
      if (genres.length) tags["类型"] = genres;

      const tagList = [];
      doc.querySelectorAll("a").forEach(a => {
        if (!a.attributes || !a.attributes.href || a.attributes.href.indexOf("/manga-tag/") !== 0) return;
        const t = a.text.trim().replace(/^#/, "").trim();
        if (t && tagList.indexOf(t) < 0) tagList.push(t);
      });
      if (tagList.length) tags["标签"] = tagList;

      let description = "";
      const descMatch = html.match(/<p class="text-medium[^"]*"[^>]*>([\s\S]*?)<\/p>/);
      if (descMatch) description = descMatch[1].trim();
      if (!description) {
        const metaDesc = html.match(/<meta name="description" content="([^"]+)"/);
        if (metaDesc) description = metaDesc[1];
      }

      const mid = (html.match(/data-mid="(\d+)"/) || html.match(/data-manga-id="(\d+)"/) || [])[1] || "";
      if (mid) __midCache[id] = mid;

      let chapters = {};
      if (mid) {
        const apiRes = await Network.get(API + "/api/v2/manga/get?mid=" + mid + "&mode=all", { headers: HDRS });
        if (apiRes.status === 200) {
          const data = JSON.parse(apiRes.body);
          const chs = (data && data.data && data.data.chapters) || [];
          chs.sort((a, b) => ((a.attributes && a.attributes.order) || 0) - ((b.attributes && b.attributes.order) || 0));
          for (let i = 0; i < chs.length; i++) {
            const c = chs[i];
            const title = (c.attributes && c.attributes.title) || c.id;
            // "c" 前缀防 JS 引擎对纯数字 key 重排
            chapters["c" + c.id] = title;
          }
        }
      }

      return {
        title: title,
        subtitle: authors.join(", "),
        cover: cover,
        description: description,
        tags: tags,
        chapters: chapters
      };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "c") epId = epId.slice(1);
      // comicId = slug; epId = chapter id (API数字id)
      let mid = __midCache[comicId];
      if (!mid) {
        let res = await Network.get(WEB + "/manga/" + comicId, { headers: HDRS });
        mid = (res.body.match(/data-mid="(\d+)"/) || res.body.match(/data-manga-id="(\d+)"/) || [])[1];
        if (mid) __midCache[comicId] = mid;
      }
      if (!mid) throw "无法获取漫画ID";
      let apiRes = await Network.get(API + "/api/v2/chapter/getinfo?m=" + mid + "&c=" + epId, { headers: HDRS });
      if (apiRes.status >= 400) throw "HTTP " + apiRes.status;
      const data = JSON.parse(apiRes.body);
      const info = data && data.data && data.data.info;
      if (!info) throw "章节数据为空";
      const enc = info.images; // {images, line}
      if (typeof enc !== "object" || typeof enc.images !== "string") throw "图片数据格式异常";
      const decoded = decodeChapterImages(enc.images);
      const line = enc.line || 3;
      let route = "c";
      try {
        const s = this.loadSetting ? this.loadSetting("imageRoute") : null;
        if (s === "t" || s === "c") route = s;
      } catch (e) {}
      const host = imageHost(line, route);
      const images = [];
      for (let i = 0; i < decoded.length; i++) {
        images.push(host + decoded[i].url);
      }
      return { images: images };
    },

    onImageLoad: (url, comicId, epId) => {
      return { headers: HDRS };
    }
  };

  // ---------- 设置 ----------
  settings = {
    imageRoute: {
      title: "图片线路",
      type: "select",
      options: [
        { value: "c", text: "常规线路" },
        { value: "t", text: "备用线路" }
      ],
      default: "c"
    }
  };
}

// mid 缓存（会话内省请求）
const __midCache = {};
