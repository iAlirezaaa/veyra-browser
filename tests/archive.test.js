import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveId,isConversationUrl,chatArchiveName,cleanDownloadsFolder,downloadFilename,pageMarkdownName} from '../src/archive.js';

test('only conversation routes are eligible; new unsaved landing pages are never mixed together',()=>{
  const ok=[
    'https://chatgpt.com/c/aa11bb22',
    'https://chatgpt.com/g/g-xxx/c/aa11bb22',
    'https://claude.ai/chat/aaa',
    'https://gemini.google.com/app/aaa',
    'https://gemini.google.com/u/0/app/aaa',
    'https://www.perplexity.ai/search/aaa',
    'https://grok.com/chat/aaa'
  ];
  for(const url of ok){assert.ok(isConversationUrl(url),url);assert.ok(archiveId(url));}
  for(const url of ['https://chatgpt.com/','https://claude.ai/new','https://gemini.google.com/','https://evil.com/c/aaa','file:///tmp/c/aaa']){
    assert.equal(isConversationUrl(url),false,url);assert.equal(archiveId(url),'',url);
  }
});
test('file names are safe, unique, multilingual and independent of title changes when retained',()=>{
 const a=chatArchiveName({url:'https://chatgpt.com/c/123',title:'سوال برای پروژه / Veyra'});
 const b=chatArchiveName({url:'https://chatgpt.com/c/456',title:'سوال برای پروژه / Veyra'});
 assert.match(a,/\.md$/);assert.notEqual(a,b);assert.ok(!a.includes('/'));
 assert.equal(downloadFilename({url:'https://chatgpt.com/c/123',title:'Hello',archiveName:a},'Veyra/AI-Chats'),`Veyra/AI-Chats/chatgpt/${a}`);
});
test('downloads paths cannot escape the Chrome Downloads root',()=>{
 for(const value of ['../secrets','C:\\Users\\bob','/tmp','..','Veyra/../trash','Veyra//archive','.secret','a/b/c/d/e'])assert.equal(cleanDownloadsFolder(value),'',value);
 assert.equal(cleanDownloadsFolder('Veyra/AI-Chats'),'Veyra/AI-Chats');
 assert.equal(cleanDownloadsFolder('ویرا/گفتگوها'),'ویرا/گفتگوها');
});
test('page Markdown filename templates substitute safe title, domain and date values',()=>{
 const value=pageMarkdownName('Hello / World','https://www.example.com/docs','{domain} - {title} - {date}');
 assert.match(value,/^examplecom-Hello-World-\d{4}-\d{2}-\d{2}\.md$/);
 assert.equal(pageMarkdownName('Page','https://example.com',''), 'Page.md');
});

test('long Markdown exports split into numbered parts with all messages intact',async()=>{
 const {markdownParts}=await import('../src/archive.js');
 const messages=Array.from({length:80},(_,i)=>({role:i%2?'assistant':'user',text:`MARKER_${i}_`+'a'.repeat(1000)}));
 const parts=markdownParts({url:'https://chatgpt.com/c/123',platform:'chatgpt',title:'Large transcript',updatedAt:'2026-11-03',archiveName:'large.md',messages},5500);
 assert.ok(parts.length>10);
 assert.equal(parts[0].filename,'large.md');assert.equal(parts[1].filename,'large--part-002.md');
 assert.ok(parts.every(p=>p.content.length<=5500));
 for(let i=0;i<messages.length;i++)assert.equal(parts.filter(p=>p.content.includes(`MARKER_${i}_`)).length,1);
});
