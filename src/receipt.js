import {receiptMarkup,receiptPrintStyle} from './receipt-format.js';
import {createSingleFlight} from './single-flight.js';
import './receipt.css';
export function showReceipt(receipt){
 const dialog=document.createElement('dialog');dialog.className='receipt-dialog';dialog.setAttribute('aria-label','Hóa đơn thanh toán');
 dialog.innerHTML='<div class="receipt-actions"><button type="button" data-print>In hóa đơn</button><button type="button" data-close>Đóng</button></div><div class="receipt-preview"></div>';
 // Isolate the receipt from application header/table styles in every shell.
 const preview=dialog.querySelector('.receipt-preview').attachShadow({mode:'open'});
 preview.innerHTML=`<style>${receiptPrintStyle}:host{display:block;min-width:0;color:#111;font-family:Arial,sans-serif}.receipt-paper{width:100%;max-width:380px;padding:16px;background:#fff;font-size:12px;overflow-wrap:anywhere}.receipt-paper table{table-layout:fixed;font-size:11px}.receipt-paper th:first-child,.receipt-paper td:first-child{width:36%}.receipt-paper th:nth-child(2){width:10%}.receipt-paper th:nth-child(3),.receipt-paper th:nth-child(4){width:27%}.receipt-paper td{overflow-wrap:anywhere}.receipt-totals b{text-align:right}</style>${receiptMarkup(receipt)}`;
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.querySelector('[data-print]').onclick=()=>{
  const frame=document.createElement('iframe');frame.title='In hóa đơn';frame.style.cssText='position:fixed;width:1px;height:1px;left:-10000px;border:0';
  frame.onload=()=>{frame.contentWindow.onafterprint=()=>frame.remove();frame.contentWindow.focus();frame.contentWindow.print();};
  frame.srcdoc=`<!doctype html><html lang="vi"><meta charset="utf-8"><title>${String(receipt.snapshot.code).replace(/[^A-Za-z0-9-]/g,'')}</title><style>${receiptPrintStyle}</style>${receiptMarkup(receipt)}</html>`;document.body.append(frame);
 };
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();return ()=>dialog.close();
}
// One in-flight receipt request at a time. `openReceipt` issues a mutating
// POST, and a double click would create two receipts for one paid order.
const openReceiptOnce = createSingleFlight();

export function openReceipt(request,kind,id){
  return openReceiptOnce(`${kind}:${id}`,async()=>{
   try{const receipt=await request(`/api/receipts/${kind}/${encodeURIComponent(id)}`,{method:'POST',body:{}});showReceipt(receipt);return receipt;}
   catch(error){showReceiptError(request,kind,id,error);return null;}
  });
}
function showReceiptError(request,kind,id,error){
 const dialog=document.createElement('dialog');dialog.className='receipt-history';
 const message=document.createElement('p');message.textContent=`Chưa tạo được hóa đơn: ${error.message}. Giao dịch đã thanh toán không bị thay đổi.`;
 const retry=document.createElement('button');retry.type='button';retry.textContent='Thử lại';
 retry.onclick=()=>{dialog.close();openReceipt(request,kind,id);};
 const close=document.createElement('button');close.type='button';close.textContent='Đóng';close.onclick=()=>dialog.close();
 dialog.append(message,retry,close);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 document.body.append(dialog);dialog.showModal();
}
export async function showRecentReceipts(request,branchId){
 const receipts=await request(`/api/receipts?branchId=${branchId}`);
 const dialog=document.createElement('dialog');dialog.className='receipt-history';dialog.innerHTML='<h2>Hóa đơn gần đây</h2><div data-list></div><button type="button" data-close>Đóng</button>';
 const list=dialog.querySelector('[data-list]');
 if(!receipts.length)list.textContent='Chưa có hóa đơn được tạo.';
 for(const receipt of receipts){const button=document.createElement('button');button.type='button';button.textContent=`${receipt.snapshot.code} · ${receipt.snapshot.tableName} · ${new Intl.NumberFormat('vi-VN').format(receipt.snapshot.total)} đ`;button.onclick=()=>showReceipt(receipt);list.append(button);}
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}
