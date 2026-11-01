const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../immersion-video-20261016-1530/node_modules/playwright');

const out = __dirname;
const ease = t => 10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5;

// A quarter-turn whose heading eases in and out with zero curvature and
// curvature-rate at both ends. Dense sampling keeps the G3-like profile smooth
// at both small icon sizes and large print sizes.
function corner(x, y, heading, turn, reach, steps = 180) {
  const n = steps * 8;
  let px = 0, py = 0;
  const pts = [[x, y]];
  for (let i = 1; i <= n; i++) {
    const t = (i - 0.5) / n;
    const a = heading + turn * ease(t);
    px += Math.cos(a) / n;
    py += Math.sin(a) / n;
    if (i % 8 === 0 || i === n) pts.push([x + px, y + py]);
  }
  const scale = reach / Math.max(Math.abs(px), Math.abs(py));
  return pts.map(([a, b]) => [x + (a - x) * scale, y + (b - y) * scale]);
}

function makeTrackPath() {
  const points = [[118, 25], [59, 25]];
  const append = (x, y, heading, turn) => {
    const curve = corner(x, y, heading, turn, 16.5);
    points.push(...curve.slice(1));
    const last = curve[curve.length - 1];
    return last;
  };
  let p = append(59, 25, Math.PI, -Math.PI / 2); // top into left side
  points.push([p[0], 124]);
  p = append(p[0], 124, Math.PI / 2, -Math.PI / 2); // left into bottom
  points.push([127, p[1]]);
  p = append(127, p[1], 0, -Math.PI / 2); // bottom into right side
  points.push([p[0], 96]);
  return points.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(' L ');
}

const track = `M ${makeTrackPath()}`;
const symbol = (ink, red) => `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180" role="img" aria-labelledby="title desc">
  <title id="title">赛道时刻标志</title>
  <desc id="desc">以渐进曲率过渡形成的开放赛道环线，结合计时刻度与红色扫线。</desc>
  <path d="${track}" fill="none" stroke="${ink}" stroke-width="8.5" stroke-linecap="butt" stroke-linejoin="round"/>
  <path d="M51 82H119M85 82V127" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="butt" stroke-linejoin="round"/>
  <path d="M123 53H169L151 76H105Z" fill="${red}"/>
  <path d="M132 58H157" fill="none" stroke="#FFFFFF" stroke-opacity=".32" stroke-width="1.6"/>
</svg>`;

const markDark = symbol('#17191D', '#D92F3B');
const markLight = symbol('#F4F4F2', '#EF3340');
const markMono = symbol('#17191D', '#17191D');
const logo = (ink, muted, red) => `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="180" viewBox="0 0 760 180" role="img" aria-labelledby="title desc">
  <title id="title">赛道时刻</title>
  <desc id="desc">赛事日历品牌标志：开放赛道、计时符号和归零扫线。</desc>
  <g transform="translate(0 0)">
    <path d="${track}" fill="none" stroke="${ink}" stroke-width="8.5" stroke-linecap="butt" stroke-linejoin="round"/>
    <path d="M51 82H119M85 82V127" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="butt" stroke-linejoin="round"/>
    <path d="M123 53H169L151 76H105Z" fill="${red}"/>
    <path d="M132 58H157" fill="none" stroke="#FFFFFF" stroke-opacity=".32" stroke-width="1.6"/>
  </g>
  <text x="218" y="101" fill="${ink}" font-family="Microsoft YaHei UI, Microsoft YaHei, Noto Sans SC, sans-serif" font-size="53" font-weight="700" letter-spacing="1.1">赛道时刻</text>
  <path d="M220 120H266" fill="none" stroke="${red}" stroke-width="3"/>
  <text x="220" y="150" fill="${muted}" font-family="Bahnschrift, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="4.1">RACE CALENDAR</text>
</svg>`;

const files = {
  'saidao-mark.svg': markDark,
  'saidao-mark-light.svg': markLight,
  'saidao-mark-mono.svg': markMono,
  'saidao-logo-dark.svg': logo('#F4F4F2', '#96999E', '#EF3340'),
  'saidao-logo-light.svg': logo('#17191D', '#747980', '#D92F3B'),
  'saidao-logo-mono.svg': logo('#17191D', '#17191D', '#17191D'),
};
for (const [name, contents] of Object.entries(files)) fs.writeFileSync(path.join(out, name), contents, 'utf8');

const read = name => fs.readFileSync(path.join(out, name), 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:1280px;height:820px;background:#e9ebed;font-family:'Microsoft YaHei UI','Microsoft YaHei',sans-serif}
body{padding:42px;display:grid;grid-template-rows:1fr 1fr;gap:22px}.panel{border-radius:18px;padding:28px 36px;display:flex;flex-direction:column;justify-content:center;gap:20px}
.dark{background:#090a0c}.light{background:#fff}.label{font:700 10px Bahnschrift,Arial,sans-serif;letter-spacing:3px;color:#777e87}.line{display:flex;align-items:center;justify-content:space-between;gap:20px}.lock{width:760px;height:180px}.marks{display:flex;align-items:center;gap:18px}.chip{display:grid;place-items:center;background:#f0f1f3;border-radius:12px;width:64px;height:64px}.chip svg{width:48px;height:48px}.small{width:32px;height:32px}.small svg{width:32px;height:32px}
</style></head><body>
<section class="panel dark"><div class="label">SAIDAO / PRIMARY DARK</div><div class="line"><div class="lock">${read('saidao-logo-dark.svg')}</div><div class="marks"><div class="chip">${read('saidao-mark.svg')}</div><div class="small">${read('saidao-mark.svg')}</div></div></div></section>
<section class="panel light"><div class="label">SAIDAO / PRIMARY LIGHT + MONOCHROME</div><div class="line"><div class="lock">${read('saidao-logo-light.svg')}</div><div class="marks"><div class="chip">${read('saidao-mark-mono.svg')}</div><div class="small">${read('saidao-mark-mono.svg')}</div></div></div></section>
</body></html>`;

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(out, 'logo-review-g3.png') });
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
