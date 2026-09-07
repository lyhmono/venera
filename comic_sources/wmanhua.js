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

// ============ W漫画 wmanhua.com ============
// 侦察结论（2026-09-06）:
//   搜索: /search?keyword= → 假推荐流（任意词同结果）
//   详情: /comic/<id>.html → H1 + 章节 /chapter/<cid>-<chIid>.html
//   全量章节: POST /comic/<id> JSON API（页面"加载更多"按钮背后就是它，返回 新→旧，需反转）
//   阅读: /chapter/<cid>-<chIid>.html → 内联 JS: var pasd="https://image4.../{hash}/{uid}/", var num=N
//         图片 = pasd + i + ".webp"
//   搜索栏增强: 数字ID/URL直进 + 爬本站推荐页按标题匹配兜底

const WEB = "https://www.wmanhua.com";
const HDRS = { "User-Agent": UA_MOBILE, "Referer": WEB + "/" };

function parseWmList(html) {
  const doc = new HtmlDocument(html);
  const out = [];
  const seen = {};
  const as_ = doc.querySelectorAll("a");
  for (let i = 0; i < as_.length; i++) {
    const a = as_[i];
    const href = (a.attributes && a.attributes.href) || "";
    if (!/^\/comic\/\d+\.html$/.test(href)) continue;
    const id = href.match(/\/comic\/(\d+)\.html/)[1];
    if (seen[id]) continue;
    const img = a.querySelector("img");
    const cover = img ? ((img.attributes && img.attributes["data-src"]) || (img.attributes && img.attributes.src) || "") : "";
    if (!cover || cover.indexOf("http") !== 0) continue;
    const h3 = a.querySelector("h3");
    const title = h3 ? h3.text.trim() : "";
    if (!title) continue;
    seen[id] = true;
    out.push({ id: id, title: title, subtitle: "", cover: cover, tags: [], description: "" });
  }
  return out;
}

// 从任意输入提取漫画ID：纯数字 / 完整URL / /comic/N.html
function extractId(q) {
  q = (q || "").trim();
  let m = q.match(/\/comic\/(\d+)/);
  if (m) return m[1];
  if (/^\d{1,12}$/.test(q)) return q;
  return null;
}

// 标题归一化比较（去空格标点、简繁常见差异不管）
function normTitle(t) {
  return (t || "").toLowerCase().replace(/[\s~～·:：,，。!！?？\-—_《》〈〉()（）\[\]【】'"”“]/g, "");
}

function matchByTitle(pool, keyword) {
  const kw = normTitle(keyword);
  if (!kw) return [];
  const exact = [], partial = [];
  const seen = {};
  for (let i = 0; i < pool.length; i++) {
    const c = pool[i];
    const nt = normTitle(c.title);
    if (seen[c.id]) continue;
    if (nt === kw) { seen[c.id] = true; exact.push(c); }
    else if (nt.indexOf(kw) >= 0 || kw.indexOf(nt) >= 0) { seen[c.id] = true; partial.push(c); }
  }
  return exact.concat(partial);
}

class Wmanhua extends ComicSource {
  name = "W漫画";
  key = "wmanhua";
  version = "1.1.0";
  minAppVersion = "1.0.0";
  url = WEB;

  explore = [
    {
      title: "首页推荐",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(WEB + "/", { headers: HDRS });
        return { comics: parseWmList(res.body), maxPage: 1 };
      }
    },
    {
      title: "排序浏览",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(WEB + "/sort" + (page > 1 ? "?page=" + page : ""), { headers: HDRS });
        return { comics: parseWmList(res.body), maxPage: 1 };
      }
    }
  ];

  category = {
    title: "W漫画分类",
    parts: [
      {
        name: "浏览",
        type: "fixed",
        categories: ["全部漫画"],
        itemType: "category",
        categoryParams: ["all"]
      }
    ],
    enableRankingPage: false
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const res = await Network.get(WEB + "/sort" + (page > 1 ? "?page=" + page : ""), { headers: HDRS });
      return { comics: parseWmList(res.body), maxPage: 1 };
    }
  };

  search = {
    load: async (keyword, options, page) => {
      // 1) ID/URL 直进
      const direct = extractId(keyword);
      if (direct) {
        try {
          const info = await this.comic.loadInfo(direct);
          if (info && info.title && info.chapters && Object.keys(info.chapters).length > 0) {
            return {
              comics: [{ id: direct, title: info.title, subtitle: info.subtitle || "", cover: info.cover || "", tags: [], description: "" }],
              maxPage: 1
            };
          }
        } catch (e) { /* 继续爬站匹配 */ }
      }
      // 2) 该站 /search 是假推荐流（任意词同结果），不浪费请求，直接爬本站推荐页匹配标题
      const pool = [];
      const pages = [WEB + "/", WEB + "/sort"];
      for (let pi = 0; pi < pages.length; pi++) {
        try {
          const res = await Network.get(pages[pi], { headers: HDRS });
          if (res.status === 200) pool.push.apply(pool, parseWmList(res.body));
        } catch (e) {}
      }
      const matched = matchByTitle(pool, keyword);
      if (matched.length > 0) return { comics: matched, maxPage: 1 };
      // 没匹配上时回显推荐页内容并标注，避免搜索全空
      const marked = pool.map(function(c) {
        return { id: c.id, title: c.title, subtitle: c.subtitle, cover: c.cover, tags: c.tags,
          description: (c.description || "") + "\n\n⚠️ 本站无真搜索：以上是首页推荐。想精准找漫画请粘贴漫画页链接或数字ID" };
      });
      return { comics: marked, maxPage: 1 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(WEB + "/comic/" + id + ".html", { headers: HDRS });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      const cover = html.match(/data-src="(https?:\/\/image4[^"]*cover\.webp)"/) || html.match(/(https?:\/\/image4[^"]*cover\.webp)/);
      const descMatch = html.match(/<meta name="description" content="([^"]+)"/);

      const doc = new HtmlDocument(html);
      const authors = [];
      doc.querySelectorAll("a").forEach(function(a) {
        if (!a.attributes || !a.attributes.href) return;
        if (a.attributes.href.indexOf("/author/") === 0) {
          const t = a.text.trim();
          if (t && authors.indexOf(t) < 0 && t.length < 20) authors.push(t);
        }
      });

      // HTML 里只有最近 24 话 + "加载更多"按钮；全量走 API（返回 最新→最旧，需反转）
      const chapters = {};
      try {
        const apiRes = await Network.post(WEB + "/comic/" + id, {
          headers: { "User-Agent": UA_MOBILE, "Referer": WEB + "/comic/" + id + ".html", "Content-Type": "application/json" }
        }, "{}");
        const data = JSON.parse(apiRes.body);
        const chs = (data && data.code === 0 && data.data && data.data.chapters) || [];
        for (let ci = chs.length - 1; ci >= 0; ci--) {
          const c = chs[ci];
          chapters["c" + c.id] = (c.chapterName || "").trim() || ("第" + c.id + "话");
        }
      } catch (e) {
        // API 失败回退 HTML（只有最新24话，顺序同样需反转）
        const chList = [];
        doc.querySelectorAll("a").forEach(function(a) {
          if (!a.attributes || !a.attributes.href) return;
          const m = a.attributes.href.match(/^\/chapter\/(\d+)-(\d+)\.html$/);
          if (!m) return;
          if (chList.some(function(x){ return x.id === m[2]; })) return;
          chList.push({ id: m[2], title: (a.text || "").trim() });
        });
        chList.reverse();
        for (let ci = 0; ci < chList.length; ci++) {
          chapters["c" + chList[ci].id] = chList[ci].title || ("第" + chList[ci].id + "话");
        }
      }

      return {
        title: h1 ? h1[1].trim() : id,
        subtitle: authors.join(", "),
        cover: cover ? cover[1] : "",
        description: descMatch ? descMatch[1] : "",
        tags: {},
        chapters: chapters
      };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "c") epId = epId.slice(1);
      const res = await Network.get(WEB + "/chapter/" + comicId + "-" + epId + ".html", { headers: HDRS });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      // 内联 JS: var pasd = "https://image4.wmanhua.com/mh/{hash}/{uid}/"; var num = eval("N")
      const pasd = html.match(/var\s+pasd\s*=\s*"(https?:\/\/[^"]+\/)"/);
      const num = html.match(/var\s+num\s*=\s*eval\("(\d+)"\)/) || html.match(/var\s+num\s*=\s*(\d+)/);
      if (!pasd || !num) throw "未找到图片数据";
      const total = parseInt(num[1]);
      const images = [];
      for (let i = 1; i <= total; i++) images.push(pasd[1] + i + ".webp");
      return { images: images };
    },

    onImageLoad: function(url, comicId, epId) { return { headers: { "User-Agent": UA_MOBILE, "Referer": WEB + "/" } }; }
  };
}
