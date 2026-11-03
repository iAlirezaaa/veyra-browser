const DATABASE='veyra-v1';
const TABLES=['chats','clips','decisions','preferences','receipts'];
let opened;
function openDb() {
  if (!opened) opened=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,2);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for (const name of TABLES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name,{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  return opened;
}
async function txn(table,mode,run) {
  if (!TABLES.includes(table)) throw new Error('Invalid table');
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(table,mode), r=run(t.objectStore(table));
    let result;
    r.onsuccess=()=>{ result=r.result; };
    r.onerror=()=>reject(r.error);
    t.oncomplete=()=>resolve(result);
    t.onerror=()=>reject(t.error);
    t.onabort=()=>reject(t.error||new Error('Transaction aborted'));
  });
}
export const dbGet=(table,id)=>txn(table,'readonly',s=>s.get(id));
export const dbAll=table=>txn(table,'readonly',s=>s.getAll());
export const dbPut=(table,item)=>txn(table,'readwrite',s=>s.put(item));
export const dbDelete=(table,id)=>txn(table,'readwrite',s=>s.delete(id));
