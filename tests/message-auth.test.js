import test from 'node:test';
import assert from 'node:assert/strict';
import {isTrustedDashboardSender,isTrustedPopupSender} from '../src/message-auth.js';

const runtime={id:'extension-id',getURL:path=>`chrome-extension://extension-id/${path}`};

test('dashboard authorization requires the exact extension dashboard document',()=>{
 assert.equal(isTrustedDashboardSender({id:runtime.id,url:runtime.getURL('src/ui/newtab.html')},runtime),true);
 assert.equal(isTrustedDashboardSender({id:runtime.id,documentUrl:runtime.getURL('src/ui/newtab.html'),tab:{url:runtime.getURL('src/ui/newtab.html')}},runtime),true);
 assert.equal(isTrustedDashboardSender({id:runtime.id,url:runtime.getURL('src/ui/popup.html')},runtime),false);
 assert.equal(isTrustedDashboardSender({id:runtime.id,url:'https://example.com',tab:{url:runtime.getURL('src/ui/newtab.html')}},runtime),false);
 assert.equal(isTrustedDashboardSender({id:'other',url:runtime.getURL('src/ui/newtab.html')},runtime),false);
 assert.equal(isTrustedDashboardSender({id:runtime.id,tab:{url:runtime.getURL('src/ui/newtab.html')}},runtime),false);
});

test('popup authorization is separate from the dashboard and rejects page URL spoofing',()=>{
 assert.equal(isTrustedPopupSender({id:runtime.id,url:runtime.getURL('src/ui/popup.html')},runtime),true);
 assert.equal(isTrustedPopupSender({id:runtime.id,url:runtime.getURL('src/ui/newtab.html')},runtime),false);
 assert.equal(isTrustedPopupSender({id:runtime.id,url:'https://example.com',tab:{url:runtime.getURL('src/ui/popup.html')}},runtime),false);
});
