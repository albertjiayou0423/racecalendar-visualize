import { notFound } from "next/navigation"
import { immersionCases } from "@/lib/immersion-catalog"
import { SimpleImmersionLabCase } from "../../../components/immersion-lab"
export default async function Page({params}:{params:Promise<{component:string}>}){const {component}=await params;const item=immersionCases.find(item=>item.id===component);if(!item)notFound();return <SimpleImmersionLabCase id={item.id} fullscreen/>}