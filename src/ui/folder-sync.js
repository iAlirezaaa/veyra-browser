import {dbGet,dbPut} from '../db.js';
import {toMarkdown} from '../core.js';
import {chatArchiveName} from '../archive.js';

const KEY='chosen-directory';
export async function getChosenFolder(){return (await dbGet('preferences',KEY))?.handle||null;}
export async function chooseFolder(picker=globalThis.showDirectoryPicker){
  if(typeof picker!=='function')throw new Error('Directory picker is not available in this browser');
  // The picker must be called immediately from the user click (transient activation).
  const handle=await picker({mode:'readwrite',id:'veyra-ai-chats',startIn:'documents'});
  if(!handle||handle.kind!=='directory')throw new Error('No folder selected');
  await dbPut('preferences',{id:KEY,handle,name:handle.name,directoryId:crypto.randomUUID()});
  return handle;
}
export async function getFolderAccess(handle){
  if(!handle)return 'missing';
  const permission=await handle.queryPermission({mode:'readwrite'});
  return permission==='granted'?'granted':'needs-permission';
}
/** Call after explicit directory consent; never request permissions in a background loop. */
export async function syncFolder({send,handle,onProgress=()=>{}}){
  if(await getFolderAccess(handle)!=='granted') return {status:'needs-permission',saved:0};
  const record=await dbGet('preferences',KEY);
  if(!record?.directoryId) throw new Error('No saved folder identity');
  let total=0;
  for(let round=0;round<250;round++){
    const {chats}=await send('GET_EXPORT_QUEUE',{directoryId:record.directoryId});
    if(!chats.length) return {status:'synced',saved:total};
    for(const chat of chats){
      const platform=String(chat.platform||'other');
      if(!/^(chatgpt|claude|gemini|perplexity|grok)$/.test(platform))continue;
      const dir=await handle.getDirectoryHandle(platform,{create:true});
      const filename=chat.archiveName||chatArchiveName(chat);
      const target=await dir.getFileHandle(filename,{create:true});
      const writable=await target.createWritable();
      try{await writable.write(toMarkdown(chat));await writable.close();}
      catch(error){try{await writable.abort();}catch{}throw error;}
      const ack=await send('ACK_FOLDER_EXPORT',{id:chat.id,updatedAt:chat.updatedAt,directoryId:record.directoryId});
      if(ack.acknowledged){total++;onProgress(total);}
    }
  }
  return {status:'partial',saved:total};
}
