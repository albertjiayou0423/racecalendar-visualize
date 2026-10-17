"use client"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
export function EditionShell({children}:{children:ReactNode}){const pathname=usePathname();return pathname==="/new"?<div className="simple-home"><div className="s-shell">{children}</div></div>:<>{children}</>}
