// Buondua (buondua.com) — 写真图集站
// 链路: 首页/分页(a+img 卡片, URL带hash尾巴) → /{slug}-{hash}-{id} 图集
// 图片: i2.buondua.com 直链（URL 带 ?hash 签名, 直接用）

class Buondua extends ComicSource {
  name = "Buondua图集";
  key = "buondua";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://buondua.com";

  static WEB = "https://buondua.com";
  static UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  init() {}

  get headers() {
    return { "User-Agent": Buondua.UA, "Referer": Buondua.WEB + "/" };
  }

  // a > img 卡片（i*.buondua.com 图床的才算）
  parseCards(html) {
    const out = [];
    const seen = {};
    const are = /<a[^>]*href="([^"]+)"[^>]*>\s*<img[^>]*src="(https?:\/\/i\d?\.buondua\.com[^"]+)"/g;
    let m;
    while ((m = are.exec(html)) !== null) {
      let href = m[1];
      const cm = href.match(/^\/?([a-z0-9-]{8,}-[0-9a-f]{20,}-\d+)$/);
      if (!cm) continue;
      const id = cm[1];
      if (seen[id]) continue;
      // 标题从图 alt/文件名（URL 无中文标题）
      let title = "";
      const altM = m[0].match(/alt="([^"]*)"/);
      if (altM && altM[1]) title = altM[1];
      if (!title) {
        const fM = m[2].match(/\/([^\/?]+)\./);
        if (fM) title = fM[1].replace(/-/g, " ");
      }
      if (!title) continue;
      seen[id] = true;
      out.push({ id, title, subtitle: "", cover: m[2], tags: [], description: "" });
    }
    return out;
  }

  explore = [
    {
      title: "最新",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Buondua.WEB + (page > 1 ? "/page/" + page + "/" : "/"), { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 100 };
      }
    }
  ];

  search = {
    load: async (keyword, options, page) => {
      // buondua 搜索是 POST/GET ?s=
      const res = await Network.get(
        Buondua.WEB + "/?s=" + encodeURIComponent(keyword) + "&paged=" + page,
        { headers: this.headers }
      );
      if (res.status !== 200) throw "HTTP " + res.status;
      return { comics: this.parseCards(res.body), maxPage: 5 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(Buondua.WEB + "/" + id, { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      // 标题: h1/h2 或第一张图的 alt
      const titleM = html.match(/<h\d[^>]*>([^<]{5,80})</);
      let title = titleM ? titleM[1].trim() : id.split("-").slice(0, 4).join("-");
      const coverM = html.match(/(https?:\/\/i\d?\.buondua\.com[^"']+)/);
      let cover = coverM ? coverM[1] : "";

      // 单页全图（图集站无分章节, 伪章节1话）
      const chapters = { "c0": "全部图片" };
      return { title, subtitle: "", cover, description: "", tags: {}, chapters };
    },

    loadEp: async (comicId, epId) => {
      const res = await Network.get(Buondua.WEB + "/" + comicId, { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const images = [];
      const seen = {};
      const ire = /src="(https?:\/\/i\d?\.buondua\.com[^"']+)"/g;
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
