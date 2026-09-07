// 250漫画 (mh250.com / 中国人能飞) — 传统 PHP 站
// 链路: /ae6?searchkey= (搜索, 旧接口 /b41 已 404) → /book/{id}/ 详情(全章节在页面) → /book/{id}/{ch}.html 阅读(img.lazy data-original)
// 图片: res2.tupian.run 图床直链

class Mh250 extends ComicSource {
  name = "250漫画";
  key = "mh250";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://www.mh250.com";

  static WEB = "https://www.mh250.com";
  static UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  init() {}

  get headers() {
    return {
      "User-Agent": Mh250.UA,
      "Referer": Mh250.WEB + "/",
    };
  }

  // div.classification 容器: h2 a 标题+链接, img.tit_img 封面
  parseCards(html) {
    const out = [];
    const seen = {};
    const doc = new HtmlDocument(html);
    const divs = doc.querySelectorAll("div.classification");
    for (let i = 0; i < divs.length; i++) {
      const d = divs[i];
      const a = d.querySelector("h2 a");
      if (!a) continue;
      const href = (a.attributes && a.attributes.href) || "";
      const m = href.match(/\/book\/([a-z0-9]+)\/?/) || href.match(/\/book\/([a-z0-9]+)/);
      if (!m) continue;
      const id = m[1];
      if (seen[id]) continue;
      const img = d.querySelector("img.tit_img") || d.querySelector("img");
      let cover = "";
      if (img && img.attributes) cover = img.attributes["data-src"] || img.attributes.src || "";
      seen[id] = true;
      out.push({
        id,
        title: a.text.trim(),
        subtitle: "",
        cover: cover.indexOf("http") === 0 ? cover : (cover ? Mh250.WEB + cover : ""),
        tags: [],
        description: ""
      });
    }
    return out;
  }

  explore = [
    {
      title: "全部作品",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Mh250.WEB + "/sort/" + page + "/", { headers: this.headers });
        return { comics: this.parseCards(res.body), maxPage: 100 };
      }
    },
    {
      title: "排行榜",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Mh250.WEB + "/top.html", { headers: this.headers });
        return { comics: this.parseCards(res.body), maxPage: 1 };
      }
    },
    {
      title: "全本",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Mh250.WEB + "/quanben/sort/" + page + "/", { headers: this.headers });
        return { comics: this.parseCards(res.body), maxPage: 100 };
      }
    }
  ];

  search = {
    load: async (keyword, options, page) => {
      // 搜索路径动态轮换（b41→ae6→6fb...），首页 JS 里 msearchurl 才是当期真路径
      let searchPath = "/ae6";
      try {
        const home = await Network.get(Mh250.WEB + "/", { headers: this.headers });
        const m = home.body.match(/msearchurl='([^']+)'/);
        if (m) searchPath = m[1];
      } catch (e) { /* 用兜底路径 */ }
      const res = await Network.get(
        Mh250.WEB + searchPath + "?searchkey=" + encodeURIComponent(keyword) + (page > 1 ? "&p=" + page : ""),
        { headers: this.headers }
      );
      if (res.status !== 200) throw "HTTP " + res.status;
      return { comics: this.parseCards(res.body), maxPage: 1 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(Mh250.WEB + "/book/" + id + "/", { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      const doc = new HtmlDocument(html);

      const titleM = html.match(/og:novel:book_name" content="([^"]+)"/) || html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      let title = titleM ? titleM[1].trim() : id;
      const coverM = html.match(/class="ctdbLeft[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/);
      let cover = coverM ? coverM[1] : "";
      if (cover && cover.indexOf("http") !== 0) cover = Mh250.WEB + cover;

      // 简介
      let description = "";
      const descEl = doc.querySelector("p#worksDesc");
      if (descEl) description = descEl.text.trim();
      if (!description) {
        const metaM = html.match(/og:description" content="([^"]+)"/);
        if (metaM) description = metaM[1];
      }

      // 标签: h1 .labelBox a
      const tags = {};
      const labelList = [];
      doc.querySelectorAll("h1 .labelBox a, .labelBox a").forEach((a) => {
        const t = a.text.trim();
        if (t && labelList.indexOf(t) < 0) labelList.push(t);
      });
      if (labelList.length) tags["分类"] = labelList;

      // 章节: #detail-list-select-1 内全量 li a（页面顺序=第1章在前）
      const chapters = {};
      const seen = {};
      const items = doc.querySelectorAll("ul.view-win-list li a, #detail-list-select-1 a");
      const order = [];
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        const href = (a.attributes && a.attributes.href) || "";
        const cm = href.match(/\/book\/[a-z0-9]+\/(\d+)\.html/);
        if (!cm) continue;
        const chId = cm[1];
        if (seen[chId]) continue;
        seen[chId] = true;
        order.push({ id: chId, title: a.text.trim() });
      }
      for (let i = 0; i < order.length; i++) {
        chapters["c" + order[i].id] = order[i].title || "第" + (i + 1) + "话";
      }

      return { title, subtitle: "", cover, description, tags, chapters };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "c") epId = epId.slice(1);
      const res = await Network.get(Mh250.WEB + "/book/" + comicId + "/" + epId + ".html", { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      // img.lazy data-original（tupian.run 图床）
      const images = [];
      const seen = {};
      const ire = /data-original="(https?:\/\/[^"]+)"/g;
      let im;
      while ((im = ire.exec(res.body)) !== null) {
        if (seen[im[1]]) continue;
        seen[im[1]] = true;
        images.push(im[1]);
      }
      if (!images.length) throw "未找到图片";
      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({ headers: this.headers })
  };
}
