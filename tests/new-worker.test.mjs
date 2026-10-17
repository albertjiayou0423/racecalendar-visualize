import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
test('service worker does not intercept new admin or component testing pages',()=>{
 const handlers=new Map();let intercepted=0;let fetched=0
 const context={URL,self:{location:{origin:'https://example.com'},addEventListener:(name,handler)=>handlers.set(name,handler)},fetch:()=>{fetched++;return Promise.reject(new Error('offline'))},caches:{match:()=>Promise.resolve(undefined),open:()=>Promise.resolve({put:()=>{}})}}
 vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context)
 for(const path of ['/new/admin','/new/admin/nested','/new/playground','/new/playground/immersion/impact','/api/admin/database','/api/feedback'])handlers.get('fetch')({request:{method:'GET',url:'https://example.com'+path,mode:'navigate'},respondWith:()=>intercepted++})
 assert.equal(intercepted,0);assert.equal(fetched,0)
})
