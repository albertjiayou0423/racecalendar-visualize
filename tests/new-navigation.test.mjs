import { test } from 'node:test'
import assert from 'node:assert/strict'
import { editionHref } from '../app/new/navigation.ts'
test('edition navigation stays in new screens without altering classic links, assets or APIs',()=>{
 for(const href of ['/','/standings?season=2026#drivers','/event/f1-2026-18','/playground/immersion/lights-fe']){assert.equal(editionHref(href,false),href);assert.equal(editionHref(href,true),'/new'+(href==='/'?'':href))}
 for(const href of ['/new','/new/standings','/api/calendar?id=x','//example.com/a','https://example.com','/brand-logo.svg','#details','mailto:a@example.com'])assert.equal(editionHref(href,true),href)
})
