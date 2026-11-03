import test from 'node:test';
import assert from 'node:assert/strict';
import {syncFolder,getFolderAccess} from '../src/ui/folder-sync.js';

test('folder requires active write permission and never asks silently',async()=>{
 const handle={queryPermission:async()=> 'prompt',requestPermission:()=>{throw Error('must not run in background')}};
 assert.equal(await getFolderAccess(handle),'needs-permission');
 const r=await syncFolder({send:async()=>{throw Error('should not read archive')},handle});
 assert.equal(r.saved,0);assert.equal(r.status,'needs-permission');
});
