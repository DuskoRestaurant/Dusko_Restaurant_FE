// Separate document views retain the menu and its scroll position. No modal layer.
export function createCustomerViews({root,beforeNavigate=()=>{},snapshot={}}) {
  let menuScroll=snapshot.menuScroll||0;
  let isHistory=false;
  const menu=root.querySelector('#customer-menu-view'),historyView=root.querySelector('#customer-history-view');
  function apply({initial=false}={}) {
    const next=location.hash==='#history';
    if(!initial&&next===isHistory)return;
    if(!initial||next)beforeNavigate();
    if(next&&!isHistory&&!initial)menuScroll=window.scrollY;
    isHistory=next;
    menu.hidden=next;historyView.hidden=!next;
    root.classList.toggle('guest-show-history',next);
    window.scrollTo({top:next?0:initial?window.scrollY:menuScroll,behavior:'instant'});
    if(!initial)(next?historyView.querySelector('h1'):root.querySelector('[data-open-history]'))?.focus({preventScroll:true});
  }
  function navigate(event){
    const open=event.target.closest('[data-open-history]'),back=event.target.closest('[data-close-history]');
    if(!open&&!back)return;
    event.preventDefault();
    if(open){window.history.pushState({duskoHistory:true},'',`${location.pathname}${location.search}#history`);apply();}
    else if(window.history.state?.duskoHistory)window.history.back();
    else {window.history.replaceState(null,'',`${location.pathname}${location.search}`);apply();}
  }
  const changed=()=>apply();
  root.addEventListener('click',navigate);window.addEventListener('hashchange',changed);window.addEventListener('popstate',changed);
  apply({initial:true});
  return {getView:()=>({menuScroll}),destroy(){root.removeEventListener('click',navigate);window.removeEventListener('hashchange',changed);window.removeEventListener('popstate',changed);}};
}
