// Everia (everia.club) — 日韩写真图集站（WordPress）
// 链路: /japan-gallery/ 等分区(a+img) → /年/月/日/slug/ 图集页
// 图片: reiobox.top / karubox.top 等 WP 图床直链
// ⚠️ 需代理访问

class Everia extends ComicSource {
  name = "Everia图集";
  key = "everia";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://everia.club";

  static WEB = "https://everia.club";
  static UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  init() {}

  get headers() {
    return { "User-Agent": Everia.UA, "Referer": Everia.WEB + "/" };
  }

  // a > img 卡片（文章 URL /年/月/日/slug/）
  parseCards(html) {
    const out = [];
    const seen = {};
    const are = /<a[^>]*href="(https?:\/\/everia\.club\/\d{4}\/\d{2}\/\d{2}\/([a-z0-9%\-\u4e00-\u9fff]+)\/?)"[^>]*>\s*<img[^>]*src="([^"]+)"/g;
    let m;
    while ((m = are.exec(html)) !== null) {
      const slug = decodeURIComponent(m[2]);
      if (seen[slug]) continue;
      let title = "";
      const altM = m[0].match(/alt="([^"]*)"/);
      if (altM && altM[1]) title = altM[1];
      if (!title) title = slug;
      seen[slug] = true;
      out.push({ id: m[1], title, subtitle: "", cover: m[3], tags: [], description: "" });
    }
    return out;
  }

  explore = [
    {
      title: "日本图集",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Everia.WEB + "/japan-gallery/" + (page > 1 ? "page/" + page + "/" : ""), { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 100 };
      }
    },
    {
      title: "韩国图集",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Everia.WEB + "/korea-gallery/" + (page > 1 ? "page/" + page + "/" : ""), { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 100 };
      }
    },
    {
      title: "Cosplay",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Everia.WEB + "/cosplay-gallery/" + (page > 1 ? "page/" + page + "/" : ""), { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 100 };
      }
    }
  ];

  search = {
    load: async (keyword, options, page) => {
      const res = await Network.get(
        Everia.WEB + "/?s=" + encodeURIComponent(keyword) + (page > 1 ? "&paged=" + page : ""),
        { headers: this.headers }
      );
      if (res.status !== 200) throw "HTTP " + res.status;
      return { comics: this.parseCards(res.body), maxPage: 5 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      // id 是完整 URL
      const res = await Network.get(id, { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      const titleM = html.match(/<h\d[^>]*class="[^"]*(?:entry|post)[^"]*"[^>]*>([^<]+)</);
      let title = titleM ? titleM[1].trim() : id.split("/").pop();
      const coverM = html.match(/og:image" content="([^"]+)"/);
      let cover = coverM ? coverM[1] : "";

      const chapters = { "c0": "全部图片" };
      return { title, subtitle: "", cover, description: "", tags: {}, chapters };
    },

    loadEp: async (comicId, epId) => {
      const res = await Network.get(comicId, { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const images = [];
      const seen = {};
      const ire = /(?:data-src|src)="(https?:\/\/(?:reiobox|karubox|[a-z]+box)\.top\/wp-content\/uploads\/[^"']+)"/g;
      let im;
      while ((im = ire.exec(res.body)) !== null) {
        if (seen[im[1]]) continue;
        seen[im[1]] = true;
        images.push(im[1]);
      }
      if (!images.length) {
        const ire2 = /<img[^>]*src="(https?:\/\/[^"]+\.(?:webp|jpe?g|png)[^"]*)"/g;
        while ((im = ire2.exec(res.body)) !== null) {
          if (seen[im[1]] || /everia\.club\/wp-(?:content|includes)|avatar|logo/i.test(im[1])) continue;
          seen[im[1]] = true;
          images.push(im[1]);
        }
      }
      if (!images.length) throw "未找到图片";
      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({ headers: this.headers })
  };
}
