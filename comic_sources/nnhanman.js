// 鸟鸟韩漫 (nnhm95.com / nnhanman5.com 镜像) — PHP 站
// 链路: /catalog.php?search= → /comic/{slug}.html 详情(#mh-chapter-list-ol-0 章节倒序) → /comic/{slug}/chapter-{id}.html
// 图片: 阅读页 img.nnpic.xyz 直链；封面 new.niaopic.com
// ⚠️ 国内直连不通需代理（站方屏蔽大陆 IP）；域名频繁换代（95/5 备用切换）

class Nnhanman extends ComicSource {
  name = "鸟鸟韩漫";
  key = "nnhanman";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://nnhm95.com";

  static DOMAINS = ["https://nnhm95.com", "https://nnhanman5.com"];
  static _idx = 0;
  static get WEB() { return Nnhanman.DOMAINS[Nnhanman._idx]; }
  static UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  init() {}

  get headers() {
    return { "User-Agent": Nnhanman.UA, "Referer": Nnhanman.WEB + "/" };
  }

  // 主域名失败自动切镜像
  async fetch(path, tryNext) {
    let lastErr = null;
    for (let t = 0; t < Nnhanman.DOMAINS.length; t++) {
      const base = Nnhanman.DOMAINS[Nnhanman._idx];
      try {
        const res = await Network.get(base + path, { headers: this.headers });
        if (res.status < 400) return res;
        lastErr = "HTTP " + res.status;
      } catch (e) { lastErr = String(e); }
      Nnhanman._idx = (Nnhanman._idx + 1) % Nnhanman.DOMAINS.length;
    }
    throw lastErr || "all domains failed";
  }

  // 卡片: a href=/comic/{slug}.html + img + 标题
  parseCards(html) {
    const out = [];
    const seen = {};
    const doc = new HtmlDocument(html);
    const links = doc.querySelectorAll("a");
    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      const href = (a.attributes && a.attributes.href) || "";
      const m = href.match(/\/comic\/([a-z0-9-]+)\.html/);
      if (!m) continue;
      const slug = m[1];
      if (seen[slug]) continue;
      const img = a.querySelector("img");
      let title = "";
      const tEl = a.querySelector("span, h3, p");
      if (tEl) title = tEl.text.trim();
      if (!title && a.attributes && a.attributes.title) title = a.attributes.title.trim();
      let cover = "";
      if (img && img.attributes) cover = img.attributes.src || img.attributes["data-original"] || "";
      if (!title || !cover || cover.indexOf("/images/") === 0) continue;
      seen[slug] = true;
      out.push({ id: slug, title, subtitle: "", cover, tags: [], description: "" });
    }
    return out;
  }

  explore = [
    {
      title: "全部",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await this.fetch("/catalog.php?page=" + page);
        return { comics: this.parseCards(res.body), maxPage: 50 };
      }
    },
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await this.fetch("/?page=" + page);
        return { comics: this.parseCards(res.body), maxPage: 20 };
      }
    }
  ];

  search = {
    load: async (keyword, options, page) => {
      const res = await this.fetch("/catalog.php?search=" + encodeURIComponent(keyword) + "&page=" + page);
      return { comics: this.parseCards(res.body), maxPage: 5 };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const res = await this.fetch("/comic/" + id + ".html");
      const html = res.body;

      const titleM = html.match(/<title>([^<]+?)(?:无遮挡版|全集免费)/);
      let title = titleM ? titleM[1].trim() : id;
      const coverM = html.match(/(https?:\/\/(?:new|thumb)\.niaopic\.com[^"'\s]+)/);
      let cover = coverM ? coverM[1] : "";

      let description = "";
      const descM = html.match(/og:description" content="([^"]+)"/) || html.match(/name="description" content="([^"]+)"/);
      if (descM) description = descM[1];

      // 章节: #mh-chapter-list-ol-0 li a（第7話在前=倒序，反转）
      const chapters = {};
      const order = [];
      const seen = {};
      const cre = /<a href="\/comic\/[a-z0-9-]+\/chapter-(\d+)\.html"><span>([^<]*)<\/span><\/a>/g;
      let cm;
      while ((cm = cre.exec(html)) !== null) {
        if (seen[cm[1]]) continue;
        seen[cm[1]] = true;
        order.push({ id: cm[1], title: cm[2].trim() });
      }
      for (let i = order.length - 1; i >= 0; i--) {
        chapters["c" + order[i].id] = order[i].title || "话" + (i + 1);
      }

      return { title, subtitle: "", cover, description, tags: {}, chapters };
    },

    loadEp: async (comicId, epId) => {
      if (epId && epId[0] === "c") epId = epId.slice(1);
      const res = await this.fetch("/comic/" + comicId + "/chapter-" + epId + ".html");
      const images = [];
      const seen = {};
      const ire = /(?:data-src|data-original|src)="(https?:\/\/img\.nnpic\.xyz[^"']+)"/g;
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
