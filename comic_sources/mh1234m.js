// 漫画1234 (m.wmh1234.com) — BEM 风格移动站
// 链路: /search?key= → /comic/{id}.html 详情 → /go/{base64跳转码} → reader.hqread.cc 图片(data-src 带 st 签名)
// /go/ 链接 302 前有 JS location.replace 中转页，需解析出真实 reader URL

class Mh1234 extends ComicSource {
  name = "漫画1234";
  key = "mh1234m";
  version = "1.1.0";
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

      // 2026-09 站点改版: mint-* 新模板
      const titleM = html.match(/id="mintWorkTitle"[^>]*>([^<]+)</) || html.match(/og:title" content="([^"]+)"/) || html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      let title = titleM ? titleM[1].trim() : id;
      title = title.replace(/\s*-\s*漫画1234网$/, "");
      const coverM = html.match(/class="mint-work-cover"[^>]*src="([^"]+)"/) || html.match(/(https?:\/\/[^"\s]*images\/cover\/[^"\s]+)/) || html.match(/og:image" content="([^"]+)"/);
      let cover = coverM ? coverM[1] : "";
      if (cover && cover.indexOf("http") !== 0) cover = Mh1234.WEB + cover;

      // 作者: mint-work-info 里 "xx 著"
      let subtitle = "";
      const auM = html.match(/id="mintWorkTitle">[^<]*<\/h2><p>([^<]*?)\s*著<\/p>/);
      if (auM) subtitle = auM[1].trim();

      // 简介（og:description 是站点通用文案, 弃用; 找 mint 详情区）
      let description = "";
      const descM = html.match(/class="mint-detail-desc[^"]*"[^>]*>([\s\S]*?)<\/div>/) || html.match(/class="comic-detail__desc[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (descM) description = descM[1].replace(/<[^>]+>/g, "").trim();

      // 标签: mint-tag / 分类词
      const tags = {};
      const tagList = [];
      const tgM = html.match(/<p>([^<]*(?:热血|少年|少女|玄幻|恋爱|冒险|搞笑|奇幻|悬疑|科幻|武侠|历史|战争|机战|运动|音乐|美食|治愈|萌系|青春|日常|架空|武侠|仙侠|修真|都市|总裁|古风|恐怖|惊悚|犯罪|推理|励志|教育|职场|战争|军旅|校园|格斗|侦探|穿越|重生|系统|后宫|百合|耽美|魔幻|魔法|异世界|丧尸|怪物|神话|传说|寓言|传记|纪实|散文|绘本|插画|写真|cosplay|Cosplay)[^<]*)<\/p>/i);
      if (tgM) {
        tgM[1].split(/\s+/).forEach((t) => { t = t.trim(); if (t && tagList.indexOf(t) < 0) tagList.push(t); });
      }
      if (tagList.length) tags["分类"] = tagList;

      // 章节: a[data-chapter-id] href=/go/{code}（2026-09 新模板, DOM 顺序最新在前）
      const chapters = {};
      const seen = {};
      const order = [];
      const items = doc.querySelectorAll("a[data-chapter-id]");
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        const href = (a.attributes && a.attributes.href) || "";
        if (href.indexOf("/go/") !== 0) continue;
        const goCode = href.slice(4);
        if (seen[goCode]) continue;
        seen[goCode] = true;
        order.push({ code: goCode, title: a.text.trim() });
      }
      // 兜底: 旧模板 .chapter-item（站点若回滚仍可用）
      if (!order.length) {
        const items2 = doc.querySelectorAll(".chapter-list a, .chapter-item a, a.chapter-item");
        for (let i = 0; i < items2.length; i++) {
          const a = items2[i];
          const href = (a.attributes && a.attributes.href) || "";
          if (href.indexOf("/go/") !== 0) continue;
          const goCode = href.slice(4);
          if (seen[goCode]) continue;
          seen[goCode] = true;
          order.push({ code: goCode, title: a.text.trim() });
        }
      }
      // 页面 DOM 顺序是最新在前，反转
      for (let i = order.length - 1; i >= 0; i--) {
        chapters["c" + order[i].code] = order[i].title || ("第" + (order.length - i) + "话");
      }

      return { title, subtitle, cover, description, tags, chapters };
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
