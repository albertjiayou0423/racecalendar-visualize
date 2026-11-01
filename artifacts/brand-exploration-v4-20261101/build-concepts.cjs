const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../immersion-video-20261016-1530/node_modules/playwright');
const out = __dirname;

const concepts = {
  '01-lap-orbit': {
    title: 'LAP ORBIT',
    desc: '一圈未闭合的赛道与红色分段标记。',
    draw: (ink, red) => `<path d="M126 39C114 28 99 22 82 22 47 22 22 50 22 86c0 34 24 62 57 66 22 3 42-5 56-21" fill="none" stroke="${ink}" stroke-width="11" stroke-linecap="round"/><path d="M77 86h37M77 86v35" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M121 45h50l-17 22h-50z" fill="${red}"/><circle cx="128" cy="131" r="5" fill="${red}"/>`,
  },
  '02-split-grid': {
    title: 'SPLIT GRID',
    desc: '赛历时间格与正在逼近的红色焦点。',
    draw: (ink, red) => `<path d="M29 36h117M29 73h82M29 110h117M29 147h72" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M49 28v126M91 28v78M133 28v126" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round" opacity=".42"/><path d="M110 65h60l-18 25h-60z" fill="${red}"/><circle cx="91" cy="110" r="8" fill="${red}"/>`,
  },
  '03-apex-signal': {
    title: 'APEX SIGNAL',
    desc: '赛道弯心、计时脉冲与出发信号的抽象组合。',
    draw: (ink, red) => `<path d="M27 141h43c26 0 37-9 43-29l13-45c4-14 14-22 30-22" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 117h38c13 0 19-5 23-17l12-42c7-25 25-39 52-39" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round" opacity=".42"/><path d="M110 51h62l-18 25h-62z" fill="${red}"/><path d="M36 91h33" fill="none" stroke="${red}" stroke-width="7" stroke-linecap="round"/>`,
  },
};

function mark(id, ink, red) {
  const c = concepts[id];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180" role="img" aria-labelledby="title desc"><title id="title">${c.title}</title><desc id="desc">${c.desc}</desc>${c.draw(ink, red)}</svg>`;
}
function logo(id, ink, muted, red) {
  const c = concepts[id];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="180" viewBox="0 0 680 180" role="img" aria-labelledby="title desc"><title id="title">赛道时刻</title><desc id="desc">${c.desc}</desc><g>${c.draw(ink, red)}</g><text x="218" y="99" fill="${ink}" font-family="Microsoft YaHei UI,Microsoft YaHei,Noto Sans SC,sans-serif" font-size="52" font-weight="700" letter-spacing="1">赛道时刻</text><path d="M220 119h44" stroke="${red}" stroke-width="3"/><text x="220" y="149" fill="${muted}" font-family="Bahnschrift,Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="4">RACE CALENDAR</text></svg>`;
}

for (const id of Object.keys(concepts)) {
  fs.writeFileSync(path.join(out, `${id}-dark.svg`), logo(id, '#F4F4F2', '#96999E', '#EF3340'));
  fs.writeFileSync(path.join(out, `${id}-light.svg`), logo(id, '#17191D', '#747980', '#D92F3B'));
  fs.writeFileSync(path.join(out, `${id}-mark.svg`), mark(id, '#17191D', '#D92F3B'));
}

const names = Object.keys(concepts);
const rows = names.map((id, i) => `<section class="card ${i % 2 ? 'light' : 'dark'}"><div class="meta"><span>0${i + 1}</span><b>${concepts[id].title}</b><p>${concepts[id].desc}</p></div>${logo(id, i % 2 ? '#17191D' : '#F4F4F2', i % 2 ? '#747980' : '#96999E', i % 2 ? '#D92F3B' : '#EF3340')}</section>`).join('');
const html = `<!doctype html><html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:1120px;height:1040px;background:#e9ebed;font-family:'Microsoft YaHei UI','Microsoft YaHei',sans-serif}body{padding:32px;display:grid;gap:18px;grid-template-rows:repeat(3,1fr)}.card{display:flex;align-items:center;gap:28px;padding:25px 32px;border-radius:18px}.dark{background:#090a0c}.light{background:#fff}.meta{width:210px;flex:none}.meta span{font:700 11px Bahnschrift,Arial,sans-serif;letter-spacing:3px;color:#ed3944}.meta b{display:block;color:inherit;font:700 16px Bahnschrift,Arial,sans-serif;letter-spacing:1.5px;margin-top:10px}.meta p{color:#95999f;font-size:12px;line-height:1.7;margin-top:8px}.light .meta b{color:#222}.dark .meta b{color:#f4f4f2}svg{width:680px;height:180px}</style><body>${rows}</body></html>`;
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1120,height:1040},deviceScaleFactor:1});await page.setContent(html,{waitUntil:'load'});await page.screenshot({path:path.join(out,'logo-concepts-review.png')});await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
