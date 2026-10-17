// Authenticated WebSocket invalidation; REST APIs retain business authorization.
export function watchChanges(request, onChange, path='/api/live') {
  let stopped=false, socket, reconnectTimer, retryTimer, controller;
  let pending=false, refreshing=false, retries=0, lastMessage;
  async function refresh(){
    if(stopped||refreshing||!pending)return;
    refreshing=true;pending=false;
    try{await onChange(lastMessage);}
    catch{pending=true;retryTimer=setTimeout(()=>{retryTimer=null;refresh();},1000);}
    finally{refreshing=false;}
    if(pending&&!retryTimer&&!stopped)queueMicrotask(refresh);
  }
  function changed(message){lastMessage=message;pending=true;clearTimeout(retryTimer);retryTimer=null;refresh();}
  async function connect(){
    if(stopped)return;
    controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const ticket=await request(path,{signal:controller.signal});
      if(stopped)return;
      const base=import.meta.env?.VITE_API_URL||import.meta.env?.VITE_API_BASE_URL||location.origin;
      const url=new URL(ticket.path,base);url.protocol=url.protocol==='https:'?'wss:':'ws:';
      const ws=socket=new WebSocket(url);
      const handshake=setTimeout(()=>ws.close(),10000);
      ws.onopen=()=>ws.send(JSON.stringify({type:'authenticate',ticket:ticket.ticket}));
      ws.onmessage=event=>{try{const message=JSON.parse(event.data);if(message.type==='change'){clearTimeout(handshake);retries=0;changed(message);}}catch{ws.close();}};
      ws.onerror=()=>ws.close();
      ws.onclose=()=>{clearTimeout(handshake);if(!stopped)schedule();};
    }catch{if(!stopped)schedule();}
    finally{clearTimeout(timeout);}
  }
  function schedule(){clearTimeout(reconnectTimer);reconnectTimer=setTimeout(connect,Math.min(1000*2**retries++,15000)+Math.random()*300);}
  connect();
  return ()=>{stopped=true;clearTimeout(reconnectTimer);clearTimeout(retryTimer);controller?.abort();socket?.close();};
}
