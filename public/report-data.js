
(function(root){
 const DAY=86400000;
 const today=(now=Date.now())=>new Date(now+7*3600000).toISOString().slice(0,10);
 function dates(from,to){
  const start=Date.parse(from+'T00:00:00Z'),end=Date.parse(to+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>366*DAY||new Date(start).toISOString().slice(0,10)!==from||new Date(end).toISOString().slice(0,10)!==to)throw new Error('Chọn khoảng ngày hợp lệ, tối đa 367 ngày.');
  const keys=[];for(let t=start;t<=end;t+=DAY)keys.push(new Date(t).toISOString().slice(0,10));return keys;
 }
 function aggregate(orders,from,to){
  const blank=()=>({orders:0,paid:0,pending:0,revenue:0,pendingValue:0,cost:0,knownRevenue:0,missing:0,discount:0,invalid:0});
  const rows=new Map(dates(from,to).map(k=>[k,{date:k,...blank()}])),sum=blank();
  for(const o of orders){
   const row=rows.get(o.dateKey);if(!row)continue;
   const totalOk=Number.isSafeInteger(o.total)&&o.total>=0;
   for(const x of [row,sum]){
    x.orders++;
    if(!totalOk)x.invalid++;
    if(o.paymentStatus!=='paid'){x.pending++;if(totalOk)x.pendingValue+=o.total;continue;}
    x.paid++;if(totalOk)x.revenue+=o.total;
    if(Number.isSafeInteger(o.discount)&&o.discount>=0)x.discount+=o.discount;
    if(totalOk&&o.costComplete===true&&Number.isSafeInteger(o.totalCost)&&o.totalCost>=0){x.cost+=o.totalCost;x.knownRevenue+=o.total;}else x.missing++;
   }
  }
  return {sum,rows:[...rows.values()]};
 }
 const api={today,dates,aggregate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CCReportData=api;
})(typeof globalThis!=='undefined'?globalThis:this);

