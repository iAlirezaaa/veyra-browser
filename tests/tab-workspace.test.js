import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CATEGORIES, sanitizeCategories, tabCategory, groupedByCategory, assignUrlCategory, orderedTabs, newCategory} from '../src/tab-workspace.js';
const tabs=[
 {id:1,windowId:1,index:2,url:'https://github.com/openai',title:'GitHub',lastAccessed:10},
 {id:2,windowId:1,index:0,url:'https://chatgpt.com/c/a',title:'Answer',lastAccessed:40},
 {id:3,windowId:1,index:1,url:'https://youtube.com/watch?v=1',title:'Video',lastAccessed:20}
];
test('default category prediction and manual URL assignment',()=>{
 assert.equal(tabCategory(tabs[0]),'work');assert.equal(tabCategory(tabs[1]),'ai');
 const assignment=assignUrlCategory({},tabs[1].url,'work',DEFAULT_CATEGORIES);
 assert.equal(tabCategory(tabs[1],{tabAssignments:assignment}),'work');
 assert.equal(groupedByCategory(tabs,{tabAssignments:assignment}).find(x=>x.id==='work').tabs.length,2);
 assert.throws(()=>assignUrlCategory({},'javascript:alert(1)','work',DEFAULT_CATEGORIES));
});
test('categorization is stable, unique, color constrained',()=>{
 assert.deepEqual(sanitizeCategories([{id:'work',name:' Project ',color:'wrong'}, {id:'work',name:'dupe',color:'red'}, {id:'!bad',name:'bad'}]),[{id:'work',name:'Project',color:'grey'}]);
 const c=newCategory('New Category',[...DEFAULT_CATEGORIES,{id:'new-category',name:'New Category',color:'blue'}]);
 assert.equal(c.id,'new-category-2');
});
test('sorting supports actual browser order, recent activity and category grouping',()=>{
 assert.deepEqual(orderedTabs(tabs,{tabSort:'browser'}).map(x=>x.id),[2,3,1]);
 assert.deepEqual(orderedTabs(tabs,{tabSort:'recent'}).map(x=>x.id),[2,3,1]);
 assert.equal(orderedTabs(tabs,{tabSort:'title'})[0].title,'Answer');
 assert.equal(orderedTabs(tabs,{tabSort:'category'})[0].id,1);
 assert.equal(groupedByCategory(tabs).map(x=>x.id).join(','),'work,ai,media');
});
