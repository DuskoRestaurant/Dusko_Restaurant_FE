import {escapeHtml as e} from '../api.js';

// Text props are escaped; *Html slots accept only markup rendered by the module.
const classes=value=>String(value||'').split(/\s+/).filter(value=>/^[\w-]+$/.test(value)).join(' ');
export function metricCard({label,value,description='',icon='',iconHtml='',detailHtml='',tone='primary',className=''}){
 const variant=['primary','warning','accent','danger','success'].includes(tone)?tone:'primary';
 return `<article class="ui-metric ui-metric--${variant} ${classes(className)}"><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(description)}</small>${detailHtml?`<div class="ui-metric-detail">${detailHtml}</div>`:''}<i aria-hidden="true">${iconHtml||e(icon)}</i></article>`;
}
export const metricGrid=(cards,{className=''}={})=>`<div class="ui-metric-grid ${classes(className)}">${cards.join('')}</div>`;
const numericHeader=label=>/^(?:giá(?:\s|$)|thành tiền|tổng(?: tiền| cộng|$)|tạm tính|doanh thu|lợi nhuận|tỷ lệ|tồn|định mức|đã bán|còn lại|dung lượng|số lượng|số đơn|số suất|số ngày|suất|sl\b)/iu.test(label);
export function tableMarkup({headers,rowsHtml='',className='',caption='',responsive=false}){
 const numeric=headers.map(numericHeader);
 const labeledRows=rowsHtml.replace(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi,(_,attributes,cells)=>{
   let column=0;
   return `<tr${attributes}>${cells.replace(/<td\b([^>]*)>/gi,(_,attributes)=>{
     const index=column++;
     if(/\bcolspan\s*=/.test(attributes))return `<td${attributes}>`;
     if(!/\bdata-label\s*=/.test(attributes))attributes+=` data-label="${e(headers[index]||'')}"`;
     if(numeric[index])attributes=/\bclass="/.test(attributes)?attributes.replace(/\bclass="/,'class="ui-numeric '):attributes+' class="ui-numeric"';
     return `<td${attributes}>`;
   })}</tr>`;
 });
 return `<table class="ui-table ${responsive?'ui-responsive ':''}${classes(className)}">${caption?`<caption class="ui-sr-only">${e(caption)}</caption>`:''}<thead><tr>${headers.map((label,index)=>`<th scope="col"${numeric[index]?' class="ui-numeric"':''}>${e(label)}</th>`).join('')}</tr></thead><tbody>${labeledRows}</tbody></table>`;
}
export function tableFrame({contentHtml,footerHtml='',className=''}){
 return `<div class="ui-table-frame ${classes(className)}">${contentHtml}${footerHtml}</div>`;
}
export function dataTable({headers,rowsHtml,caption='',className='',tableClassName='',scrollClassName='',footerHtml=''}){
 return tableFrame({className,footerHtml,contentHtml:`<div class="ui-table-scroll ${classes(scrollClassName)}">${tableMarkup({headers,rowsHtml,caption,className:tableClassName,responsive:true})}</div>`});
}
export function statusBadge(label,{tone='neutral',className=''}={}){
 const variant=['neutral','success','warning','danger','info'].includes(tone)?tone:'neutral';
 return `<span class="ui-status ui-status--${variant} ${classes(className)}">${e(label)}</span>`;
}
