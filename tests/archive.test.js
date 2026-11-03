import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveId,isConversationUrl,chatArchiveName,cleanDownloadsFolder,downloadFilename} from '../src/archive.js';

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
