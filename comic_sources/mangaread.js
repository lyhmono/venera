// MangaRead (mangaread.org) — WordPress wp-manga 主题（英语漫画）
// 链路: /?s=kw&post_type=wp-manga → /manga/{slug}/ 详情(wp-manga-chapter 列表) → /manga/{slug}/chapter-N/
// 图片: 阅读页 .page-break img src（wp-content/uploads 直链）

class Mangaread extends ComicSource {
  name = "MangaRead";
  key = "mangaread";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://www.mangaread.org";

  static WEB = "https://www.mangaread.org";
  static UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  init() {}

  get headers() {
    return { "User-Agent": Mangaread.UA, "Referer": Mangaread.WEB + "/" };
  }

  // .c-tabs-item / .page-item-detail 卡片
  parseCards(html) {
    const out = [];
    const seen = {};
    const doc = new HtmlDocument(html);
    const links = doc.querySelectorAll("a");
    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      const href = (a.attributes && a.attributes.href) || "";
      const m = href.match(/\/manga\/([a-z0-9-]+)\/?$/i);
      if (!m) continue;
      const slug = m[1];
      if (seen[slug]) continue;
      // 需要卡片上下文（有 img 或标题）
      const img = a.querySelector("img");
      const tEl = a.querySelector("h3, h4, .post-title");
      let title = "";
      if (tEl) title = tEl.text.trim();
      if (!title && a.attributes && a.attributes.title) title = a.attributes.title.trim();
      let cover = "";
      if (img && img.attributes) cover = img.attributes.src || img.attributes["data-src"] || "";
      if (!title || !cover || cover.indexOf("/manga/") >= 0) continue;
      // 排除导航类链接（feed/genres 等）
      if (/^(feed|genres|chapter|tag)/i.test(slug)) continue;
      if (cover.indexOf("//") === 0) cover = "https:" + cover;
      seen[slug] = true;
      out.push({ id: slug, title, subtitle: "", cover, tags: [], description: "" });
    }
    return out;
  }

  explore = [
    {
      title: "Latest",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Mangaread.WEB + "/page/" + page + "/", { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 200 };
      }
    },
    {
      title: "Popular",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Mangaread.WEB + "/?m_order=views&paged=" + page, { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 50 };
      }
    }
  ];

  search = {
    load: async (keyword, options, page) => {
      const res = await Network.get(
        Mangaread.WEB + "/?s=" + encodeURIComponent(keyword) + "&post_type=wp-manga" + (page > 1 ? "&paged=" + page : ""),
        { headers: this.headers }
      );
      if (res.status !== 200) throw "HTTP " + res.status;
      return { comics: this.parseCards(res.body), maxPage: 5 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(Mangaread.WEB + "/manga/" + id + "/", { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      const doc = new HtmlDocument(html);

      const titleM = html.match(/<h1[^>]*>([^<]+)<\/h1>/) || html.match(/og:title" content="([^"]+)"/);
      let title = titleM ? titleM[1].trim() : id;
      if (title === id) {
        const tt = html.match(/<title>Read\s+([^<]+?)(?:\s+-\s*manga|manga Online)/);
        if (tt) title = tt[1].trim();
      }
      const coverM = html.match(/og:image" content="([^"]+)"/);
      let cover = coverM ? coverM[1] : "";

      let description = "";
      const descEl = doc.querySelector(".summary__content, .description, .story-content");
      if (descEl) description = descEl.text.trim().slice(0, 500);

      // 作者
      let subtitle = "";
      const auM = html.match(/Author<\/[^>]+>[\s\S]{0,200}?<a[^>]*>([^<]+)</) || html.match(/class="author-content"[^>]*>[\s\S]{0,100}?<a[^>]*>([^<]+)</);
      if (auM) subtitle = auM[1].trim();

      // 章节: li.wp-manga-chapter a（最新在前，反转）
      const chapters = {};
      const order = [];
      const seen = {};
      const cre = /class="wp-manga-chapter\s*"[^>]*>[\s\S]{0,300}?href="[^"]*\/chapter-([^\/"]+)\/"/g;
      let cm;
      while ((cm = cre.exec(html)) !== null) {
        const chId = cm[1];
        if (seen[chId]) continue;
        seen[chId] = true;
        order.push(chId);
      }
      for (let i = order.length - 1; i >= 0; i--) {
        chapters["c" + order[i]] = "Chapter " + order[i];
      }

      return { title, subtitle, cover, description, tags: {}, chapters };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "c") epId = epId.slice(1);
      const res = await Network.get(Mangaread.WEB + "/manga/" + comicId + "/chapter-" + epId + "/", { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const images = [];
      const seen = {};
      const ire = /page-break[^>]*>\s*<img[^>]*src="([^"]+?)"/g;
      let im;
      while ((im = ire.exec(res.body)) !== null) {
        const u = im[1].trim();
        if (seen[u] || u.indexOf("wp-content") < 0) continue;
        seen[u] = true;
        images.push(u);
      }
      if (!images.length) throw "未找到图片（该章节可能尚未上传）";
      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({ headers: this.headers })
  };
}
