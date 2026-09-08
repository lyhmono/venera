// ============ 通用工具（三站共用） ============
// QuickJS polyfill: atob / UTF-8 TextDecoder
function _gmhAtob(s) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  s = String(s).replace(/[-_]/g, function(m){ return m === "-" ? "+" : "/"; }).replace(/\s+/g, "");
  let out = "", bits = 0, acc = 0;
  for (let i = 0; i < s.length; i++) {
    const c = chars.indexOf(s[i]);
    if (c < 0) continue;
    acc = (acc << 6) | c;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((acc >> bits) & 0xff);
    }
  }
  return out;
}

function _gmhDecodeUtf8(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "", i = 0;
  while (i < u8.length) {
    const b = u8[i];
    if (b < 0x80) { out += String.fromCharCode(b); i++; }
    else if (b < 0xE0) { out += String.fromCharCode(((b & 0x1f) << 6) | (u8[i+1] & 0x3f)); i += 2; }
    else if (b < 0xF0) { out += String.fromCharCode(((b & 0x0f) << 12) | ((u8[i+1] & 0x3f) << 6) | (u8[i+2] & 0x3f)); i += 3; }
    else {
      const cp = ((b & 0x07) << 18) | ((u8[i+1] & 0x3f) << 12) | ((u8[i+2] & 0x3f) << 6) | (u8[i+3] & 0x3f);
      const v = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff)); i += 4;
    }
  }
  return out;
}
function _gmhTextDecoder() { this.decode = _gmhDecodeUtf8; }

const UA_MOBILE = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

// ============ 妙趣漫画 miaoqumh.org（天堂漫画模板）============
// 侦察结论（2026-09-06）:
//   站内搜索: 404！/search?key= 全挂，只能靠分类/探索 + slug
//   详情: /<slug> → H1 + 章节 /<bookId>/<chNo>.html（标题带序号）
//   阅读: /<bookId>/<chNo>.html → var DATA='<base64ish>' + pic.js decryptData(DATA)
//         解密依赖: cid（页面内）、Base64 库、atob、utf8_char_code_at
//   图片: newImgs[i].url（解密后 JSON 数组）
//   ⚠️ 解密逻辑在 pic.js 里（jsjiami.v7 混淆，含反调试），图源里直接 fetch pic.js
//      并 eval，调 decryptData(DATA)。cid 从章节页 var cid= 提取。

const WEB = "https://www.miaoqumh.org";
const HDRS = { "User-Agent": UA_MOBILE, "Referer": WEB + "/" };

let __picJsCache = null;
async function loadPicJs() {
  if (__picJsCache) return __picJsCache;
  const res = await Network.get(WEB + "/template/pc/tiantangmanhua/js/pic.js", { headers: HDRS });
  if (res.status !== 200) throw "pic.js 拉取失败 " + res.status;
  __picJsCache = res.body;
  return __picJsCache;
}

// 从输入提取 slug（纯slug / 完整URL / 带.com路径）
function extractSlug(q) {
  q = (q || "").trim();
  var m = q.match(/miaoqumh\.org\/([a-z0-9]+)/i);
  if (m && m[1] !== 'custom' && m[1] !== 'template' && m[1] !== 'packs' && m[1] !== 'search') return m[1];
  if (/^[a-z0-9]{2,}$/.test(q) && q.indexOf(' ') < 0) return q;
  return null;
}

function normTitle(t) {
  return (t || "").toLowerCase().replace(/[\s~\uFF5E\u00B7:\uFF1A,\uFF0C.\u3002!\uFF01?\uFF1F\-\u2014_\u300A\u300B\u3008\u3009()\uFF08\uFF09\[\]\u3010\u3011'"\u2019\u201C]/g, "");
}

function matchByTitle(pool, keyword) {
  var kw = normTitle(keyword);
  if (!kw) return [];
  var exact = [], partial = [], seen = {};
  for (var i = 0; i < pool.length; i++) {
    var c = pool[i];
    if (seen[c.id]) continue;
    var nt = normTitle(c.title);
    if (nt === kw) { seen[c.id] = true; exact.push(c); }
    else if (nt.indexOf(kw) >= 0 || kw.indexOf(nt) >= 0) { seen[c.id] = true; partial.push(c); }
  }
  return exact.concat(partial);
}

function parseMqList(html) {
  const doc = new HtmlDocument(html);
  const out = [];
  const seen = {};
  const as_ = doc.querySelectorAll("a");
  for (let i = 0; i < as_.length; i++) {
    const a = as_[i];
    const attrs = a.attributes;
    if (!attrs || !attrs.href) continue;
    let href = attrs.href;
    // 绝对 URL 归一化为相对
    if (href.indexOf(WEB + "/") === 0) href = href.slice(WEB.length);
    // slug 是纯小写字母数字，排除路径类链接
    if (!/^\/[a-z0-9]+$/.test(href)) continue;
    const slug = href.slice(1);
    if (seen[slug]) continue;
    const title = (attrs.title || "").trim();
    if (!title) continue;
    const img = a.querySelector("img");
    const cover = img ? ((img.attributes && img.attributes.src) || "") : "";
    // 封面可空（首页热榜是纯文字链接）
    seen[slug] = true;
    out.push({ id: slug, title: title, subtitle: "", cover: cover, tags: [], description: "" });
  }
  return out;
}

class Miaoqu extends ComicSource {
  name = "妙趣漫画";
  key = "miaoqumh";
  version = "1.1.0";
  minAppVersion = "1.0.0";
  url = WEB;

  explore = [
    {
      title: "首页推荐",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(WEB + "/", { headers: HDRS });
        return { comics: parseMqList(res.body), maxPage: 1 };
      }
    },
    {
      title: "分类浏览",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(WEB + "/custom/category", { headers: HDRS });
        return { comics: parseMqList(res.body), maxPage: 1 };
      }
    }
  ];

  category = {
    title: "妙趣分类",
    parts: [
      {
        name: "浏览",
        type: "fixed",
        categories: ["全部分类"],
        itemType: "category",
        categoryParams: ["all"]
      }
    ],
    enableRankingPage: false
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const res = await Network.get(WEB + "/custom/category", { headers: HDRS });
      return { comics: parseMqList(res.body), maxPage: 1 };
    }
  };

  // 该站搜索接口 404。搜索栏=地址栏：输入 slug 直进；或爬首页/分类/热门匹配标题
  search = {
    load: async (keyword, options, page) => {
      // 1) slug/URL 直进
      var slug = extractSlug(keyword);
      if (slug) {
        try {
          var info = await this.comic.loadInfo(slug);
          if (info && info.title && info.chapters && Object.keys(info.chapters).length > 0) {
            return {
              comics: [{ id: slug, title: info.title, subtitle: info.subtitle || "", cover: info.cover || "", tags: [], description: "" }],
              maxPage: 1
            };
          }
        } catch (e) { /* 继续爬站 */ }
      }
      // 2) 爬首页 + 分类 + 热门 + 新品，匹配标题
      var pool = [];
      var pages = [WEB + "/", WEB + "/custom/category", WEB + "/custom/top", WEB + "/custom/news"];
      for (var pi = 0; pi < pages.length; pi++) {
        try {
          var res = await Network.get(pages[pi], { headers: HDRS });
          if (res.status === 200) pool.push.apply(pool, parseMqList(res.body));
        } catch (e) {}
      }
      var matched = matchByTitle(pool, keyword);
      if (matched.length > 0) return { comics: matched, maxPage: 1 };
      return {
        comics: pool.map(function(c) {
          return { id: c.id, title: c.title, subtitle: c.subtitle, cover: c.cover, tags: c.tags,
            description: (c.description || "") + "\n\n本站无搜索：以上是推荐位。想精准找漫画请粘贴漫画页链接或slug" };
        }),
        maxPage: 1
      };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(WEB + "/" + id, { headers: HDRS });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      const cover = html.match(/og:image"[^>]*content="([^"]+)"/) || html.match(/<img[^>]*src="(https?:\/\/static[^"]+\.jpg[^"]*)"/);
      const descMatch = html.match(/<meta name="description" content="([^"]+)"/);

      // 章节: /<bookId>/<chNo>.html，标题在 <a> 文本
      const chapters = {};
      const re = /href="\/(\d+)\/(\d+)\.html"[^>]*>([^<]+)</g;
      let m;
      const bookIds = {};
      while ((m = re.exec(html)) !== null) {
        const bid = m[1], chNo = m[2];
        bookIds[bid] = true;
        const key = bid + "_" + chNo;
        if (!chapters[key]) chapters[key] = m[3].trim() || ("第" + chNo + "话");
      }

      return {
        title: h1 ? h1[1].trim() : id,
        subtitle: "",
        cover: cover ? cover[1] : "",
        description: descMatch ? descMatch[1] : "",
        tags: {},
        chapters: chapters
      };
    },

    loadEp: async (comicId, epId) => {
      // epId = "<bookId>_<chNo>"
      const parts = epId.split("_");
      const res = await Network.get(WEB + "/" + parts[0] + "/" + parts[1] + ".html", { headers: HDRS });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      const dataMatch = html.match(/var\s+DATA='([^']+)'/);
      const cidMatch = html.match(/var\s+cid=(\d+)/);
      if (!dataMatch || !cidMatch) throw "未找到图片数据";
      const DATA = dataMatch[1];
      const cid = cidMatch[1];
      globalThis.DATA = DATA;
      globalThis.cid = cid;

      // 拉 pic.js（带缓存），在其环境中执行 decryptData
      // pic.js 依赖: jQuery($), DATA/cid 全局, atob, Base64(b64.min.js)
      // 规避 jQuery: 只把 decryptData + utf8_char_code_at + 相关闭包 eval，
      // 但 jsjiami 自校验依赖完整执行——直接跑整个 pic.js，stub $ 为空壳
      const picJs = await loadPicJs();
      const b64Res = await Network.get(WEB + "/packs/js/base64.min.js", { headers: HDRS });
      if (b64Res.status !== 200) throw "base64.min.js 拉取失败";
      // 加载顺序: base64.min.js 先、pic.js 后
      // b64.min.js 是 UMD，需要 self/window/global 之一挂 Base64
      const g = globalThis;
      if (typeof g.self === "undefined") { try { g.self = g; } catch (e) {} }
      if (typeof g.window === "undefined") { try { g.window = g; } catch (e) {} }
      // pic.js 顶部 var imgs = $(".lazy") 需要 jQuery stub
      if (typeof g.$ !== "function") {
        g.$ = function() { return { length: 0 }; };
      }
      if (!g.document) g.document = {};
      if (!g.document.querySelector) g.document.querySelector = function() { return null; };
      if (!g.document.querySelectorAll) g.document.querySelectorAll = function() { return []; };
      if (!g.document.createElement) g.document.createElement = function() { return { addEventListener: function(){}, onload: null, src: "" }; };
      if (!g.document.documentElement) g.document.documentElement = { clientHeight: 800, scrollTop: 0 };
      if (!g.document.body) g.document.body = { scrollTop: 0 };
      if (!g.document.addEventListener) g.document.addEventListener = function(){};
      if (!g.document.head) g.document.head = { appendChild: function(){} };
      if (!g.window.document) g.window.document = g.document;
      if (typeof g.Image !== "function") { g.Image = function() { this.onload = null; this.src = ""; }; }
      if (typeof g.navigator === "undefined") { g.navigator = { userAgent: UA_MOBILE }; }
      if (typeof g.location === "undefined") { g.location = { href: WEB + "/" }; }
      if (typeof g.atob !== "function") { try { g.atob = _gmhAtob; } catch (e) {} }
      if (typeof g.TextDecoder !== "function") { try { g.TextDecoder = _gmhTextDecoder; } catch (e) {} }
      if (typeof g.btoa !== "function") {
        try {
          g.btoa = function(s) {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            const b = [];
            for (let i = 0; i < s.length; i += 3) {
              const c1 = s.charCodeAt(i), c2 = s.charCodeAt(i+1), c3 = s.charCodeAt(i+2);
              b.push(chars[c1 >> 2]);
              b.push(chars[((c1 & 3) << 4) | ((c2 || 0) >> 4)]);
              b.push(isNaN(c2) ? "=" : chars[((c2 & 15) << 2) | ((c3 || 0) >> 6)]);
              b.push(isNaN(c3) ? "=" : chars[c3 & 63]);
            }
            return b.join("");
          };
        } catch (e) {}
      }
      try { eval(b64Res.body); } catch (e) { throw "b64.min.js 执行失败: " + e.message; }
      if (picJs.length < 5000) throw "pic.js 内容异常 len=" + picJs.length;
      // pic.js 尾部 var newImgs=decryptData(DATA) 会立即执行解密并把结果挂全局
      // 用全局 eval 语义（真机 QuickJS 的 eval 就是 context 级）
      const _gmhEval = eval;
      try { _gmhEval.call(g, picJs); } catch (e) { throw "pic.js 执行失败: " + e.message; }
      if (typeof g.decryptData !== "function") throw "decryptData 不在作用域";

      
      
      if (typeof decryptData !== "function") throw "解密函数不可用(eval作用域)";
      const decoded = decryptData(DATA);
      if (!decoded || !decoded.length) throw "解密结果为空";
      const images = [];
      for (let i = 0; i < decoded.length; i++) images.push(decoded[i].url);
      return { images: images };
    },

    onImageLoad: function(url, comicId, epId) { return { headers: { "User-Agent": UA_MOBILE, "Referer": WEB + "/" } }; }
  };
}
