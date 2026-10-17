import { NewHome } from "./new-home"
import "./new-home.css"

export const metadata = { title: "赛道时刻 · 新版首页" }

export default function NewHomePage() {
  return <NewHome serverTime={Date.now()} />
}
