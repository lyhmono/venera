// 神奇漫画 (sqmh.app) — Next.js SSR 站点
// 链路: /search?query= 真搜索 → /comic/{id} 详情(itemprop 微数据) → /read/{cid}/{ch} 图片(/image/ 前缀)
// 注意: 图片域名与页面同源 sqmh.app/image/...，无需特殊 Referer

class Sqmh extends ComicSource {
  name = "神奇漫画";
  key = "sqmh";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://sqmh.app";

  static API = "https://sqmh.app";
  static UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  init() {}

  get headers() {
    return {
      "User-Agent": Sqmh.UA,
      "Referer": Sqmh.API + "/",
    };
  }

  // 从搜索/列表页 HTML 解析漫画卡片（正则，页面是 Tailwind 无语义类名）
  parseCards(html) {
    const out = [];
    const seen = {};
    const re = /<a[^>]+href="\/comic\/([A-Za-z0-9]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const id = m[1];
      if (seen[id]) continue;
      const block = m[2];
      // 标题: class="...text-gray-900..." 的文本，或 alt="《xxx》封面"
      let title = "";
      const tm = block.match(/class="[^"]*text-gray-900[^"]*"[^>]*>([^<]*)</);
      if (tm) title = tm[1].trim();
      if (!title) {
        const am = block.match(/alt="《([^》]*)》封面"/);
        if (am) title = am[1].trim();
      }
      let cover = "";
      const im = block.match(/src="([^"]+)"/);
      if (im) {
        cover = im[1];
        if (cover.indexOf("http") !== 0) cover = Sqmh.API + cover;
      }
      if (title && cover) {
        seen[id] = true;
        out.push({ id, title, subtitle: "", cover, tags: [], description: "" });
      }
    }
    return out;
  }

  explore = [
    {
      title: "飙升榜",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Sqmh.API + "/ranking?type=hot" + (page > 1 ? "&page=" + page : ""), { headers: this.headers });
        return { comics: this.parseCards(res.body), maxPage: 1 };
      }
    },
    {
      title: "总榜",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Sqmh.API + "/ranking?type=total" + (page > 1 ? "&page=" + page : ""), { headers: this.headers });
        return { comics: this.parseCards(res.body), maxPage: 1 };
      }
    },
    {
      title: "最新更新",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Sqmh.API + "/comics?tag=%E5%85%A8%E9%83%A8&sort=latest" + (page > 1 ? "&page=" + page : ""), { headers: this.headers });
        return { comics: this.parseCards(res.body), maxPage: 20 };
      }
    }
  ];

  search = {
    load: async (keyword, options, page) => {
      const res = await Network.get(
        Sqmh.API + "/search?query=" + encodeURIComponent(keyword) + "&page=" + page,
        { headers: this.headers }
      );
      if (res.status !== 200) throw "HTTP " + res.status;
      return { comics: this.parseCards(res.body), maxPage: 1 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(Sqmh.API + "/comic/" + id, { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;

      const titleM = html.match(/<h1[^>]*>([^<]+)<\/h1>/) || html.match(/og:title" content="([^"]+)"/);
      let title = titleM ? titleM[1].trim() : id;

      const coverM = html.match(/og:image" content="([^"]+)"/);
      let cover = coverM ? coverM[1] : "";
      if (cover && cover.indexOf("http") !== 0) cover = Sqmh.API + cover;

      // 作者/描述: itemprop 微数据
      let subtitle = "";
      const authorM = html.match(/itemprop="author"[^>]*>([^<]+)</);
      if (authorM) subtitle = authorM[1].trim();

      let description = "";
      const descM = html.match(/<h2[^>]*itemprop="description"[^>]*>[\s\S]*?<span[^>]*>([^<]*)</);
      if (descM) description = descM[1].trim();
      if (!description) {
        const metaM = html.match(/og:description" content="([^"]+)"/);
        if (metaM) description = metaM[1];
      }

      // 章节: /read/{cid}/{chapterId} 链接全集
      const chapters = {};
      const seenC = {};
      const cre = /href="\/read\/([A-Za-z0-9]+)\/([A-Za-z0-9]+)"[^>]*>/g;
      let cm;
      while ((cm = cre.exec(html)) !== null) {
        const chId = cm[2];
        if (seenC[chId]) continue;
        seenC[chId] = true;
        chapters["c" + chId] = "第" + (Object.keys(chapters).length + 1) + "话";
      }
      // 章节标题优先取链接文本
      const cre2 = /<a[^>]*href="\/read\/[A-Za-z0-9]+\/([A-Za-z0-9]+)"[^>]*>([^<]{0,60})<\/a>/g;
      const titles = {};
      let cm2;
      while ((cm2 = cre2.exec(html)) !== null) {
        const t = cm2[2].trim();
        if (t && !titles[cm2[1]]) titles[cm2[1]] = t;
      }
      const final = {};
      for (const k in chapters) {
        const raw = k.slice(1);
        final[k] = titles[raw] || chapters[k];
      }

      return { title, subtitle, cover, description, tags: {}, chapters: final };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "c") epId = epId.slice(1);
      const res = await Network.get(Sqmh.API + "/read/" + comicId + "/" + epId, { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      // 图片: /image/xxx.webp（过滤封面）
      const images = [];
      const seen = {};
      const ire = /\/image\/([A-Za-z0-9_\/\.\-]+\.webp)/g;
      let im;
      while ((im = ire.exec(html)) !== null) {
        const u = Sqmh.API + "/image/" + im[1];
        if (seen[u]) continue;
        seen[u] = true;
        images.push(u);
      }
      if (!images.length) throw "未找到图片";
      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({ headers: this.headers })
  };
}
