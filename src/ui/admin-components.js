import {escapeHtml as e} from '../api.js';

// Text props are escaped; *Html slots accept only markup rendered by the module.
const classes=value=>String(value||'').split(/\s+/).filter(value=>/^[\w-]+$/.test(value)).join(' ');
export function metricCard({label,value,description='',icon='',iconHtml='',detailHtml='',tone='primary',className=''}){
 const variant=['primary','warning','accent','danger','success'].includes(tone)?tone:'primary';
 return `<article class="ui-metric ui-metric--${variant} ${classes(className)}"><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(description)}</small>${detailHtml?`<div class="ui-metric-detail">${detailHtml}</div>`:''}<i aria-hidden="true">${iconHtml||e(icon)}</i></article>`;
}
export const metricGrid=(cards,{className=''}={})=>`<div class="ui-metric-grid ${classes(className)}">${cards.join('')}</div>`;
export function tableMarkup({headers,rowsHtml='',className='',caption=''}){
 return `<table class="ui-table ${classes(className)}">${caption?`<caption class="ui-sr-only">${e(caption)}</caption>`:''}<thead><tr>${headers.map(label=>`<th scope="col">${e(label)}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
}
export function tableFrame({contentHtml,footerHtml='',className=''}){
 return `<div class="ui-table-frame ${classes(className)}">${contentHtml}${footerHtml}</div>`;
}
export function dataTable({headers,rowsHtml,caption='',className='',tableClassName='',scrollClassName='',footerHtml=''}){
 return tableFrame({className,footerHtml,contentHtml:`<div class="ui-table-scroll ${classes(scrollClassName)}">${tableMarkup({headers,rowsHtml,caption,className:tableClassName})}</div>`});
}
export function statusBadge(label,{tone='neutral',className=''}={}){
 const variant=['neutral','success','warning','danger','info'].includes(tone)?tone:'neutral';
 return `<span class="ui-status ui-status--${variant} ${classes(className)}">${e(label)}</span>`;
}
