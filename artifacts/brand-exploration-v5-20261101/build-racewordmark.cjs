const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../immersion-video-20261016-1530/node_modules/playwright');
const out = __dirname;

function markShape(ink, red, muted = ink) {
  return `
    <path d="M18 142H57C77 142 88 134 96 114L121 53C128 35 139 27 157 27H184" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="butt" stroke-linejoin="bevel"/>
    <path d="M18 158H58C86 158 103 146 114 119L138 61C143 49 149 43 163 43H184" fill="none" stroke="${muted}" stroke-width="4" stroke-linecap="butt" stroke-linejoin="bevel" opacity=".52"/>
    <path d="M114 49H187L168 76H102Z" fill="${red}"/>
    <path d="M29 125H47" stroke="${red}" stroke-width="4"/>
    <path d="M154 56H176" stroke="#FFFFFF" stroke-width="1.5" stroke-opacity=".36"/>
  `;
}

function mark(ink, red, muted = ink) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="180" viewBox="0 0 200 180" role="img" aria-labelledby="title desc"><title id="title">赛道时刻竞速标志</title><desc id="desc">一条连续的高速弯心路线与红色计时分段切线。</desc><g transform="translate(-5 4)">${markShape(ink, red, muted)}</g></svg>`;
}

function logo(ink, muted, red) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="180" viewBox="0 0 880 180" role="img" aria-labelledby="title desc">
    <title id="title">赛道时刻</title><desc id="desc">赛车日历品牌字标，配以高速弯心路线与计时切线。</desc>
    <g transform="translate(-5 4)">${markShape(ink, red, muted)}</g>
    <g transform="translate(232 0) skewX(-8)">
      <text x="0" y="103" fill="${ink}" font-family="Bahnschrift SemiCondensed, Microsoft YaHei UI, Microsoft YaHei, sans-serif" font-size="57" font-weight="900" letter-spacing="2">赛道时刻</text>
      <path d="M4 122H115" stroke="${red}" stroke-width="5"/>
      <text x="4" y="151" fill="${muted}" font-family="Bahnschrift SemiCondensed, Bahnschrift, Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="4.2">RACE / CALENDAR</text>
    </g>
  </svg>`;
}

const outputs = {
  'racewordmark-dark.svg': logo('#F4F4F2', '#999DA3', '#EF3340'),
  'racewordmark-light.svg': logo('#151619', '#72767D', '#D92F3B'),
  'racewordmark-mono.svg': logo('#151619', '#151619', '#151619'),
  'race-mark.svg': mark('#151619', '#D92F3B', '#72767D'),
  'race-mark-light.svg': mark('#F4F4F2', '#EF3340', '#999DA3'),
  'race-mark-mono.svg': mark('#151619', '#151619', '#151619'),
};
for (const [name, svg] of Object.entries(outputs)) fs.writeFileSync(path.join(out, name), svg, 'utf8');

const html = `<!doctype html><html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:1200px;height:920px;background:#e8eaed;font-family:'Microsoft YaHei UI','Microsoft YaHei',sans-serif}body{padding:34px;display:grid;grid-template-rows:1fr 1fr auto;gap:18px}.panel{border-radius:18px;padding:28px 38px;display:flex;flex-direction:column;justify-content:center;gap:16px}.dark{background:#090a0c}.light{background:#fff}.label{font:700 10px Bahnschrift,Arial,sans-serif;letter-spacing:3px;color:#888d95}.logo{width:880px;height:180px}.lower{display:flex;align-items:center;gap:24px;padding:4px 8px}.chip{height:68px;width:68px;display:grid;place-items:center;background:#f7f7f8;border-radius:10px}.chip svg{width:58px;height:58px}.black svg{filter:none}.note{color:#6d737b;font:600 11px Bahnschrift,Arial,sans-serif;letter-spacing:1.6px}</style><body><section class="panel dark"><div class="label">SAIDAO / RACEWORDMARK / DARK</div><div class="logo">${outputs['racewordmark-dark.svg']}</div></section><section class="panel light"><div class="label">SAIDAO / RACEWORDMARK / LIGHT</div><div class="logo">${outputs['racewordmark-light.svg']}</div></section><div class="lower"><div class="chip">${outputs['race-mark.svg']}</div><div class="chip black">${outputs['race-mark-mono.svg']}</div><div class="note">CUSTOM RACING LINE / FOR SMALL-SIZE USE</div></div></body></html>`;
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1200,height:920},deviceScaleFactor:1});await page.setContent(html,{waitUntil:'load'});await page.screenshot({path:path.join(out,'racewordmark-review.png')});await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
