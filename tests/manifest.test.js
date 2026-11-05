import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const m=JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8'));
test('Chrome MV3 override and files exist',()=>{
 assert.equal(m.manifest_version,3);
 assert.equal(m.chrome_url_overrides.newtab,'src/ui/newtab.html');
 for(const path of [m.chrome_url_overrides.newtab,m.background.service_worker,m.action.default_popup,...Object.values(m.icons)]) assert.ok(existsSync(resolve(root,path)),path);
});
test('product is named Veyra and SkyVision is credited as its maker',()=>{
 assert.equal(m.name,'Veyra — Browser Workspace');
 assert.match(m.description,/Veyra.*by SkyVision/);
 assert.equal(m.action.default_title,'Open Veyra');
});
test('sensitive permissions stay optional',()=>{
 assert.equal(m.permissions.includes('history'),false);
 assert.equal(m.permissions.includes('notifications'),true);
 assert.ok(m.optional_permissions.includes('history'));
 assert.equal(m.permissions.includes('cookies'),false);
 assert.equal(m.permissions.includes('webRequest'),false);
 assert.equal(Boolean(m.content_scripts),false,'Chat capture must not run before opt-in');
});
test('no remote all-sites content script injection',()=>{
 assert.ok(m.optional_host_permissions.includes('https://*/*'));
 assert.equal(m.host_permissions,undefined);
});
