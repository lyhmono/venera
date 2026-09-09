// 漫画屋 (mhua5.com) — mccms PHP 模板站
// 链路: /index.php/search?key= → /index.php/comic/{slug} 详情 → /index.php/chapter/{id}
// 图片: 阅读页 oss.mkzcdn.com 直链（懒加载 data-original）

class Mhua5 extends ComicSource {
  name = "漫画屋";
  key = "mhua5";
  version = "1.2.0";
  minAppVersion = "1.0.0";
  url = "https://www.mhua5.com";

  static WEB = "https://www.mhua5.com";
  static UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  init() {}

  get headers() {
    return { "User-Agent": Mhua5.UA, "Referer": Mhua5.WEB + "/" };
  }

  // 卡片: a[href*=/comic/] + img + 标题
  parseCards(html) {
    const out = [];
    const seen = {};
    const doc = new HtmlDocument(html);
    const links = doc.querySelectorAll("a");
    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      const href = (a.attributes && a.attributes.href) || "";
      const m = href.match(/\/comic\/([a-z0-9-]+)/i);
      if (!m || href.indexOf("category") >= 0 || href.indexOf("author") >= 0 || href.indexOf("user") >= 0) continue;
      const slug = m[1];
      if (slug === "add" || seen[slug]) continue;
      const img = a.querySelector("img");
      let title = "";
      const tEl = a.querySelector(".comic-name, h3, p");
      if (tEl) title = tEl.text.trim();
      if (!title && a.attributes && a.attributes.title) title = a.attributes.title.trim();
      if (!title && img && img.attributes && img.attributes.alt) title = img.attributes.alt.trim();
      let cover = "";
      if (img && img.attributes) cover = img.attributes["data-original"] || img.attributes.src || "";
      if (!title || !cover || cover.indexOf("http") !== 0) continue;
      seen[slug] = true;
      out.push({ id: slug, title, subtitle: "", cover, tags: [], description: "" });
    }
    return out;
  }

  explore = [
    {
      title: "热门推荐",
      type: "multiPageComicList",
      load: async (page) => {
        // 2026-09: /custom/update 等列表页是 Vue 壳（SSR 无卡片），只有首页是服务端渲染
        if (page > 1) return { comics: [], maxPage: 1 };
        const res = await Network.get(Mhua5.WEB + "/", { headers: this.headers });
        if (res.status !== 200) throw "HTTP " + res.status;
        return { comics: this.parseCards(res.body), maxPage: 1 };
      }
    }
  ];

  search = {
    load: async (keyword, options, page) => {
      const res = await Network.get(
        Mhua5.WEB + "/index.php/search?key=" + encodeURIComponent(keyword),
        { headers: this.headers }
      );
      if (res.status !== 200) throw "HTTP " + res.status;
      return { comics: this.parseCards(res.body), maxPage: 1 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await Network.get(Mhua5.WEB + "/index.php/comic/" + id, { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const html = res.body;

      const titleM = html.match(/<title>([^-_<]+)/);
      let title = titleM ? titleM[1].trim() : id;
      const coverM = html.match(/og:image" content="([^"]+)"/);
      let cover = coverM ? coverM[1] : "";

      let description = "";
      const descM = html.match(/(?:class="(?:desc|intro)[^"]*"|id="(?:desc|intro)")([^>]*)>([\s\S]*?)<\/(?:p|div)>/i);
      if (descM) description = descM[2].replace(/<[^>]+>/g, "").trim();
      if (!description) {
        const metaM = html.match(/og:description" content="([^"]+)"/);
        if (metaM) description = metaM[1];
      }

      let subtitle = "";
      const auM = html.match(/(?:作者|author)[：:]?\s*<\/?[^>]*>?\s*<a[^>]*>([^<]+)</);
      if (auM) subtitle = auM[1].trim();

      // 章节: /index.php/chapter/{id} + 邻近文本（最新在前, 反转）
      const chapters = {};
      const order = [];
      const seen = {};
      const cre = /<a[^>]*href="(?:https?:\/\/[^"]*?)?\/index\.php\/chapter\/(\d+)"[^>]*>\s*([^<]{0,60})</g;
      let cm;
      while ((cm = cre.exec(html)) !== null) {
        const chId = cm[1];
        if (seen[chId]) continue;
        seen[chId] = true;
        const t = cm[2].trim();
        order.push({ id: chId, title: t });
      }
      for (let i = order.length - 1; i >= 0; i--) {
        chapters["c" + order[i].id] = order[i].title || "话" + order[i].id;
      }
      // 站点对付费/VIP 书在未登录时隐藏章节列表（<ul> 空、按钮 href=""）——
      // 0 章时提示用户, 避免点开没反应
      if (order.length === 0) {
        description = (description ? description + "\n\n" : "") +
          "⚠️ 未获取到章节列表：该书可能为付费/VIP作品（需登录站点阅读），或已被下架。";
      }

      return { title, subtitle, cover, description, tags: {}, chapters };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "c") epId = epId.slice(1);
      const res = await Network.get(Mhua5.WEB + "/index.php/chapter/" + epId, { headers: this.headers });
      if (res.status >= 400) throw "HTTP " + res.status;
      const images = [];
      const seen = {};
      // oss.mkzcdn.com 懒加载真实图
      const ire = /(?:data-original|data-src)=['"](https?:\/\/oss\.mkzcdn\.com[^'"]+)['"]/g;
      let im;
      while ((im = ire.exec(res.body)) !== null) {
        if (seen[im[1]]) continue;
        seen[im[1]] = true;
        images.push(im[1]);
      }
      if (!images.length) {
        const ire2 = /src=['"](https?:\/\/oss\.mkzcdn\.com[^'"]+?\.(?:jpg|webp|png)[^'"]*)['"]/g;
        while ((im = ire2.exec(res.body)) !== null) {
          if (seen[im[1]]) continue;
          seen[im[1]] = true;
          images.push(im[1].replace(/!cover-\d+$/, ""));
        }
      }
      if (!images.length) throw "未找到图片";
      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({ headers: this.headers })
  };
}
