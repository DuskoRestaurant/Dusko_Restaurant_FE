const count = (table, key) => Number(table[key]) || 0;
export function serviceTableFilters(tables) {
  const sum = key => tables.reduce((total, table) => total + count(table, key), 0);
  return [
    {id:'ALL', label:'Tất cả bàn', count:tables.length},
    {id:'PAY', label:'Chờ thanh toán', count:tables.filter(t=>t.checkoutReady||t.billRequested).length},
    {id:'SERVING', label:'Đang phục vụ', count:tables.filter(t=>t.status==='SERVING').length},
    {id:'CONFIRM', label:'Chờ xác nhận', count:sum('unconfirmedOrderCount')},
    {id:'READY', label:'Món sẵn sàng', count:sum('readyQuantity')},
    {id:'CALL', label:'Cần hỗ trợ', count:sum('serviceRequestCount')},
    {id:'EMPTY', label:'Bàn trống', count:tables.filter(t=>t.status==='EMPTY').length},
    {id:'RESERVED', label:'Đã đặt trước', count:tables.filter(t=>t.status==='RESERVED').length},
  ];
}
export function filterServiceTables(tables, {search='', filter='ALL',prioritizePayment=false} = {}) {
  const query = search.trim().toLocaleLowerCase('vi');
  const priority = t => Number(prioritizePayment&&Boolean(t.checkoutReady||t.billRequested))*40+Number(count(t,'serviceRequestCount')>0)*20 + Number(count(t,'unconfirmedOrderCount')>0)*10 + Number(count(t,'readyQuantity')>0)*5;
  return tables.filter(t=>t.tableName.toLocaleLowerCase('vi').includes(query) &&
    (filter==='ALL' || filter==='PAY'&&Boolean(t.checkoutReady||t.billRequested) || ['SERVING','EMPTY','RESERVED'].includes(filter) && t.status===filter ||
      filter==='CALL' && count(t,'serviceRequestCount')>0 || filter==='CONFIRM' && count(t,'unconfirmedOrderCount')>0 || filter==='READY' && count(t,'readyQuantity')>0))
    .sort((a,b)=>priority(b)-priority(a)||a.tableName.localeCompare(b.tableName,'vi',{numeric:true}));
}

const naturalTableOrder = (a,b) => a.tableName.localeCompare(b.tableName,'vi',{numeric:true});

export function groupServiceTables(tables, role='STAFF'){
  const cashier = ['ADMIN','MANAGER','CASHIER'].includes(role);
  const groups = cashier
    ? [
        {id:'payment',label:'Cần thanh toán',items:[]},
        {id:'serving',label:'Đang phục vụ',items:[]},
        {id:'empty',label:'Bàn trống',items:[]},
        {id:'reserved',label:'Đã đặt trước',items:[]},
      ]
    : [
        {id:'support',label:'Cần hỗ trợ',items:[]},
        {id:'confirm',label:'Chờ xác nhận',items:[]},
        {id:'ready',label:'Món sẵn sàng',items:[]},
        {id:'serving',label:'Đang phục vụ',items:[]},
        {id:'empty',label:'Bàn trống',items:[]},
        {id:'reserved',label:'Đã đặt trước',items:[]},
      ];

  for(const table of tables){
    let index;
    if(cashier){
      index = table.billRequested||table.checkoutReady ? 0 : table.status==='SERVING' ? 1 : table.status==='EMPTY' ? 2 : 3;
    }else{
      index = table.serviceRequestCount ? 0
        : table.unconfirmedOrderCount ? 1
        : table.readyQuantity ? 2
        : table.status==='SERVING' ? 3
        : table.status==='EMPTY' ? 4
        : 5;
    }
    groups[index].items.push(table);
  }

  groups.forEach(group=>group.items.sort(naturalTableOrder));
  return groups.filter(group=>group.items.length);
}
