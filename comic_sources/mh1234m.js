// 漫画1234 (m.wmh1234.com) — BEM 风格移动站
// 链路: /search?key= → /comic/{id}.html 详情 → /go/{base64跳转码} → reader.hqread.cc 图片(data-src 带 st 签名)
// /go/ 链接 302 前有 JS location.replace 中转页，需解析出真实 reader URL

class Mh1234 extends ComicSource {
  name = "漫画1234";
  key = "mh1234m";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://m.wmh1234.com";

  static WEB = "https://m.wmh1234.com";
  static UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

  init() {}

  get headers() {
    return {
      "User-Agent": Mh1234.UA,
      "Referer": Mh1234.WEB + "/",
    };
  }

  // comic-card: .comic-card__link + .comic-card__image + .comic-card__info 内标题
  parseCards(html) {
    const out = [];
    const seen = {};
    const doc = new HtmlDocument(html);
    const links = doc.querySelectorAll("a.comic-card__link");
    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      const href = (a.attributes && a.attributes.href) || "";
      const m = href.match(/\/comic\/(\d+)\.html/) || href.match(/\/comic\/(\d+)/);
      if (!m) continue;
      const id = m[1];
      if (seen[id]) continue;
      const img = a.querySelector("img.comic-card__image") || a.querySelector("img");
      const nameEl = a.querySelector(".comic-card__name") || a.querySelector(".comic-card__title");
      if (!img || !nameEl) continue;
      const src = (img.attributes && (img.attributes["data-src"] || img.attributes.src)) || "";
      if (!src) continue;
      seen[id] = true;
      out.push({
        id,
        title: nameEl.text.trim(),
        subtitle: "",
        cover: src.indexOf("http") === 0 ? src : Mh1234.WEB + src,
        tags: [],
        description: ""
      });
    }
    return out;
  }

  explore = [
    {
      title: "热门",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Mh1234.WEB + "/custom/top" + (page > 1 ? "?p=" + page : ""), { headers: this.headers });
        return { comics: this.parseCards(res.body), maxPage: 5 };
      }
    },
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Mh1234.WEB + "/custom/update" + (page > 1 ? "?p=" + page : ""), { headers: this.headers });
        return { comics: this.parseCards(res.body), maxPage: 30 };
      }
    }
  ];

  search = {
    load: async (keyword, options, page) => {
      const res = await Network.get(
        Mh1234.WEB + "/search?key=" + encodeURIComponent(keyword) + (page > 1 ? "&p=" + page : ""),
        { headers: this.headers }
      );
      if (res.status !== 200) throw "HTTP " + res.status;
      return { comics: this.parseCards(res.body), maxPage: 1 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(Mh1234.WEB + "/comic/" + id + ".html", { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      const doc = new HtmlDocument(html);

      const titleM = html.match(/og:title" content="([^"]+)"/) || html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      let title = titleM ? titleM[1].trim() : id;
      title = title.replace(/\s*-\s*漫画1234网$/, "");
      const coverM = html.match(/(https?:\/\/[^"\s]*images\/cover\/[^"\s]+)/) || html.match(/og:image" content="([^"]+)"/);
      let cover = coverM ? coverM[1] : "";
      if (cover && cover.indexOf("http") !== 0) cover = Mh1234.WEB + cover;

      // 简介
      let description = "";
      const descM = html.match(/class="comic-detail__desc[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (descM) description = descM[1].replace(/<[^>]+>/g, "").trim();
      if (!description) {
        const metaM = html.match(/og:description" content="([^"]+)"/);
        if (metaM) description = metaM[1];
      }

      // 章节: .chapter-item / chapter-list 里 /go/ 链接
      const chapters = {};
      const seen = {};
      const items = doc.querySelectorAll(".chapter-list a, .chapter-item a, a.chapter-item");
      const order = [];
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        const href = (a.attributes && a.attributes.href) || "";
        if (href.indexOf("/go/") !== 0) continue;
        const goCode = href.slice(4);
        if (seen[goCode]) continue;
        seen[goCode] = true;
        order.push({ code: goCode, title: a.text.trim() });
      }
      // 页面 DOM 顺序是最新在前，反转
      for (let i = order.length - 1; i >= 0; i--) {
        chapters["c" + order[i].code] = order[i].title || ("第" + (order.length - i) + "话");
      }

      return { title, subtitle: "", cover, description, tags: {}, chapters };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "c") epId = epId.slice(1);
      // 1) /go/{code} 中转页 → location.replace("https://reader.hqread.cc/r/CODE")
      const res = await Network.get(Mh1234.WEB + "/go/" + epId, { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const m = res.body.match(/location\.replace\("([^"]+)"\)/);
      let readerUrl;
      if (m) readerUrl = m[1];
      else {
        const m2 = res.body.match(/url=(https?:\/\/[^"]+\/r\/[A-Za-z0-9=+]+)/);
        if (m2) readerUrl = m2[1];
      }
      if (!readerUrl) throw "无法解析阅读页地址";
      // 2) reader 页图片 data-src
      const rRes = await Network.get(readerUrl, { headers: { "User-Agent": Mh1234.UA, "Referer": Mh1234.WEB + "/" } });
      if (rRes.status >= 400) throw "HTTP " + rRes.status;
      const images = [];
      const seen = {};
      const ire = /data-src="(https?:\/\/[^"]+)"/g;
      let im;
      while ((im = ire.exec(rRes.body)) !== null) {
        if (seen[im[1]]) continue;
        seen[im[1]] = true;
        images.push(im[1]);
      }
      if (!images.length) throw "未找到图片";
      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({ headers: { "User-Agent": Mh1234.UA, "Referer": "https://reader.hqread.cc/" } })
  };
}
