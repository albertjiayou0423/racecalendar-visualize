import "./simple.css"
import { EditionShell } from "./components/edition-shell"
import type { ReactNode } from "react"
export default function NewLayout({children}:{children:ReactNode}){return <EditionShell>{children}</EditionShell>}
