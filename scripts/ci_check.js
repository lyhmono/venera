// CI 环境的源健康检查：只测搜索链路（站死没死），不测图片（外网图床 CI 里慢且抖）
// 用法: npm i cheerio undici && node scripts/ci_check.js   （仓库根目录）
// 输出: 每源一行 PASS/FAIL + 汇总；任何自研源搜索失败 → exit 1
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SELF_MADE = {
  // file: [class, keyword, needsProxy(跳过)]
  'gmh.js': ['Gmh', '日常', false],
  'guazi.js': ['Guazi', '日常', false],
  'wmanhua.js': ['Wmanhua', '日常', false],
  'miaoqu.js': ['Miaoqu', '日常', false],
  'sqmh.js': ['Sqmh', '日常', false],
  'wuqian.js': ['Wuqian', '日常', false],
  'mh1234m.js': ['Mh1234', '日常', false],
  'mh250.js': ['Mh250', '日常', false],
  'mh92.js': ['Mh92', '日常', false],
  'mhua5.js': ['Mhua5', '日常', false],
  'dingmanhua.js': ['Dingmanhua', '日常', false],
  'mangaread.js': ['Mangaread', 'one piece', false],
  // 境外站：直连超时，需代理（CI 环境无法走 mihomo，跳过）
  'xmanhua.js': ['Xmanhua', '日常', true],
  // 以下站点对数据中心 IP 有风控，CI 环境必被拦，跳过（本地沙箱+mihomo 才测）
  'mhjia.js': ['Mhjia', '日常', true],
  'nnhanman.js': ['Nnhanman', '日常', true],
  'misskon.js': ['Misskon', '日常', true],
  'buondua.js': ['Buondua', '日常', true],
  'everia.js': ['Everia', 'korea', true],
};

const CHECKER = path.join(__dirname, 'check_one.js');

function check(file, cls, kw) {
  try {
    const out = execSync(
      `node "${CHECKER}" "${path.join('comic_sources', file)}" ${cls} "${kw}" 2>&1 | tail -1`,
      { timeout: 100000, encoding: 'utf8' }
    ).trim();
    const d = JSON.parse(out);
    const s = d.search || {};
    const ok = s.ok === true && (s.n ?? 0) > 0;
    return { ok, n: s.n ?? 0, err: s.err || '' };
  } catch (e) {
    const line = (e.stdout || e.stderr || '').toString().trim().split('\n').pop() || '';
    return { ok: false, n: 0, err: (line || e.message || String(e)).slice(0, 100) };
  }
}

(function main() {
  let fail = 0, pass = 0, skip = 0;
  for (const [file, [cls, kw, needsProxy]] of Object.entries(SELF_MADE)) {
    if (needsProxy) {
      skip++;
      console.log(`SKIP ${file} (datacenter-IP blocked, verified locally only)`);
      continue;
    }
    if (!fs.existsSync(path.join('comic_sources', file))) {
      console.log(`MISS ${file} — file missing from pool!`);
      fail++;
      continue;
    }
    const r = check(file, cls, kw);
    if (r.ok) { pass++; console.log(`PASS ${file} (${r.n} results)`); }
    else { fail++; console.log(`FAIL ${file} n=${r.n} err=${r.err}`); }
  }
  console.log(`\n== ${pass} pass / ${fail} fail / ${skip} skip ==`);
  process.exit(fail > 0 ? 1 : 0);
})();
