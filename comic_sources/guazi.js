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

// ============ 瓜子漫画 guazimanhua.com ============
// 侦察结论（2026-09-06）:
//   搜索: /category.php?keyword=<kw> → 真搜索！结果含 /comic.php?id=
//   详情: /comic.php?id=<id> → H1 + /chapter.php?id=<chId> 章节
//   阅读: /chapter.php?id=<chId> → JSON-LD 给首图，图片序列 {n}_{i}.webp，总数在页面文本
//   图片: img.guazicdn.com/th/comics/chapters/{comicNum}/{dateDir}/{n}_{i}.webp
//   搜索栏增强: 输入数字ID或完整URL → 直接探测进详情

const WEB = "https://www.guazimanhua.com";
const HDRS = { "User-Agent": UA_MOBILE, "Referer": WEB + "/" };

function parseList(html) {
  const doc = new HtmlDocument(html);
  const out = [];
  const as_ = doc.querySelectorAll("a");
  for (let i = 0; i < as_.length; i++) {
    const a = as_[i];
    const href = (a.attributes && a.attributes.href) || "";
    if (href.indexOf("/comic.php?id=") !== 0) continue;
    const id = href.split("id=")[1];
    const img = a.querySelector("img");
    const cover = img ? ((img.attributes && img.attributes.src) || "") : "";
    const alt = img && img.attributes ? (img.attributes.alt || "") : "";
    const title = alt.replace(/漫画封面$/, "").trim();
    if (!id || !title) continue;
    out.push({ id: id, title: title, subtitle: "", cover: cover, tags: [], description: "" });
  }
  return out;
}

// 从任意输入提取漫画ID：纯数字 / 完整URL / comic.php?id=N
function extractId(q) {
  q = (q || "").trim();
  let m = q.match(/comic\.php\?id=(\d+)/);
  if (m) return m[1];
  if (/^\d{1,12}$/.test(q)) return q;
  return null;
}

class Guazi extends ComicSource {
  name = "瓜子漫画";
  key = "guazi";
  version = "1.2.0";
  minAppVersion = "1.0.0";
  url = WEB;

  explore = [
    {
      title: "每日更新",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(WEB + "/category.php?sort=daily" + (page > 1 ? "&page=" + page : ""), { headers: HDRS });
        return { comics: parseList(res.body), maxPage: 632 };
      }
    },
    {
      title: "人气最高",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(WEB + "/category.php?sort=hits" + (page > 1 ? "&page=" + page : ""), { headers: HDRS });
        return { comics: parseList(res.body), maxPage: 632 };
      }
    }
  ];

  category = {
    title: "瓜子分类",
    parts: [
      {
        name: "题材",
        type: "fixed",
        categories: ["冒险", "古风", "奇幻", "恋爱", "恐怖", "灵异", "悬疑"],
        itemType: "category",
        categoryParams: ["冒险", "古风", "奇幻", "恋爱", "恐怖", "灵异", "悬疑"]
      }
    ],
    enableRankingPage: false
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const res = await Network.get(WEB + "/category.php?tag=" + encodeURIComponent(param) + (page > 1 ? "&page=" + page : ""), { headers: HDRS });
      return { comics: parseList(res.body), maxPage: 100 };
    }
  };

  search = {
    load: async (keyword, options, page) => {
      // 1) ID/URL 直进：秒开不搜索
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
        } catch (e) { /* 探测失败继续走搜索 */ }
      }
      // 2) 真关键词搜索
      const res = await Network.get(WEB + "/category.php?keyword=" + encodeURIComponent(keyword), { headers: HDRS });
      return { comics: parseList(res.body), maxPage: 1 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(WEB + "/comic.php?id=" + id, { headers: HDRS });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      if (html.indexOf("这个页面暂时找不到") >= 0) throw "漫画不存在: " + id;
      const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      const cover = html.match(/og:image"[^>]*content="([^"]+)"/) || html.match(/<img[^>]*src="([^"]*cover[^"]*)"/);
      const descMatch = html.match(/<meta name="description" content="([^"]+)"/);

      const doc = new HtmlDocument(html);
      const authors = [];
      doc.querySelectorAll("a").forEach(function(a) {
        if (!a.attributes || !a.attributes.href) return;
        if (a.attributes.href.indexOf("/author/") === 0 || a.attributes.href.indexOf("/search.php?author=") === 0) {
          const t = a.text.trim();
          if (t && authors.indexOf(t) < 0) authors.push(t);
        }
      });

      // 页面章节列表为 最新→最旧，且混有"开始阅读"类按钮；先收集去重再反转
      const seenCh = {};
      const chList = [];
      doc.querySelectorAll("a").forEach(function(a) {
        if (!a.attributes || !a.attributes.href) return;
        const h = a.attributes.href;
        if (h.indexOf("/chapter.php?id=") !== 0) return;
        const cid = h.split("id=")[1];
        // 章节 <a> 内可能嵌套"阅读"徽标，text 含换行噪声——取首行清洗
        let t = (a.text || "").split("\n")[0].trim();
        if (!t || t === "开始阅读" || t === "阅读" || t.indexOf("从第一章") >= 0) return;
        if (seenCh[cid]) return;
        seenCh[cid] = true;
        chList.push({ id: cid, title: t });
      });
      chList.reverse();
      const chapters = {};
      for (let ci = 0; ci < chList.length; ci++) {
        chapters["c" + chList[ci].id] = chList[ci].title;
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
      const res = await Network.get(WEB + "/chapter.php?id=" + epId, { headers: HDRS });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      // 首图 URL 从 JSON-LD 拿（后缀 webp/jpg 随站点轮换, 提取实际后缀用于序列拼接）
      const firstImg = html.match(/"image":"(https:[^"]+\.(?:webp|jpg|jpeg|png))"/);
      if (!firstImg) throw "未找到图片数据";
      const firstUrl = firstImg[1];
      // 图片总数从描述文本 "本章共N张漫画图片" 拿
      const cnt = html.match(/共(\d+)张漫画图片/);
      const total = cnt ? parseInt(cnt[1]) : 0;
      if (!total) throw "未解析到图片总数";
      const prefix = firstUrl.replace(/_\d+\.(webp|jpg|jpeg|png)$/, "");
      const ext = (firstUrl.match(/\.(webp|jpg|jpeg|png)$/) || [,"webp"])[1];
      const images = [];
      for (let i = 1; i <= total; i++) images.push(prefix + "_" + i + "." + ext);
      return { images: images };
    },

    onImageLoad: function(url, comicId, epId) { return { headers: { "User-Agent": UA_MOBILE, "Referer": WEB + "/" } }; }
  };
}
