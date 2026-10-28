export function categoryScrollTarget(left,width,viewportWidth,contentWidth) {
  const end=Math.max(0,contentWidth-viewportWidth);
  return Math.max(0,Math.min(end,left+width/2-viewportWidth/2));
}
