// MissKon (misskon.com) — WordPress 写真图集站
// 链路: /?s=kw 搜索(h2.entry-title a) → /{slug}/ 图集(bp.blogspot 图床) → /{slug}/N/ 分页
// 图片: img src 直链（blogspot s1600）
// ⚠️ 大陆直连不通需代理

class Misskon extends ComicSource {
  name = "MissKon图集";
  key = "misskon";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://misskon.com";

  static WEB = "https://misskon.com";
  static UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  init() {}

  get headers() {
    return { "User-Agent": Misskon.UA, "Referer": Misskon.WEB + "/" };
  }

  // h2.entry-title a 卡片
  parseCards(html) {
    const out = [];
    const seen = {};
    const doc = new HtmlDocument(html);
    const links = doc.querySelectorAll("a");
    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      const href = (a.attributes && a.attributes.href) || "";
      const m = href.match(/^https:\/\/misskon\.com\/([a-z0-9-]+)\/?$/i);
      if (!m) continue;
      const slug = m[1];
      if (seen[slug] || /^(feed|wp-json|about|sets|category|tag|page)/.test(slug)) continue;
      const img = a.querySelector("img");
      let title = "";
      const tEl = a.querySelector("h2, h3") || (a.attributes && a.attributes.title ? a : null);
      if (tEl) title = (tEl.text || (a.attributes && a.attributes.title) || "").trim();
      let cover = "";
      if (img && img.attributes) cover = img.attributes.src || img.attributes["data-src"] || "";
      if (!title || !cover) continue;
      if (cover.indexOf("//") === 0) cover = "https:" + cover;
      seen[slug] = true;
      out.push({ id: slug, title, subtitle: "", cover, tags: [], description: "" });
    }
    return out;
  }

  explore = [
    {
      title: "最新图集",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Misskon.WEB + (page > 1 ? "/page/" + page + "/" : "/"), { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 300 };
      }
    }
  ];

  search = {
    load: async (keyword, options, page) => {
      const res = await Network.get(
        Misskon.WEB + "/?s=" + encodeURIComponent(keyword) + (page > 1 ? "&paged=" + page : ""),
        { headers: this.headers }
      );
      if (res.status !== 200) throw "HTTP " + res.status;
      return { comics: this.parseCards(res.body), maxPage: 10 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(Misskon.WEB + "/" + id + "/", { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;

      const titleM = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)</);
      let title = titleM ? titleM[1].trim() : id;

      // 分页总数: page-numbers 列表
      let pages = 1;
      const pm = html.match(/class="[^"]*page-numbers[^"]*"[^>]*>(\d+)</g);
      if (pm) {
        for (let i = 0; i < pm.length; i++) {
          const n = parseInt(pm[i].match(/>(\d+)</)[1], 10);
          if (n > pages) pages = n;
        }
      }
      // 首图
      const coverM = html.match(/og:image" content="([^"]+)"/);
      let cover = coverM ? coverM[1] : "";

      // 伪章节: 第1页..第N页
      const chapters = {};
      for (let i = 1; i <= pages; i++) chapters["p" + i] = "第" + i + "/" + pages + "页";

      return { title, subtitle: "", cover, description: "", tags: {}, chapters };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "p") epId = epId.slice(1);
      const url = epId === "1" ? Misskon.WEB + "/" + comicId + "/" : Misskon.WEB + "/" + comicId + "/" + epId + "/";
      const res = await Network.get(url, { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const images = [];
      const seen = {};
      const ire = /<img[^>]*src="(https?:\/\/[^"]+?\.blogspot\.com[^"]+)"/g;
      let im;
      while ((im = ire.exec(res.body)) !== null) {
        if (seen[im[1]]) continue;
        seen[im[1]] = true;
        images.push(im[1]);
      }
      if (!images.length) {
        // 兜底: lazy 属性 + 任意图床（排除站内 UI）
        const ire2 = /<img[^>]*(?:data-lazy-src|data-src|data-original|src)="(https?:\/\/[^"]+\.(?:jpg|jpeg|webp|png)[^"]*)"/g;
        let im2;
        while ((im2 = ire2.exec(res.body)) !== null) {
          const u = im2[1];
          if (seen[u] || /misskon\.com\/wp-(?:content|includes)|avatar|logo|banner/i.test(u)) continue;
          seen[u] = true;
          images.push(u);
        }
      }
      if (!images.length) throw "未找到图片";
      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({ headers: this.headers })
  };
}
