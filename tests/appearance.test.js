import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTheme, resolveTheme, applyTheme} from '../src/ui/appearance.js';
test('appearance accepts only three explicit choices',()=>{
 assert.deepEqual(['system','light','dark'].map(normalizeTheme),['system','light','dark']);
 assert.equal(normalizeTheme('unknown'),'system');
});
test('system theme follows operating system; explicit choices take precedence',()=>{
 assert.equal(resolveTheme('system',true),'dark');
 assert.equal(resolveTheme('system',false),'light');
 assert.equal(resolveTheme('light',true),'light');
 assert.equal(resolveTheme('dark',false),'dark');
});
test('applyTheme synchronizes root, body, native color-scheme and meta',()=>{
 let themeColor='';
 const doc={documentElement:{dataset:{},style:{}},body:{dataset:{}},querySelector:()=>({setAttribute:(_,value)=>{themeColor=value;}})};
 assert.equal(applyTheme('system',{doc,systemDark:true}),'dark');
 assert.equal(doc.documentElement.dataset.theme,'dark');
 assert.equal(doc.body.dataset.theme,'system');
 assert.equal(doc.documentElement.style.colorScheme,'dark');
 assert.equal(themeColor,'#11161d');
 assert.equal(applyTheme('light',{doc,systemDark:true}),'light');
 assert.equal(themeColor,'#f7f8fa');
});
