import test from 'node:test';
import assert from 'node:assert/strict';
import {isWebTab,normalizeUrl,hostOf,categoryFor,groupTabs,buildSuggestions,providerFromUrl,safeFilename,toMarkdown} from '../src/core.js';
import {titleFromDocumentTitle,slugify} from '../src/vendor/ltf-utils.js';
import {layaKeepSuggestion} from '../src/laya.js';
test('non-web and malformed pages are excluded',()=>{
  assert.equal(isWebTab({url:'chrome://settings'}),false);
  assert.equal(isWebTab({url:'https://example.com'}),true);
  assert.equal(normalizeUrl('javascript:alert(1)'),'');
});
test('normalization removes tracking but preserves meaningful query',()=>{
  assert.equal(normalizeUrl('https://example.com/path/?q=hello&utm_source=spam#section'),'https://example.com/path?q=hello');
  assert.equal(normalizeUrl('https://example.com/a?foo=1'),'https://example.com/a?foo=1');
});
test('groups tabs by domain without internal pages',()=>{
  const groups=groupTabs([{id:1,url:'https://www.example.com/a'},{id:2,url:'https://example.com/b'},{id:3,url:'chrome://settings'}]);
  assert.equal(groups.length,1);assert.equal(groups[0].count,2);assert.equal(groups[0].host,'example.com');
});
test('duplicates create suggestions, no automatic mutation',()=>{
  const tabs=[{id:1,url:'https://example.com/a'},{id:2,url:'https://example.com/a?utm_source=x'}];
  const suggestions=buildSuggestions(tabs,{},Date.now());
  assert.deepEqual(suggestions.map(x=>x.id),['duplicate:2']);
  assert.equal(tabs.length,2);
  assert.equal(buildSuggestions(tabs,{'duplicate:2':Date.now()+100000}).length,0);
});
test('pinned duplicate is not suggested for removal',()=>{
 assert.equal(buildSuggestions([{id:1,url:'https://x.org'},{id:2,url:'https://x.org',pinned:true}]).length,0);
});
test('categories providers and multilingual filenames',()=>{
  assert.equal(categoryFor({url:'https://chatgpt.com/c/abc'}),'ai');
  assert.equal(providerFromUrl('https://claude.ai/chat/abc'),'claude');
  assert.equal(providerFromUrl('https://chat.deepseek.com/a/chat/s123'),'deepseek');
  assert.equal(providerFromUrl('https://app.higgsfield.ai/create'),'higgsfield');
  assert.equal(hostOf('https://www.github.com/u'),'github.com');
  assert.equal(safeFilename('گفتگوی مهم ✨'),'گفتگوی-مهم');
});
test('markdown archive exports roles and text',()=>{
  const result=toMarkdown({title:'Project',platform:'chatgpt',url:'https://chatgpt.com/c/abc',messages:[{role:'user',text:'سلام'},{role:'assistant',text:'درود'}]});
  assert.match(result,/## User/);assert.match(result,/سلام/);assert.match(result,/## Assistant/);
});
test('adapted MIT utility cleans titles and slugs',()=>{
  assert.equal(titleFromDocumentTitle('Hello - ChatGPT'),'Hello');assert.equal(slugify('Hello World!'),'hello-world');
});
test('Laya request is local, typed and non-executing',async()=>{
  const fake=async(url,args)=>{assert.equal(url,'http://127.0.0.1:8000/predict');assert.equal(args.method,'POST');const body=JSON.parse(args.body);assert.equal(body.questions.archive.type,'noul');return {ok:true,json:async()=>({answers:{archive:{noul:0.87,confidence:0.95}}})};};
  const result=await layaKeepSuggestion({title:'Duplicate',host:'example.com',type:'duplicate'},fake);
  assert.equal(result.yesProbability,0.87);assert.equal(result.confidence,0.95);
});
