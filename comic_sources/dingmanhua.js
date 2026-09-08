// 顶漫画 (dingmanhua.com) — 现代静态站
// 链路: /search/?query= (manga-card 卡片) → /comic/{id}.html 详情 → /chapter/{cid}-{chid}.html
// 图片: 阅读页内联 JS: var num=eval("N"); var pasd="https://image1.../uuid/"; 拼 pasd+i.webp
// 注意: /comic/{id} 无 .html 是分类页(易混), 详情必须带 .html

class Dingmanhua extends ComicSource {
  name = "顶漫画";
  key = "dingmanhua";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://www.dingmanhua.com";

  static WEB = "https://www.dingmanhua.com";
  static UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  init() {}

  get headers() {
    return { "User-Agent": Dingmanhua.UA, "Referer": Dingmanhua.WEB + "/" };
  }

  // .manga-card: a href=/comic/N.html + img[data-src] + alt=标题
  parseCards(html) {
    const out = [];
    const seen = {};
    const doc = new HtmlDocument(html);
    const cards = doc.querySelectorAll(".manga-card a, .manga-card");
    const links = cards.length ? cards : doc.querySelectorAll("a");
    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      const href = (a.attributes && a.attributes.href) || "";
      const m = href.match(/\/comic\/(\d+)\.html/);
      if (!m) continue;
      const id = m[1];
      if (seen[id]) continue;
      const img = a.querySelector("img") || (a.attributes && a.attributes.class && a.attributes.class.indexOf("manga-image") >= 0 ? a : null);
      let title = "";
      let cover = "";
      if (img && img.attributes) {
        cover = img.attributes["data-src"] || img.attributes.src || "";
        title = (img.attributes.alt || "").trim();
      }
      if (!title && a.attributes && a.attributes.title) title = a.attributes.title.trim();
      const tEl = a.querySelector("h3, .manga-title");
      if (!title && tEl) title = tEl.text.trim();
      if (!id || !cover) continue;
      if (cover.indexOf("//") === 0) cover = "https:" + cover;
      seen[id] = true;
      out.push({ id, title: title || id, subtitle: "", cover, tags: [], description: "" });
    }
    return out;
  }

  explore = [
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Dingmanhua.WEB + "/new" + (page > 1 ? "?page=" + page : ""), { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 50 };
      }
    },
    {
      title: "热门排行",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Dingmanhua.WEB + "/hot" + (page > 1 ? "?page=" + page : ""), { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 50 };
      }
    }
  ];

  search = {
    load: async (keyword, options, page) => {
      const res = await Network.get(
        Dingmanhua.WEB + "/search/?query=" + encodeURIComponent(keyword) + (page > 1 ? "&page=" + page : ""),
        { headers: this.headers }
      );
      if (res.status !== 200) throw "HTTP " + res.status;
      return { comics: this.parseCards(res.body), maxPage: 1 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(Dingmanhua.WEB + "/comic/" + id + ".html", { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      const doc = new HtmlDocument(html);

      const titleM = html.match(/og:title" content="([^<]+?)(?:最新章节|_手机在线阅读)/);
      let title = titleM ? titleM[1].trim() : id;
      const coverM = html.match(/og:image" content="([^"]+)"/);
      let cover = coverM ? coverM[1] : "";

      let description = "";
      const descM = html.match(/og:description" content='([^']+)'/) || html.match(/og:description" content="([^"]+)"/);
      if (descM) description = descM[1];

      // 章节: /chapter/{cid}-{chid}.html（详情页顺序: 最新在前）
      const chapters = {};
      const order = [];
      const seen = {};
      const cre = /href="(\/chapter\/(\d+)-(\d+)\.html)"/g;
      let cm;
      while ((cm = cre.exec(html)) !== null) {
        const chId = cm[3];
        if (seen[chId]) continue;
        seen[chId] = true;
        order.push(chId);
      }
      for (let i = order.length - 1; i >= 0; i--) {
        chapters["c" + order[i]] = "第" + (order.length - i) + "话";
      }

      // 作者/标签从 meta keywords 兜底
      const kwM = html.match(/meta name="keywords" content='([^']+)'/);
      if (kwM && !description) description = kwM[1];

      return { title, subtitle: "", cover, description, tags: {}, chapters };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "c") epId = epId.slice(1);
      const res = await Network.get(Dingmanhua.WEB + "/chapter/" + comicId + "-" + epId + ".html", { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      // var num =eval("N") ; var pasd = "https://..."
      const pasdM = html.match(/var\s+pasd\s*=\s*"([^"]+)"/);
      const numM = html.match(/var\s+num\s*=\s*eval\("(\d+)"\)/) || html.match(/var\s+num\s*=\s*(\d+)/);
      if (!pasdM || !numM) throw "阅读页解析失败";
      const base = pasdM[1];
      const n = parseInt(numM[1], 10);
      const images = [];
      for (let i = 1; i <= n; i++) images.push(base + i + ".webp");
      if (!images.length) throw "未找到图片";
      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({ headers: this.headers })
  };
}
