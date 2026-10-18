import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import test from "node:test"
function load(file,fetchImpl){
 const exports={};const code=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 vm.runInNewContext(code,{exports,require:()=>({NextResponse:{json:(body,init={})=>({body,...init})}}),fetch:fetchImpl,AbortSignal,URL,encodeURIComponent,console})
 return exports.GET
}
const request=title=>({nextUrl:{searchParams:new URLSearchParams({title})}})
test("last results use one fixed upstream with bounded cache and fail uncached",async()=>{
 const race={raceName:"Test",Results:[{position:"1"}]};let calls=0
 const get=load("app/api/f1-last-result/route.ts",async(url,init)=>{calls++;assert.equal(url,"https://api.jolpi.ca/ergast/f1/current/last/results.json");assert.ok(init.signal);assert.equal(init.redirect,"error");return Response.json({MRData:{RaceTable:{Races:[race]}}})})
 const result=await get();assert.equal(calls,1);assert.equal(result.body.MRData.RaceTable.Races[0].raceName,"Test");assert.match(result.headers["Cache-Control"],/s-maxage=300/)
 for(const failure of [()=>{throw Error("timeout")},()=>Response.json({MRData:{RaceTable:{Races:[]}}}),()=>new Response("bad",{status:503})]){const bad=await load("app/api/f1-last-result/route.ts",failure)();assert.equal(bad.status,502);assert.equal(bad.headers["Cache-Control"],"no-store")}
})
test("wiki summary encodes titles, rejects invalid input and strips external image sources",async()=>{
 let calls=0;const get=load("app/api/wiki-summary/route.ts",async(url,init)=>{calls++;assert.equal(url,"https://en.wikipedia.org/api/rest_v1/page/summary/Circuit%20de%20Monaco");assert.ok(init.signal);assert.equal(init.redirect,"error");return Response.json({thumbnail:{source:"https://upload.wikimedia.org/image.jpg",width:500},originalimage:{source:"http://127.0.0.1/private"}})})
 for(const title of ["","x".repeat(201),"abc\u0000"]){const response=await get(request(title));assert.equal(response.status,400)}
 assert.equal(calls,0);const response=await get(request("Circuit de Monaco"));assert.equal(response.body.thumbnail.source,"https://upload.wikimedia.org/image.jpg");assert.equal(response.body.originalimage,undefined)
 const failed=await load("app/api/wiki-summary/route.ts",()=>{throw Error("timeout")})(request("Circuit"));assert.equal(failed.status,502);assert.equal(failed.headers["Cache-Control"],"no-store")
})
