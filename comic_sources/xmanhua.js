// x漫画 (xmanhua.com) — 日漫站（繁体）
// 链路: /search?title= → /{mid}xm/ 详情(章节 /m{cid}/) → /m{cid}/ 阅读页
// 图片: /chapterimage.ashx?cid&page&key&_cid&_mid&_dt&_sign 返回 eval-packer JS，解包得 image.xmanhua.com 直链
// ⚠️ 需代理访问；sign/dt 从阅读页变量提取

// eval-packer 解包（纯 JS, 无 eval）
function xmUnpack(packed) {
  const m = packed.match(/\}\('([\s\S]+?)',(\d+),(\d+),'([\s\S]*?)'\.split/);
  if (!m) return packed;
  const p = m[1], a = parseInt(m[2], 10), c = parseInt(m[3], 10);
  const k = m[4].split('|');
  const chrMap = (n) => {
    if (n < 36) return "0123456789abcdefghijklmnopqrstuvwxyz"[n];
    if (n < 62) return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[n - 36];
    return String.fromCharCode(n - 62 + 90); // 兜底, 62+
  };
  const eNum = (n_) => {
    let s = "";
    while (n_ >= a) { s = chrMap(n_ % a) + s; n_ = Math.floor(n_ / a); }
    return chrMap(n_) + s;
  };
  const d = {};
  for (let ci = 0; ci < c; ci++) {
    const key = eNum(ci);
    d[key] = k[ci] !== "" ? k[ci] : key;
  }
  // 替换 p 里的单词 token
  let out = p.replace(/\b(\w+)\b/g, (all, w) => (d[w] !== undefined ? d[w] : w));
  return out;
}

class Xmanhua extends ComicSource {
  name = "x漫画";
  key = "xmanhua";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://xmanhua.com";

  static WEB = "https://xmanhua.com";
  static UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  init() {}

  get headers() {
    return { "User-Agent": Xmanhua.UA, "Referer": Xmanhua.WEB + "/" };
  }

  // 卡片: 封面 a>img.mh-cover + 标题 h2.title>a[title] 双通道
  parseCards(html) {
    const out = [];
    const seen = {};
    // 标题表: h2.title > a[title]
    const titles = {};
    const tre = /<h\d class="title">\s*<a href="\/(\d+xm)\/" title="([^"]+)"/g;
    let tm;
    while ((tm = tre.exec(html)) !== null) {
      if (!titles[tm[1]]) titles[tm[1]] = tm[2];
    }
    // 封面: a href=/Nxm/ > img.mh-cover
    const are = /<a[^>]*href="\/(\d+xm)\/?"[^>]*>\s*<img[^>]*src="([^"]+)"/g;
    let m;
    while ((m = are.exec(html)) !== null) {
      const id = m[1];
      if (seen[id]) continue;
      const title = titles[id] || "";
      if (!title) continue;
      seen[id] = true;
      out.push({ id, title, subtitle: "", cover: m[2], tags: [], description: "" });
    }
    return out;
  }

  explore = [
    {
      title: "全部漫画",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Xmanhua.WEB + "/manga-list/" + (page > 1 ? page + "/" : ""), { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 200 };
      }
    }
  ];

  search = {
    load: async (keyword, options, page) => {
      const res = await Network.get(
        Xmanhua.WEB + "/search?title=" + encodeURIComponent(keyword) + "&f=" + page,
        { headers: this.headers }
      );
      if (res.status !== 200) throw "HTTP " + res.status;
      return { comics: this.parseCards(res.body), maxPage: 3 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(Xmanhua.WEB + "/" + id + "/", { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;

      const titleM = html.match(/<title>([^<]+?)(?:漫畫|_)/);
      let title = titleM ? titleM[1].trim() : id;
      const coverM = html.match(/(https?:\/\/cover\.xmanhua\.com[^"']+)/);
      let cover = coverM ? coverM[1] : "";

      let description = "";
      const descM = html.match(/og:description" content="([^"]+)"/) || html.match(/name="description" content="([^"]+)"/);
      if (descM) description = descM[1];

      // 章节: /m{cid}/ 链接（倒序, 反转; 去重）
      const chapters = {};
      const order = [];
      const seen = {};
      const cre = /href="(\/m(\d+)\/)"[^>]*>([^<]{0,40})</g;
      let cm;
      while ((cm = cre.exec(html)) !== null) {
        const cid = cm[2];
        if (seen[cid]) continue;
        seen[cid] = true;
        const t = cm[3].trim();
        if (t && t.indexOf("閱讀") < 0) order.push({ id: cid, title: t });
      }
      for (let i = order.length - 1; i >= 0; i--) {
        chapters["c" + order[i].id] = order[i].title || "話" + (i + 1);
      }

      return { title, subtitle: "", cover, description, tags: {}, chapters };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "c") epId = epId.slice(1);
      // 1) 阅读页提取 sign/dt/mid
      const pageRes = await Network.get(Xmanhua.WEB + "/m" + epId + "/", { headers: this.headers });
      if (pageRes.status >= 400) throw "HTTP " + pageRes.status;
      const html = pageRes.body;
      const cid = (html.match(/XMANHUA_CID\s*=\s*["']?(\d+)/) || [])[1] || epId;
      const mid = (html.match(/XMANHUA_MID\s*=\s*["']?(\d+)/) || [])[1] || comicId.replace("xm", "");
      const sign = (html.match(/XMANHUA_VIEWSIGN\s*=\s*["']([a-f0-9]+)/) || [])[1];
      const dt = (html.match(/XMANHUA_VIEWSIGN_DT\s*=\s*["']([^"']+)["']/) || [])[1];
      const imgCount = (html.match(/XMANHUA_IMAGE_COUNT\s*=\s*["']?(\d+)/) || [])[1];
      if (!sign || !dt) throw "阅读页签名提取失败";

      // 2) chapterimage.ashx 解包
      const api = Xmanhua.WEB + "/chapterimage.ashx?cid=" + cid + "&page=1&key=&_cid=" + cid +
        "&_mid=" + mid + "&_dt=" + encodeURIComponent(dt) + "&_sign=" + sign;
      const apiRes = await Network.get(api, { headers: { "User-Agent": Xmanhua.UA, "Referer": Xmanhua.WEB + "/m" + epId + "/" } });
      if (apiRes.status >= 400) throw "HTTP " + apiRes.status;
      const packed = apiRes.body;
      // eval-packer 解包: 先 unpack 还原明文, 再提取 pix/pvalue
      const unpacked = xmUnpack(packed);
      const pixM = unpacked.match(/var\s+pix\s*=\s*"([^"]+)"/);
      const arrM = unpacked.match(/var\s+pvalue\s*=\s*\[([\s\S]*?)\]/);
      if (!pixM || !arrM) throw "图片数据解包失败";
      const base = pixM[1];
      const files = arrM[1].match(/"[^"]*"/g) || [];
      const images = [];
      for (let i = 0; i < files.length; i++) {
        images.push(base + files[i].replace(/"/g, ""));
      }
      if (!images.length) throw "未找到图片";
      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({ headers: this.headers })
  };
}
