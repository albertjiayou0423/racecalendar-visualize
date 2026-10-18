"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ComponentProps } from "react"
import { editionHref } from "@/app/new/navigation"
export default function EditionLink({href,...props}:ComponentProps<typeof Link>){
 const pathname=usePathname(); const inNew=pathname==="/new"||pathname.startsWith("/new/")
 const adapt=(value:string)=>editionHref(value,inNew)
 return <Link {...props} href={typeof href==="string"?adapt(href):{...href,pathname:typeof href.pathname==="string"?adapt(href.pathname):href.pathname}}/>
}