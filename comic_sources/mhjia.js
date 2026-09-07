// 漫画家 (mhjia.com) — WordPress/PHP 站（小说+漫画混编，成人向韩漫为主）
// 链路: POST /e/search/ → 302 → 结果页(home-truyendecu 卡片) → /novel{id}/ 详情(list-chapter) → /novel{id}/chapter{N}.html
// 图片: img.comic_img 的 data-original（img1.du8.in），单引号属性！长章节 text.next 翻页
// ⚠️ 站点对高频访问掐连接，请节制并发

class Mhjia extends ComicSource {
  name = "漫画家";
  key = "mhjia";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://mhjia.com";

  static WEB = "https://mhjia.com";
  static UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  init() {}

  get headers() {
    return {
      "User-Agent": Mhjia.UA,
      "Referer": Mhjia.WEB + "/",
    };
  }

  // home-truyendecu 卡片: a[title] + img src
  parseCards(html) {
    const out = [];
    const seen = {};
    const doc = new HtmlDocument(html);
    const divs = doc.querySelectorAll("div.home-truyendecu");
    for (let i = 0; i < divs.length; i++) {
      const d = divs[i];
      const a = d.querySelector("a[title]");
      if (!a || !a.attributes || !a.attributes.title) continue;
      const href = a.attributes.href || "";
      const m = href.match(/\/novel(\d+)\/?/);
      if (!m) continue;
      const id = m[1];
      if (seen[id]) continue;
      const img = d.querySelector("img");
      let cover = "";
      if (img && img.attributes) cover = img.attributes.src || img.attributes["data-original"] || "";
      if (cover && cover.indexOf("http") !== 0) cover = Mhjia.WEB + cover;
      seen[id] = true;
      out.push({
        id,
        title: a.attributes.title.trim(),
        subtitle: "",
        cover,
        tags: [],
        description: ""
      });
    }
    return out;
  }

  explore = [
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: async (page) => {
        const url = Mhjia.WEB + "/latest/" + (page > 1 ? "index_" + page + ".html" : "");
        const res = await Network.get(url, { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 50 };
      }
    },
    {
      title: "热门排行",
      type: "multiPageComicList",
      load: async (page) => {
        const url = Mhjia.WEB + "/popular/" + (page > 1 ? "index_" + page + ".html" : "");
        const res = await Network.get(url, { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 50 };
      }
    },
    {
      title: "完本漫画",
      type: "multiPageComicList",
      load: async (page) => {
        const url = Mhjia.WEB + "/completed/" + (page > 1 ? "index_" + page + ".html" : "");
        const res = await Network.get(url, { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 50 };
      }
    },
    {
      title: "韩漫",
      type: "multiPageComicList",
      load: async (page) => {
        const url = Mhjia.WEB + "/hanman/" + (page > 1 ? "index_" + page + ".html" : "");
        const res = await Network.get(url, { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 50 };
      }
    }
  ];

  search = {
    load: async (keyword, options, page) => {
      // 搜索需走表单端点（302 → result/?searchid=），结果页直接解析
      const res = await Network.get(
        Mhjia.WEB + "/e/search/?keyboard=" + encodeURIComponent(keyword) + "&show=title,writer,byr",
        { headers: this.headers }
      );
      if (res.status === 200 && res.body.indexOf("home-truyendecu") >= 0) {
        return { comics: this.parseCards(res.body), maxPage: 1 };
      }
      // 兜底: GET index.php
      const res2 = await Network.get(
        Mhjia.WEB + "/e/search/index.php?keyboard=" + encodeURIComponent(keyword) + "&show=title,writer,byr&searchget=1",
        { headers: this.headers }
      );
      if (res2.status !== 200) throw "HTTP " + res2.status;
      return { comics: this.parseCards(res2.body), maxPage: 1 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(Mhjia.WEB + "/novel" + id + "/", { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;
      const doc = new HtmlDocument(html);

      const titleM = html.match(/<title>([^_<]+?)_[^<]*_漫画家<\/title>/) || html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      let title = titleM ? titleM[1].trim() : id;

      // 封面: class="book..." 里的 img
      let cover = "";
      const cm = html.match(/class="book[^"]*"[^>]*>[\s\S]{0,200}?<img[^>]*src="([^"]+)"/);
      if (cm) cover = cm[1];
      if (cover && cover.indexOf("http") !== 0) cover = Mhjia.WEB + cover;

      // 作者: itemprop=author
      let subtitle = "";
      const am = html.match(/itemprop=['"]author['"][^>]*>([^<]+)</);
      if (am) subtitle = am[1].trim();

      // 简介: desc-text
      let description = "";
      const dm = html.match(/class="desc-text"[^>]*>([\s\S]*?)<\/div>/);
      if (dm) description = dm[1].replace(/<[^>]+>/g, "").trim();

      // 章节: ul.list-chapter li a（最新在前，反转）
      const chapters = {};
      const order = [];
      const cre = /<a\s+href="(\/novel\d+\/chapter\d+\.html)"[^>]*title="([^"]*)"/g;
      let cm2;
      const seen = {};
      while ((cm2 = cre.exec(html)) !== null) {
        const chUrl = cm2[1];
        const nm = chUrl.match(/chapter(\d+)\.html/);
        if (!nm || seen[nm[1]]) continue;
        seen[nm[1]] = true;
        order.push({ n: parseInt(nm[1], 10), title: (cm2[2] || "").trim() });
      }
      order.sort((a, b) => a.n - b.n);
      for (let i = 0; i < order.length; i++) {
        chapters["c" + order[i].n] = order[i].title || "第" + (i + 1) + "话";
      }

      return { title, subtitle, cover, description, tags: {}, chapters };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "c") epId = epId.slice(1);
      const images = [];
      const seen = {};
      let page = 1;
      let url = Mhjia.WEB + "/novel" + comicId + "/chapter" + epId + ".html";
      // 长章节翻页（text.next）
      for (let guard = 0; guard < 30; guard++) {
        const res = await Network.get(url, { headers: this.headers });
        if (res.status >= 400) throw "HTTP " + res.status;
        // img.comic_img data-original —— 注意单引号属性
        const ire = /data-original=['"]([^'"]+)['"][^>]*class=['"][^'"]*comic_img/g;
        const ire2 = /class=['"][^'"]*comic_img[^'"]*['"][^>]*data-original=['"]([^'"]+)['"]/g;
        let im;
        while ((im = ire.exec(res.body)) !== null) {
          if (!seen[im[1]]) { seen[im[1]] = true; images.push(im[1]); }
        }
        while ((im = ire2.exec(res.body)) !== null) {
          if (!seen[im[1]]) { seen[im[1]] = true; images.push(im[1]); }
        }
        // 下一页: text.next href
        const nx = res.body.match(/class=['"]next['"][^>]*href=['"]([^'"]+)['"]/) || res.body.match(/href=['"]([^'"]+)['"][^>]*class=['"][^'"]*next/);
        if (!nx) break;
        let nextUrl = nx[1];
        if (nextUrl.indexOf("http") !== 0) nextUrl = Mhjia.WEB + nextUrl;
        // 防死循环: 下一页必须还是本话分页（chapterN_x.html 或同 chapterN）
        if (nextUrl.indexOf("chapter" + epId) < 0) break;
        url = nextUrl;
        page++;
      }
      if (!images.length) throw "未找到图片";
      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({ headers: this.headers })
  };
}
