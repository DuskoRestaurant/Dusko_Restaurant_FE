import assert from 'node:assert/strict';

// Check rendered styles as well as tokens: old CSS can override a token's fill.
export async function assertSurfaceContrast(page, selectors) {
  const failures=await page.evaluate(selectors=>{
    const rgb=value=>value.match(/[\d.]+/g)?.map(Number);
    const luminance=values=>values.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const failures=[];
    for(const element of document.querySelectorAll(selectors.join(','))){
      if(!element.getClientRects().length||element.disabled)continue;
      const foreground=rgb(getComputedStyle(element).color);
      let node=element,background;
      while(node){
        const candidate=rgb(getComputedStyle(node).backgroundColor);
        if(candidate&&(candidate.length===3||candidate[3]===1)){background=candidate;break;}
        node=node.parentElement;
      }
      if(!background)background=[255,255,255];
      const a=luminance(foreground),b=luminance(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      if(ratio<4.5)failures.push({text:element.textContent.trim().slice(0,60),ratio:ratio.toFixed(2)});
    }
    return failures;
  },selectors);
  assert.deepEqual(failures,[],'Visible workspace text must meet 4.5:1 contrast');
}
