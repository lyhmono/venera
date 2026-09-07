// 武芊漫画 (comic.mkzcdn.com) — 纯 JSON API 站
// 链路: /search/keyword/ → /comic/info/?comic_id= → /chapter/v1/?comic_id= → /chapter/content/?chapter_id=&comic_id=
// 图片: oss.mkzcdn.com 直链无需特殊头

class Wuqian extends ComicSource {
  name = "武芊漫画";
  key = "wuqian";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://comic.mkzcdn.com";

  static API = "https://comic.mkzcdn.com";
  static UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

  init() {}

  get headers() {
    return {
      "User-Agent": Wuqian.UA,
      "Referer": Wuqian.API + "/",
    };
  }

  explore = [
    {
      title: "热门人气",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Wuqian.API + "/search/filter/?order=1&page_num=" + page + "&page_size=20", { headers: this.headers });
        return this.parseSearchList(res.body);
      }
    },
    {
      title: "更新时间",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Wuqian.API + "/search/filter/?order=2&page_num=" + page + "&page_size=20", { headers: this.headers });
        return this.parseSearchList(res.body);
      }
    },
    {
      title: "推荐",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(Wuqian.API + "/search/filter/?order=3&page_num=" + page + "&page_size=20", { headers: this.headers });
        return this.parseSearchList(res.body);
      }
    }
  ];

  parseSearchList(body) {
    const d = JSON.parse(body);
    const list = (d && d.data && d.data.list) || [];
    const comics = list.map((x) => ({
      id: x.comic_id,
      title: x.title,
      subtitle: x.author_title || "",
      cover: x.cover || x.cover_lateral || "",
      tags: [],
      description: (x.finish === "2" ? "完结" : "连载") + " · " + (x.chapter_title || "")
    }));
    return { comics, maxPage: 30 };
  }

  search = {
    load: async (keyword, options, page) => {
      const res = await Network.get(
        Wuqian.API + "/search/keyword/?keyword=" + encodeURIComponent(keyword) + "&page_num=" + page + "&page_size=20",
        { headers: this.headers }
      );
      if (res.status !== 200) throw "HTTP " + res.status;
      return this.parseSearchList(res.body);
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(Wuqian.API + "/comic/info/?comic_id=" + id, { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const d = JSON.parse(res.body);
      const info = (d && d.data) || {};
      const title = info.title || id;

      // 章节列表
      const chRes = await Network.get(Wuqian.API + "/chapter/v1/?comic_id=" + id, { headers: this.headers });
      const chapters = {};
      if (chRes.status === 200) {
        const cd = JSON.parse(chRes.body);
        const chs = (cd && cd.data) || [];
        // sort 倒序(9999 在前=最新)，反转成第1话在前
        chs.sort((a, b) => (parseInt(b.sort) || 0) - (parseInt(a.sort) || 0));
        for (let i = 0; i < chs.length; i++) {
          const c = chs[i];
          if (!c.chapter_id) continue;
          chapters["c" + c.chapter_id] = c.title || "第" + chs[i].number + "话";
        }
      }

      return {
        title,
        subtitle: info.author_title || "",
        cover: info.cover || "",
        description: info.content || "",
        tags: {},
        chapters
      };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "c") epId = epId.slice(1);
      const res = await Network.get(
        Wuqian.API + "/chapter/content/?chapter_id=" + epId + "&comic_id=" + comicId,
        { headers: this.headers }
      );
      if (res.status >= 400) throw "HTTP " + res.status;
      const d = JSON.parse(res.body);
      const pages = (d && d.data) || [];
      const images = pages.map((p) => p.image).filter(Boolean);
      if (!images.length) throw "未找到图片";
      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({ headers: this.headers })
  };
}
