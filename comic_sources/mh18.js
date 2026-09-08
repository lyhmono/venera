/** @type {import('./_venera_.js')} */
class MH18 extends ComicSource {
  // Note: The fields which are marked as [Optional] should be removed if not used

  // name of the source
  name = "18漫画"

  // unique id of the source
  key = "mh18"

  version = "2.0.0"

  minAppVersion = "1.4.0"

  // update url
  url = "https://cdn.jsdelivr.net/gh/lyhmono/venera@master/comic_sources/mh18.js"

  settings = {
    domains: {
      title: "域名",
      type: "input",
      default: "18mh.net"
    }
  }

  get baseUrl() {
    return `https://${this.loadSetting("domains")}`;
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Referer": this.baseUrl
    };
  }

  // 2026-09 v2.0.0: 站点整体改版(18mh.org→18mh.net 新模板), 全链路重写
  // 卡片: ul.dx-novel-list > li > a[href=/comic/detail/N] > img[data-src] alt=标题
  parseComics(doc) {
    const result = [];
    for (let item of doc.querySelectorAll("ul.dx-novel-list > li > a")) {
      const href = item.attributes["href"];
      if (!href || !href.includes("/comic/detail/")) continue;
      const m = href.match(/\/comic\/detail\/(\d+)/);
      if (!m) continue;
      let cover = item.querySelector("img");
      let coverUrl = cover && (cover.attributes["data-src"] || cover.attributes["src"]) || "";
      let title = (cover && cover.attributes["alt"]) || "";
      result.push(new Comic({
        id: m[1],
        title: title,
        cover: coverUrl
      }));
    }
    return result;
  }

  // explore page list
  explore = [
    {
      title: this.name,
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(`${this.baseUrl}/comic/all?page=${page}`, this.headers);
        if (res.status !== 200) {
          throw `Invalid status code: ${res.status}`;
        }
        const document = new HtmlDocument(res.body);
        return {
          comics: this.parseComics(document),
          maxPage: null
        };
      }
    }
  ]

  // categories
  category = {
    title: this.name,
    parts: [
      {
        name: "分类",
        type: "fixed",
        categories: [
          "全部",
          "日漫",
          "韩漫",
          "真人写真",
          "热门",
          "最新"
        ],
        itemType: "category",
        categoryParams: [
          "/comic/all",
          "/comic/all/rb",
          "/comic/all/hg",
          "/comic/all/db",
          "/comic/hot",
          "/comic/newest"
        ],
      },
    ],
    enableRankingPage: false,
  }

  /// category comic loading related
  categoryComics = {
    load: async (category, params, options, page) => {
      const res = await Network.get(`${this.baseUrl}${params}?page=${page}`, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const document = new HtmlDocument(res.body);
      return {
        comics: this.parseComics(document),
        maxPage: null
      };
    }
  }

  /// search related
  search = {
    // 2026-09: 搜索路径 /s/{kw} 已废, 新站为 /comic/search/{kw}
    load: async (keyword, options, page) => {
      const res = await Network.get(
        `${this.baseUrl}/comic/search/${encodeURIComponent(keyword)}?page=${page}`,
        this.headers
      );
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const document = new HtmlDocument(res.body);
      return {
        comics: this.parseComics(document),
        maxPage: null
      };
    },
    enableTagsSuggestions: false,
  }

  /// single comic related
  comic = {
    onThumbnailLoad: (url) => {
      return {
        headers: this.headers
      }
    },
    loadInfo: async (id) => {
      const res = await Network.get(`${this.baseUrl}/comic/detail/${id}`, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const document = new HtmlDocument(res.body);
      const title = document.querySelector("h1").text.trim();
      let cover = "";
      let description = "";
      const meta = document.querySelector('meta[property="og:image"]');
      if (meta) {
        cover = meta.attributes["content"] || "";
      }
      const descMeta = document.querySelector('meta[property="og:description"]');
      if (descMeta) {
        description = descMeta.attributes["content"] || "";
      }
      // 标签: /comic/tag/{urlencoded} 链接
      const tags = { "标签": [] };
      const tagLinks = document.querySelectorAll('a[href*="/comic/tag/"]');
      for (let t of tagLinks) {
        const name = t.text.trim();
        if (name) tags["标签"].push(name);
      }
      // 章节: /comic/chapter/{id}/{n}
      const chapters = {};
      const chapLinks = document.querySelectorAll('a[href*="/comic/chapter/"]');
      const seen = new Set();
      for (let c of chapLinks) {
        const href = c.attributes["href"];
        const m = href.match(/\/comic\/chapter\/(\d+)\/(\d+)/);
        if (!m) continue;
        const key = m[2];
        if (seen.has(key)) continue;
        seen.add(key);
        chapters[key] = c.text.trim() || `第${m[2]}话`;
      }
      return new ComicDetails({
        title: title,
        cover: cover,
        description: description,
        tags: tags,
        chapters: chapters,
      });
    },

    loadEp: async (comicId, epId) => {
      const res = await Network.get(`${this.baseUrl}/comic/chapter/${comicId}/${epId}`, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const document = new HtmlDocument(res.body);
      const images = [];
      for (let i of document.querySelectorAll("img")) {
        const url = i.attributes["data-src"] || i.attributes["src"];
        if (url && /^https?:\/\//.test(url) && /(upload|photo|image)/.test(url)) {
          images.push(url);
        }
      }
      return { images };
    },

    enableTagsTranslate: false,
  }

  /// login related
  login = {
    // 2026-09: 站点登录系统未摸清, 暂不提供
    supportLogin: false,
  }
}
