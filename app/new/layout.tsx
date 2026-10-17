import "./simple.css"
import type { ReactNode } from "react"

export default function NewLayout({ children }: { children: ReactNode }) {
  return <div className="simple-home"><div className="s-shell">{children}</div></div>
}
