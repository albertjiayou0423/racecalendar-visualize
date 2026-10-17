import Link from "next/link"
import Image from "next/image"
import signature from "../assets/signature.svg"
import { releaseNotes } from "../release-notes"
import { SimplePageHeader, SimpleSection } from "./data-ui"
import { SimpleFooter } from "./footer"

export function SimpleAboutView() {
  return <main><SimplePageHeader title="关于 · 更新日志" subtitle="赛道时刻 / 简洁版" /><SimpleSection title={releaseNotes[0].version}><p className="s-prose">F1、WRC、Formula E 的赛程、赛果与积分。以北京时间为主，同时保留赛事当地时间。新版以独立组件重新整理界面，数据与旧版保持一致。</p><div className="s-inline"><Link href="/new/developer" className="s-link">关于开发者</Link><Link href="/new/playground" className="s-link">组件预览</Link></div></SimpleSection><SimpleSection title="时间与数据"><p className="s-prose">来源与缓存状态可在赛历上方展开查看。估计及客户端待核验的场次不显示精确倒计时；官方时间可能调整。计时与提醒是观赛辅助，不代表现场发车信号。离线时使用当前浏览器上次成功的赛历。</p></SimpleSection><SimpleSection title="更新日志">{releaseNotes.map((release, index) => <details className="s-release" key={release.version} open={index === 0}><summary><strong>{release.version}</strong><span>{release.date}</span>{index === 0 && <small>最新</small>}</summary><ul>{release.items.map((item, index) => <li key={index}><span>{{ feat: "新增", fix: "修复", perf: "性能", ui: "界面", refactor: "整理" }[item.type]}</span>{item.text}</li>)}</ul></details>)}</SimpleSection><SimpleFooter /></main>
}
export function SimpleDeveloperView() {
  return <main><SimplePageHeader title="开发者" subtitle="About the developer" /><section className="s-developer"><div className="s-developer-profile"><Image src="/brand-logo.svg" alt="Huo_sai 标志" width={56} height={56} /><div><h2>Huo_sai</h2><p>赛道时刻的开发者</p></div></div><div className="s-signature"><Image src={signature} alt="Huo_sai 新签名" width={299} height={107} unoptimized priority /></div><p className="s-prose">把比赛的时间整理好，让每一次期待都有着落。</p><div className="s-inline"><a href="https://github.com/albertjiayou0423" className="s-button" target="_blank" rel="noopener noreferrer">GitHub</a><a href="https://www.patreon.com/cw/huo_sai" className="s-button" target="_blank" rel="noopener noreferrer">支持开发</a></div></section><SimpleSection title="这个项目"><p className="s-prose">赛道时刻面向赛车爱好者，覆盖 F1、WRC 和 Formula E。提供赛程、双时区时间、转播提示、积分榜与赛果，以及可导出的日历壁纸。</p><p className="s-prose">新版使用与旧版相同的数据接口和持久化机制，页面与组件独立保存在 /new 下。你可以随时回到旧版。</p></SimpleSection><SimpleSection title="参与完善"><p className="s-prose">遇到时间错误、界面问题，或有想加入的小功能，都可以通过下方反馈按钮告诉我。</p></SimpleSection><SimpleFooter /></main>
}
