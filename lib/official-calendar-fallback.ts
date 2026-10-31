import { zonedWallTimeToUtc } from "./tz"
import type { RaceEvent, Series } from "./types"

type EventSeed = Pick<RaceEvent, "round" | "name" | "circuit" | "locality" | "country" | "countryCode" | "tz" | "url"> & {
  date: [number, number, number]
  series: Series
  circuitType?: RaceEvent["circuitType"]
  region?: RaceEvent["region"]
}

// Official 2027 calendars have dates but not complete session schedules yet.
// The local-time marker is intentionally tentative and must never be treated as a start time.
const F1: EventSeed[] = [
  [1,"巴林大奖赛","巴林国际赛道","萨基尔","巴林","BH","Asia/Bahrain",[3,14]],
  [2,"沙特阿拉伯大奖赛","吉达滨海赛道","吉达","沙特阿拉伯","SA","Asia/Riyadh",[3,21]],
  [3,"澳大利亚大奖赛","阿尔伯特公园赛道","墨尔本","澳大利亚","AU","Australia/Melbourne",[4,4]],
  [4,"日本大奖赛","铃鹿赛道","铃鹿","日本","JP","Asia/Tokyo",[4,11]],
  [5,"中国大奖赛","上海国际赛车场","上海","中国","CN","Asia/Shanghai",[4,18]],
  [6,"迈阿密大奖赛","迈阿密国际自驾赛道","迈阿密","美国","US","America/New_York",[5,2]],
  [7,"加拿大大奖赛","吉尔·维伦纽夫赛道","蒙特利尔","加拿大","CA","America/Toronto",[5,23]],
  [8,"摩纳哥大奖赛","摩纳哥赛道","蒙特卡洛","摩纳哥","MC","Europe/Monaco",[6,6]],
  [9,"葡萄牙大奖赛","阿尔加维国际赛道","波尔蒂芒","葡萄牙","PT","Europe/Lisbon",[6,20]],
  [10,"英国大奖赛","银石赛道","银石","英国","GB","Europe/London",[7,4]],
  [11,"奥地利大奖赛","红牛环","施皮尔贝格","奥地利","AT","Europe/Vienna",[7,11]],
  [12,"比利时大奖赛","斯帕-弗朗科尔尚赛道","斯塔沃洛","比利时","BE","Europe/Brussels",[7,25]],
  [13,"匈牙利大奖赛","匈牙利赛道","莫焦罗德","匈牙利","HU","Europe/Budapest",[8,1]],
  [14,"意大利大奖赛","蒙扎国家赛车场","蒙扎","意大利","IT","Europe/Rome",[9,5]],
  [15,"西班牙大奖赛","马德里Madring赛道","马德里","西班牙","ES","Europe/Madrid",[9,12]],
  [16,"阿塞拜疆大奖赛","巴库城市赛道","巴库","阿塞拜疆","AZ","Asia/Baku",[9,26]],
  [17,"土耳其大奖赛","伊斯坦布尔公园赛道","伊斯坦布尔","土耳其","TR","Europe/Istanbul",[10,3]],
  [18,"新加坡大奖赛","滨海湾街道赛道","新加坡","新加坡","SG","Asia/Singapore",[10,10]],
  [19,"美国大奖赛","美洲赛道","奥斯汀","美国","US","America/Chicago",[10,24]],
  [20,"墨西哥城大奖赛","罗德里格斯兄弟赛道","墨西哥城","墨西哥","MX","America/Mexico_City",[10,31]],
  [21,"圣保罗大奖赛","英特拉格斯赛道","圣保罗","巴西","BR","America/Sao_Paulo",[11,7]],
  [22,"拉斯维加斯大奖赛","拉斯维加斯街道赛道","拉斯维加斯","美国","US","America/Los_Angeles",[11,20]],
  [23,"卡塔尔大奖赛","卢赛尔国际赛道","卢赛尔","卡塔尔","QA","Asia/Qatar",[12,5]],
  [24,"阿布扎比大奖赛","亚斯码头赛道","阿布扎比","阿联酋","AE","Asia/Dubai",[12,12]],
].map(([round,name,circuit,locality,country,countryCode,tz,date]) => ({
  series: "F1", round: Number(round), name: String(name), circuit: String(circuit), locality: String(locality), country: String(country), countryCode: String(countryCode), tz: String(tz), date: [2027, Number((date as number[])[0]), Number((date as number[])[1])], circuitType: "permanent", url: "https://www.formula1.com/en/racing/2027",
}))

const WRC: EventSeed[] = [
  [1,"蒙特卡洛拉力赛","加普 / 摩纳哥","法国 / 摩纳哥","MC","Europe/Monaco",[1,21],[1,24]],
  [2,"瑞典拉力赛","于默奥","瑞典","SE","Europe/Stockholm",[2,18],[2,21]],
  [3,"肯尼亚狩猎拉力赛","纳库鲁","肯尼亚","KE","Africa/Nairobi",[3,18],[3,21]],
  [4,"克罗地亚拉力赛","克罗地亚","克罗地亚","HR","Europe/Zagreb",[4,8],[4,11]],
  [5,"加那利群岛拉力赛","大加那利岛","西班牙","ES","Atlantic/Canary",[5,6],[5,9]],
  [6,"日本拉力赛","丰田市","日本","JP","Asia/Tokyo",[6,3],[6,6]],
  [7,"希腊卫城拉力赛","卢特拉基","希腊","GR","Europe/Athens",[6,24],[6,27]],
  [8,"爱沙尼亚拉力赛","塔尔图","爱沙尼亚","EE","Europe/Tallinn",[7,22],[7,25]],
  [9,"芬兰拉力赛","于韦斯屈莱","芬兰","FI","Europe/Helsinki",[7,29],[8,1]],
  [10,"美国拉力赛","田纳西州","美国","US","America/Chicago",[8,26],[8,29]],
  [11,"苏格兰拉力赛","苏格兰","英国","GB","Europe/London",[9,30],[10,3]],
  [12,"巴拉圭拉力赛","恩卡纳西翁","巴拉圭","PY","America/Asuncion",[10,21],[10,24]],
  [13,"智利比奥比奥拉力赛","康塞普西翁","智利","CL","America/Santiago",[11,4],[11,7]],
  [14,"沙特阿拉伯拉力赛","吉达","沙特阿拉伯","SA","Asia/Riyadh",[11,25],[11,28]],
].map(([round,name,locality,country,countryCode,tz,start,finish]) => ({
  series: "WRC", round: Number(round), name: String(name), circuit: `${String(locality)} · 拉力赛总部`, locality: String(locality), country: String(country), countryCode: String(countryCode), tz: String(tz), date: [2027, Number((start as number[])[0]), Number((start as number[])[1])], circuitType: "rally", url: "https://www.wrc.com/en/calendar",
}))

const FE: EventSeed[] = [
  [3,"墨西哥城 E-Prix","墨西哥城","墨西哥","MX","America/Mexico_City",[1,16]],
  [4,"奥斯汀 E-Prix","奥斯汀","美国","US","America/Chicago",[2,6]],
  [5,"迈阿密 E-Prix","迈阿密","美国","US","America/New_York",[2,20]],
  [6,"圣保罗 E-Prix","圣保罗","巴西","BR","America/Sao_Paulo",[3,13]],
  [7,"三亚 E-Prix","三亚","中国","CN","Asia/Shanghai",[4,17]],
  [8,"摩纳哥 E-Prix","摩纳哥","摩纳哥","MC","Europe/Monaco",[5,1]],
  [9,"摩纳哥 E-Prix","摩纳哥","摩纳哥","MC","Europe/Monaco",[5,2]],
  [10,"柏林 E-Prix","柏林","德国","DE","Europe/Berlin",[5,8]],
  [11,"柏林 E-Prix","柏林","德国","DE","Europe/Berlin",[5,9]],
  [12,"伦敦 E-Prix","伦敦","英国","GB","Europe/London",[5,29]],
  [13,"伦敦 E-Prix","伦敦","英国","GB","Europe/London",[5,30]],
  [14,"赞德沃特 E-Prix","赞德沃特","荷兰","NL","Europe/Amsterdam",[6,18]],
  [15,"赞德沃特 E-Prix","赞德沃特","荷兰","NL","Europe/Amsterdam",[6,19]],
  [16,"马德里 E-Prix","马德里","西班牙","ES","Europe/Madrid",[6,26]],
  [17,"马德里 E-Prix","马德里","西班牙","ES","Europe/Madrid",[6,27]],
  [18,"上海 E-Prix","上海","中国","CN","Asia/Shanghai",[7,10]],
  [19,"上海 E-Prix","上海","中国","CN","Asia/Shanghai",[7,11]],
  [20,"东京 E-Prix","东京","日本","JP","Asia/Tokyo",[7,24]],
  [21,"东京 E-Prix","东京","日本","JP","Asia/Tokyo",[7,25]],
].map(([round,name,locality,country,countryCode,tz,date]) => ({
  series: "FE", round: Number(round), name: String(name), circuit: `${String(locality)} 街道赛道`, locality: String(locality), country: String(country), countryCode: String(countryCode), tz: String(tz), date: [2027, Number((date as number[])[0]), Number((date as number[])[1])], circuitType: "street", url: "https://www.fiaformulae.com/en/calendar",
}))

const SEEDS = [...F1, ...WRC, ...FE]

function toEvent(seed: EventSeed): RaceEvent {
  const [year, month, day] = seed.date
  const utc = zonedWallTimeToUtc(year, month, day, 23, 59, seed.tz).toISOString()
  return {
    id: `${seed.series.toLowerCase()}-2027-${seed.round}`,
    series: seed.series,
    round: seed.round,
    name: seed.name,
    circuit: seed.circuit,
    locality: seed.locality,
    country: seed.country,
    countryCode: seed.countryCode,
    tz: seed.tz,
    sessions: [{ name: seed.series === "WRC" ? "赛事首日（当地日期）" : seed.series === "FE" ? "正赛日期" : "正赛日期", utc, isMain: true, tentative: true }],
    tentative: false,
    circuitType: seed.circuitType,
    region: seed.region,
    url: seed.url,
    ...(seed.series === "F1" ? { broadcaster: { name: "五星体育", note: "转播时间待节目单确认" } } : {}),
  }
}

function seasonYear(event: RaceEvent): number | null {
  const match = event.id.match(/(?:^|-)20(\d{2})(?:-|$)/)
  if (match) return Number(`20${match[1]}`)
  const timestamp = event.sessions.map(session => Date.parse(session.utc)).find(Number.isFinite)
  return timestamp === undefined ? null : new Date(timestamp).getUTCFullYear()
}

export function addOfficialCalendarFallbacks(events: RaceEvent[], year = 2027): { events: RaceEvent[]; added: Record<Series, number> } {
  const existing = new Set(events.filter(event => seasonYear(event) === year).map(event => `${event.series}:${event.round}`))
  const added: Record<Series, number> = { F1: 0, WRC: 0, FE: 0 }
  const fallbacks = SEEDS.filter(seed => seed.date[0] === year && !existing.has(`${seed.series}:${seed.round}`)).map(seed => {
    added[seed.series]++
    return toEvent(seed)
  })
  return { events: [...events, ...fallbacks], added }
}
