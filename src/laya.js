// Optional localhost-only adapter for NandhaKishorM/laya. No external service, no auto-execution.
const URL='http://127.0.0.1:8000/predict';
export async function layaKeepSuggestion(candidate,fetchImpl=fetch) {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),4500);
  try {
    const response=await fetchImpl(URL,{
      method:'POST',headers:{'content-type':'application/json'},signal:controller.signal,
      body:JSON.stringify({
        state:{title:String(candidate.title||'').slice(0,180),domain:candidate.host,type:candidate.type},
        questions:{archive:{type:'noul',instructions:'Should the user review this browser tab for archiving? Answer yes for likely unneeded or duplicated tabs. Never decide to delete.'}}
      })
    });
    if (!response.ok) throw new Error(`Laya HTTP ${response.status}`);
    const data=await response.json();
    const result=data?.answers?.archive;
    if (!result || !Number.isFinite(Number(result.noul))) throw new Error('Unexpected Laya response');
    return {yesProbability:Number(result.noul),confidence:Number(result.confidence||0),engine:'laya'};
  } finally {clearTimeout(timeout);}
}
