// Long-poll invalidation: acknowledge a revision only after the view refresh succeeds.
export function watchChanges(request, onChange, path='/api/live') {
  let stopped=false, revision='', timer, controller;
  async function loop(){
    controller=new AbortController();
    const deadline=setTimeout(()=>controller.abort(),35000);
    try {
      const value=await request(`${path}?since=${encodeURIComponent(revision)}`,{signal:controller.signal});
      clearTimeout(deadline);
      if(stopped)return;
      if(value?.revision===undefined)throw Error('Missing live revision');
      if(String(value.revision)!==revision){await onChange();revision=String(value.revision);}
      if(!stopped)timer=setTimeout(loop,100);
    } catch {if(!stopped)timer=setTimeout(loop,3000);}
    finally{clearTimeout(deadline);}
  }
  loop();return ()=>{stopped=true;clearTimeout(timer);controller?.abort();};
}
