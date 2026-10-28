// Read the section at the line just below the sticky bar. A small dead band
// prevents tiny up/down movements at a boundary from flipping the active pill.
export function categoryAtReadingLine(tops,line,current=-1,{hysteresis=24,atEnd=false}={}) {
  if(!tops.length)return -1;
  if(atEnd)return tops.length-1;
  let index=Math.max(0,Math.min(tops.length-1,current));
  if(current<0){tops.forEach((top,i)=>{if(top<=line)index=i;});return index;}
  while(index+1<tops.length&&tops[index+1]<=line-hysteresis)index++;
  while(index>0&&tops[index]>line+hysteresis)index--;
  return index;
}
