// 92漫画 (www.92mh.com) — 传统 PHP 站
// 链路: /search/?keywords= → /manhua/{id}/ 详情(#chapter-list-N 全量章节) → /manhua/{id}/{ch}.html
// 图片: 阅读页 var chapterImages 数组, h5 站拼 css100.alltucdn.cc
// 注: m.92mh.com 有 JS 跳转盾, 一律走 www

class Mh92 extends ComicSource {
  name = "92漫画";
  key = "mh92";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "http://www.92mh.com";

  static WEB = "http://www.92mh.com";
  static H5 = "http://h5.92mh.com";
  static IMG = "https://css100.alltucdn.cc";
  static UA = "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

  init() {}

  get headers() {
    return { "User-Agent": Mh92.UA, "Referer": Mh92.WEB + "/" };
  }

  // 卡片: a.comic_img(带img无标题) 与 a.comic_list_det(带标题) 分离, 需按父 li 合并
  parseCards(html) {
    const out = [];
    const seen = {};
    const doc = new HtmlDocument(html);
    const links = doc.querySelectorAll("a");
    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      const href = (a.attributes && a.attributes.href) || "";
      const m = href.match(/^\/?manhua\/(\d+)\/?$/) || href.match(/92mh\.com\/manhua\/(\d+)\/?$/);
      if (!m) continue;
      const id = m[1];
      if (seen[id]) continue;
      const img = a.querySelector("img");
      if (!img) continue;
      const src = (img.attributes && (img.attributes["data-original"] || img.attributes.src)) || "";
      if (!src) continue;
      let cover = src.indexOf("//") === 0 ? "https:" + src : src;
      if (!seen[id + "c"]) { seen[id + "c"] = true; }
      else continue;
      // 标题: a 内 → a.title（搜索页卡片）→ img.alt（列表页卡片）
      let title = "";
      const t = a.querySelector(".list_con_zj, h3");
      if (t) title = t.text.trim();
      if (!title && a.attributes && a.attributes.title) title = a.attributes.title.trim();
      if (!title && img.attributes && img.attributes.alt) title = img.attributes.alt.trim();
      seen[id] = true;
      out.push({ id, title, subtitle: "", cover, tags: [], description: "" });
    }
    return out;
  }

  explore = [
    {
      title: "全部漫画",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Mh92.WEB + "/list/" + (page > 1 ? page + "/" : ""), { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 500 };
      }
    },
    {
      title: "少年热血",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Mh92.WEB + "/list/shaonian/" + (page > 1 ? page + "/" : ""), { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 500 };
      }
    },
    {
      title: "完结漫画",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Mh92.WEB + "/list/wanjie/" + (page > 1 ? page + "/" : ""), { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 500 };
      }
    }
  ];

  search = {
    load: async (keyword, options, page) => {
      const res = await Network.get(
        Mh92.WEB + "/search/?keywords=" + encodeURIComponent(keyword) + "&page=" + page,
        { headers: this.headers }
      );
      if (res.status !== 200) throw "HTTP " + res.status;
      return { comics: this.parseCards(res.body), maxPage: 1 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(Mh92.WEB + "/manhua/" + id + "/", { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;

      const titleM = html.match(/<title>([^<]+?)(?:漫画在线观看|_92漫画网|- 92漫画网)/);
      let title = titleM ? titleM[1].trim() : id;
      const coverM = html.match(/og:image" content="([^"]+)"/);
      let cover = coverM ? coverM[1] : "";

      let description = "";
      const descM = html.match(/og:description" content="([^"]+)"/);
      if (descM) description = descM[1];

      // 作者: .auth
      let subtitle = "";
      const auM = html.match(/class="auth[^"]*"[^>]*>([^<]+)</);
      if (auM) subtitle = auM[1].trim();

      // 章节: #chapter-list-N 里的 li a（顺序即第1话在前）
      const chapters = {};
      const seen = {};
      const cre = /<a\s+href="[^"]*\/manhua\/\d+\/(\d+)\.html"[^>]*>[\s\S]*?class="list_con_zj">([^<]*)</g;
      let cm;
      while ((cm = cre.exec(html)) !== null) {
        const chId = cm[1];
        if (seen[chId]) continue;
        seen[chId] = true;
        chapters["c" + chId] = cm[2].trim() || ("话" + chId);
      }

      return { title, subtitle, cover, description, tags: {}, chapters };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "c") epId = epId.slice(1);
      // h5 站直接吐图
      const res = await Network.get(Mh92.H5 + "/manhua/" + comicId + "/" + epId + ".html", { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const images = [];
      const seen = {};
      const ire = /(?:data-original|data-src|src)=['"](https?:\/\/[^'"]+\.(?:jpg|jpeg|webp|png|gif)[^'"]*)['"]/gi;
      let im;
      while ((im = ire.exec(res.body)) !== null) {
        const u = im[1];
        if (seen[u] || /logo|icon|banner|static/i.test(u)) continue;
        seen[u] = true;
        images.push(u);
      }
      // 兜底: www 站 chapterImages 数组 + css100 域拼
      if (!images.length) {
        const res2 = await Network.get(Mh92.WEB + "/manhua/" + comicId + "/" + epId + ".html", { headers: this.headers });
        const m = res2.body.match(/var\s+chapterImages\s*=\s*(\[[\s\S]*?\]);/);
        if (m) {
          const arr = JSON.parse(m[1].replace(/\\\//g, "/"));
          for (let i = 0; i < arr.length; i++) images.push(Mh92.IMG + arr[i]);
        }
      }
      if (!images.length) throw "未找到图片";
      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({ headers: { "User-Agent": Mh92.UA, "Referer": Mh92.WEB + "/" } })
  };
}
