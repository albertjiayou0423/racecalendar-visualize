"use client"
import { useEffect, useRef, useState } from "react"
import { useSimpleSchedule, useSimpleClock, useSimpleFavorites } from "../data"
import { DEFAULT_FILTERS, filterEvents, dayEvents, dayKey, nextStart, type ViewMode, type StartSelection } from "../model"
import { countdownCandidate, countdownKey } from "@/lib/countdown-entry"
import { SimpleHeader } from "./header"
import { SimpleNextSession } from "./next-session"
import { SimpleSourceStatus } from "./source-status"
import { SimpleFilters } from "./filters"
import { SimpleCalendar } from "./calendar"
import { SimpleEventCard } from "./event-card"
import { SimpleFooter, SimpleReminder } from "./footer"
import { SimpleLastResult } from "./event-extras"
import { DataState } from "./data-ui"
import { SimpleImmersionHost } from "./immersion-host"
export function SimpleHomeView({serverTime}:{serverTime:number}) {
 const {data,error,isLoading,mutate}=useSimpleSchedule(); const now=useSimpleClock(serverTime); const favorites=useSimpleFavorites()
 const [filters,setFilters]=useState(DEFAULT_FILTERS); const [view,setView]=useState<ViewMode>("list")
 const [anchor,setAnchor]=useState(dayKey(serverTime)); const [selected,setSelected]=useState<string|null>(null)
 const [active,setActive]=useState<StartSelection|null>(null); const seen=useRef(new Set<string>())
 const events=data?.events??[]; const filtered=filterEvents(events,filters,favorites.ids,now)
 const visible=view!=="list"&&selected?dayEvents(filtered,selected):filtered
 const upcoming=nextStart(events,now)
 useEffect(()=>{try{localStorage.setItem("racecalendar-home-version","new")}catch{}},[])
 useEffect(()=>{
  if(active||document.hidden||document.querySelector('[aria-modal="true"]'))return
  const candidate=countdownCandidate(events,now); if(!candidate)return
  const key=countdownKey(candidate.event,candidate.session.utc); if(seen.current.has(key))return
  try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,"1")}catch{}
  seen.current.add(key);setActive({...candidate,entrance:true})
 },[data,now,active])
 return <main><SimpleHeader now={now}/><SimpleNextSession start={upcoming} now={now} onStart={setActive}/><SimpleSourceStatus data={data} error={error}/><SimpleReminder events={events}/><SimpleFilters value={filters} onChange={setFilters} view={view} onView={setView}/><DataState loading={isLoading&&!data} error={!data?error:undefined} empty={!!data&&!filtered.length} retry={()=>mutate()}>{view!=="list"&&<SimpleCalendar events={filtered} view={view} anchor={anchor} selected={selected} now={now} onAnchor={setAnchor} onSelect={setSelected}/>}{view!=="list"&&selected&&<p className="s-note">{selected} · {visible.length} 场赛事</p>}{visible.map(event=><SimpleEventCard key={event.id} event={event} now={now} favorite={favorites.ids.includes(event.id)} onFavorite={()=>favorites.toggle(event.id)} onStart={setActive}/>)}</DataState>{!favorites.persisted&&<p className="s-note" role="status">浏览器未允许保存，收藏仅在本次访问有效。</p>}{filters.series==="F1"&&<SimpleLastResult/>}<SimpleFooter/><SimpleImmersionHost selection={active} onClose={()=>setActive(null)}/></main>
}