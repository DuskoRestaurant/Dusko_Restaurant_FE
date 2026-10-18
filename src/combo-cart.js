export function cartComboPricing(cart, products, selections) {
 const available=new Map(cart),valid=[];
 for(const combo of selections){
  if(combo.productIds.every(id=>(available.get(id)||0)>=combo.quantity)){
   for(const id of combo.productIds)available.set(id,available.get(id)-combo.quantity);
   valid.push(combo);
  }
 }
 const retail=[...cart].reduce((sum,[id,q])=>sum+(products.find(p=>p.id===id)?.sellingPrice||0)*q,0);
 const discount=valid.reduce((sum,c)=>sum+Math.max(0,c.productIds.reduce((n,id)=>n+(products.find(p=>p.id===id)?.sellingPrice||0),0)-c.price)*c.quantity,0);
 return {valid,retail,discount,total:retail-discount};
}
