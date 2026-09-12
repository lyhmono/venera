// 通用 venera 图源健康检查器
// 用法: node check_one.js <srcFile> <className> <keyword>
const fs = require('fs');
const cheerio = require('cheerio');

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function makeDocFromHtml(html) {
  const $ = cheerio.load(html);
  const wrap = (sel) => {
    const arr = [];
    $(sel).each((i, el) => arr.push(wrapOne(el)));
    return arr;
  };
  const wrapOne = (el) => {
    const $el = $(el);
    const attrs = {};
    if (el && el.attribs) { for (const k in el.attribs) attrs[k] = el.attribs[k]; }
    return {
      get text() { return $el.text().trim(); },
      get innerHTML() { return $el.html(); },
      get outerHTML() { return $.html($el); },
      get attributes() { return attrs; },
      get src() { return attrs.src || attrs['data-src'] || ''; },
      get children() { return $el.children().toArray().map(wrapOne); },
      querySelector(q) { const r = $el.find(q).first(); return r.length ? wrapOne(r.get(0)) : null; },
      querySelectorAll(q) { return wrap2($el, q); }
    };
  };
  const wrap2 = ($root, q) => {
    const out = [];
    $root.find(q).each((i, el) => out.push(wrapOne(el)));
    return out;
  };
  return {
    querySelectorAll: (q) => { const out = []; $(q).each((i, el) => out.push(wrapOne(el))); return out; },
    querySelector: (q) => { const el = $(q).first(); return el.length ? wrapOne(el.get(0)) : null; },
    _root: $
  };
}

const ab = (b) => { const u = new Uint8Array(Buffer.isBuffer(b) ? b : Buffer.from(b)); return u.buffer; };
const undici = require('undici');
const UFETCH = undici.fetch;   // Node 全局 fetch 不认 dispatcher，必须用 undici 自己的
const PROXY_DISPATCHER = (() => {
  const px = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!px) return undefined;
  try { return new undici.ProxyAgent(px); } catch (e) { return undefined; }
})();

async function main() {
  const [srcFile, className, keyword] = process.argv.slice(2);
  const src = fs.readFileSync(srcFile, 'utf8');

  const settings = {};
  const Network = {
    _req: [],
    async sendRequest(method, url, headers, data, extra) {
      // 兼容真机 API: Network.get(url, { headers }) —— options 对象包装
      if (headers && headers.headers && typeof headers.headers === 'object') headers = headers.headers;
      const h = Object.assign({ 'User-Agent': UA }, headers || {});
      const opts = { method, headers: h, redirect: 'follow', dispatcher: PROXY_DISPATCHER };
      if (data && method !== 'GET') opts.body = typeof data === 'string' ? data : JSON.stringify(data);
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 25000);
      opts.signal = ac.signal;
      try {
        const r = await UFETCH(url, opts);
        clearTimeout(t);
        const body = await r.text();
        Network._req.push([method, url, r.status]);
        return { status: r.status, headers: Object.fromEntries(r.headers), body };
      } catch (e) {
        clearTimeout(t);
        Network._req.push([method, url, 'ERR']);
        throw e;
      }
    },
    get(url, headers, extra) { return this.sendRequest('GET', url, headers, undefined, extra); },
    post(url, headers, data, extra) { return this.sendRequest('POST', url, headers, data, extra); },
    put(url, headers, data, extra) { return this.sendRequest('PUT', url, headers, data, extra); },
    delete(url, headers, extra) { return this.sendRequest('DELETE', url, headers, undefined, extra); },
    async fetchBytes(method, url, headers, data) {
      const h = Object.assign({ 'User-Agent': UA }, headers || {});
      // 必须用 undici 的 fetch: Node 全局 fetch 忽略 dispatcher 参数, 境外站会直连失败
      const r = await UFETCH(url, { method, headers: h, body: data ? Buffer.from(data) : undefined, dispatcher: PROXY_DISPATCHER });
      const ab = await r.arrayBuffer();
      return { status: r.status, headers: {}, body: new Uint8Array(ab).buffer };
    },
    getCookies: () => [], setCookies: () => true,
    deleteCookies: () => true,
    request: null,
    image: { get: async (u, h) => { const r = await UFETCH(u, { headers: Object.assign({'User-Agent':UA}, h||{}), dispatcher: PROXY_DISPATCHER }); return r.ok; } },
    downloadFile: () => {},
  };

  const Convert = {
    encodeUtf8: (s) => ab(Buffer.from(s, 'utf8')),
    decodeUtf8: (b) => Buffer.from(new Uint8Array(b)).toString('utf8'),
    encodeBase64: (b) => ab(Buffer.from(new Uint8Array(b))).toString('base64'),
    decodeBase64: (s) => ab(Buffer.from(s, 'base64')),
    md5: (b) => ab(require('crypto').createHash('md5').update(Buffer.from(new Uint8Array(b))).digest()),
    sha1: (b) => ab(require('crypto').createHash('sha1').update(Buffer.from(new Uint8Array(b))).digest()),
    sha256: (b) => ab(require('crypto').createHash('sha256').update(Buffer.from(new Uint8Array(b))).digest()),
    hexEncode: (b) => Buffer.from(b).toString('hex'),
    decodeGbk: (b) => Buffer.from(b).toString('latin1'),
    encodeGbk: (s) => Buffer.from(s, 'utf8').buffer,
    _hmac: (key, value, hash) => {
      const c = require('crypto');
      const algo = hash === 'sha1' ? 'sha1' : hash === 'sha256' ? 'sha256' : hash === 'sha512' ? 'sha512' : 'md5';
      return c.createHmac(algo, Buffer.from(new Uint8Array(key))).update(Buffer.from(new Uint8Array(value))).digest();
    },
    hmac: function(key, value, hash) { return ab(this._hmac(key, value, hash)); },
    hmacString: function(key, value, hash) { return this._hmac(key, value, hash).toString('hex'); },
    decryptAesEcb: (v, k) => {
      const c = require('crypto');
      const kb = Buffer.from(new Uint8Array(k));
      const bits = kb.length === 16 ? 128 : kb.length === 24 ? 192 : 256;
      const d = c.createDecipheriv('aes-' + bits + '-ecb', kb, null);
      d.setAutoPadding(false);
      return ab(Buffer.concat([d.update(Buffer.from(new Uint8Array(v))), d.final()]));
    },
    encryptAesEcb: (v, k) => {
      const c = require('crypto');
      const kb = Buffer.from(new Uint8Array(k));
      const bits = kb.length === 16 ? 128 : kb.length === 24 ? 192 : 256;
      const e = c.createCipheriv('aes-' + bits + '-ecb', kb, null);
      return ab(Buffer.concat([e.update(Buffer.from(new Uint8Array(v))), e.final()]));
    },
  };

  const dataStore = {};
  class ComicSource {
    constructor() { ComicSource._inst = this; }
    // 真机: source.data['settings'][k] ?? settings定义[k].default
    loadSetting(k) {
      if (k in settings) return settings[k];
      const def = this.settings && this.settings[k];
      if (typeof def === 'string' || typeof def === 'number' || typeof def === 'boolean') return def;
      // 源 init 时可能把 settings[k] 直接覆盖为裸值(如 copy_manga refreshAppApi 改 base_url)
      if (def && def.default !== undefined) return def.default;
      return null;
    }
    loadData(k) { return dataStore[k]; }
    saveData(k, v) { dataStore[k] = v; }
    deleteData(k) { delete dataStore[k]; }
    get data() { return { settings, data: dataStore }; }
    get isLogged() { return false; }
    translate(k) { return k; }
    onClose() {}
  }
  ComicSource.sources = {};

  function Comic(args) { Object.assign(this, args); }
  function ComicDetails(args) { Object.assign(this, args); }
  function Cookie(args) { Object.assign(this, args); }
  function Comment(args) { Object.assign(this, args); }
  function Image() {}
  function UI() { return { showError: () => {}, showLoading: () => {}, hideLoading: () => {}, showConfirm: async () => false, showInput: async () => '', toast: () => {} }; }

  const localStorage = (() => {
    const m = {};
    return { getItem: (k) => m[k] ?? null, setItem: (k, v) => m[k] = String(v), removeItem: (k) => delete m[k] };
  })();

  const APP = { version: '1.6.4', isMobile: false, platform: 'linux', locale: 'zh-CN' };
  const channel = () => ({ send: () => {}, listen: () => {}, close: () => {} });
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randomDouble = (min, max) => Math.random() * (max - min) + min;
  const createUuid = () => require('crypto').randomUUID();
  const log = (lvl, title, content) => {};

  const sandbox = {
    console, Network, Convert, ComicSource, Comic, ComicDetails, Cookie, Comment, Image,
    UI: UI(), APP, localStorage, channel, randomInt, randomDouble, createUuid, log,
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: UFETCH, Headers, Request, Response, TextEncoder, TextDecoder, FormData, URL, URLSearchParams,
    Uint8Array, ArrayBuffer, Blob, btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    crypto: require('crypto').webcrypto,
    document: { querySelector: () => null },
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.global = sandbox;
  sandbox.ComicSource = ComicSource;

  // HTMLParser: venera 真实是 new HtmlDocument(html)
  class HtmlDocument {
    constructor(html) { this._d = makeDocFromHtml(html); }
    querySelector(q) { const r = this._d.querySelector(q); return r; }
    querySelectorAll(q) { return this._d.querySelectorAll(q); }
    getElementById(id) { return this._d.querySelector('#' + id); }
    dispose() {}
  }
  sandbox.HtmlDocument = HtmlDocument;
  const vm = require('vm');
  vm.createContext(sandbox);

  const code = src + '\n;globalThis.__INST = new ' + className + '(); globalThis.__INST.init && globalThis.__INST.init();';
  vm.runInContext(code, sandbox, { timeout: 15000 });
  const inst = sandbox.__INST;
  if (!inst) throw '实例化失败';
  const results = { name: inst.name || '?', key: inst.key || '?', checks: [], reqs: Network._req };

  // 真机语义(search_page.dart:312 useDefaultOptions): options = optionList 每项的
  // defaultValue(= default 字段或第一个 value)。旧沙箱传 [] 导致源把 undefined 拼进 URL
  // (manga_dex 400 / ccc 500 假红)。
  function defaultSearchOptions() {
    const ol = inst.search && inst.search.optionList;
    if (!Array.isArray(ol) || !ol.length) return [];
    return ol.map((o) => {
      if (typeof o.default === 'string' && o.default) return o.default;
      const first = Array.isArray(o.options) && o.options[0];
      if (typeof first === 'string' && first.includes('-')) return first.split('-')[0];
      if (first && typeof first === 'object' && first.value !== undefined) return String(first.value);
      return first != null ? String(first) : '';
    });
  }
  const searchOpts = defaultSearchOptions();

  // 跑 search
  if (inst.search && typeof inst.search.load === 'function') {
    try {
      const r = await inst.search.load(keyword, searchOpts, 1);
      const comics = r.comics || r;
      results.search = { ok: true, n: comics.length, first: comics[0] && (comics[0].title || '').slice(0, 30) };
    } catch (e) {
      results.search = { ok: false, err: (e.message || String(e)).slice(0, 160), stack: (e.stack||'').split('\n').slice(0,6).join(' | ').slice(0,400) };
    }
  } else {
    results.search = { ok: false, err: 'no search.load' };
  }

  // 跑 explore[0]
  if (Array.isArray(inst.explore) && inst.explore.length) {
    try {
      const e0 = inst.explore[0];
      let r;
      if (e0.load) r = await e0.load(e0.type === 'multiPageComicList' ? 1 : undefined);
      if (r && r.comics) results.explore = { ok: true, n: r.comics.length };
      else if (Array.isArray(r)) results.explore = { ok: true, n: r.length };
      else if (r && typeof r === 'object') { const ks = Object.keys(r); results.explore = { ok: true, n: (r[ks[0]]||[]).length, note: 'multipart' }; }
      else results.explore = { ok: false, err: 'empty' };
    } catch (e) {
      results.explore = { ok: false, err: (e.message || String(e)).slice(0, 160) };
    }
  }

  // 若有搜索首条，试 loadInfo（只针对搜索成功且能拿 id 的）
  if (results.search.ok && results.search.n > 0) {
    try {
      const r = await inst.search.load(keyword, searchOpts, 1);
      const c = (r.comics || r)[0];
      const info = await inst.comic.loadInfo(c.id);
      let ch = info.chapters || {};
      const toPlain = (x) => {
        if (x && typeof x.forEach === 'function' && typeof x.set === 'function' && typeof x.size === 'number') { const m = {}; x.forEach((vv, kk) => { m[kk] = vv; }); return m; }
        return x;
      };
      ch = toPlain(ch);
      if (ch.toMap) ch = ch.toMap();
      // 分组章节: {组名: {章id: 章名}} → 拍平（真机 ComicChapters.ids 只取内层键, 模拟之）
      const flat = {};
      for (const k2 of Object.keys(ch)) {
        const v2 = toPlain(ch[k2]);
        if (v2 && typeof v2 === 'object' && !Array.isArray(v2) && Object.keys(v2).length > 0 && typeof Object.values(v2)[0] === 'string') {
          for (const k3 of Object.keys(v2)) flat[k3] = String(v2[k3]);
        } else flat[k2] = typeof v2 === 'string' ? v2 : JSON.stringify(v2);
      }
      ch = flat;
      const nCh = Object.keys(ch).length;
      results.comic = { ok: true, title: (info.title||'').slice(0,20), chapters: nCh, cover: !!info.cover };
      if (nCh > 0) {
        const k = Object.keys(ch)[0];
        try {
          const ep = await inst.comic.loadEp(c.id, k);
          results.page = { ok: true, n: (ep.images || []).length, first: (ep.images||[])[0] };
        } catch (e) { results.page = { ok: false, err: (e.message||String(e)).slice(0,120) }; }
      } else {
        // 单章本: chapters 为空, epId 传 null/comicId 走 loadEp
        try {
          const ep = await inst.comic.loadEp(c.id, null);
          results.page = { ok: true, n: (ep.images || []).length, first: (ep.images||[])[0] };
        } catch (e) { results.page = { ok: false, err: 'singleCh: ' + (e.message||String(e)).slice(0,100) }; }
      }
    } catch (e) {
      results.comic = { ok: false, err: (e.message || String(e)).slice(0, 160) };
    }
  }
  console.log(JSON.stringify(results));
  globalThis.__DONE = true;
}
main().catch(e => { console.log(JSON.stringify({ fatal: (e.message || String(e)).slice(0, 250) })); process.exit(0); });
process.on('uncaughtException', e => { console.log(JSON.stringify({ fatal: 'uncaught: ' + (e.message || String(e)).slice(0, 220) })); process.exit(0); });
process.on('unhandledRejection', e => {
  // 有些源 init() 里发起未 await 的探测请求(fire-and-forget), reject 属正常噪音。
  // 若主流程尚未完成, 不抢跑退出; 主流程已完成则忽略。
  if (!globalThis.__DONE) {
    let c = e && e.cause, chain = [];
    while (c) { chain.push((c.code || '') + ' ' + (c.message || '')); c = c.cause; }
    console.error('[bg-rejection]', chain.slice(0, 2).join('; ') || (e && e.message));
    return;
  }
  process.exit(0);
});
