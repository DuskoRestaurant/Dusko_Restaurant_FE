import test from 'node:test';
import assert from 'node:assert/strict';
import {metricCard,metricGrid,dataTable,statusBadge} from '../src/ui/admin-components.js';

test('shared metric accepts module content while escaping text and restricting presentation options',()=>{
 const html=metricCard({label:'<script>',value:'<value>',description:'"data"',icon:'<img>',tone:'" onclick=bad',className:'backup-metric "onclick=bad',detailHtml:'<progress value="20" max="100"></progress>'});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;value&gt;'));assert.ok(html.includes('&lt;img&gt;'));
 assert.ok(html.includes('ui-metric--primary'));assert.ok(html.includes('backup-metric'));
 assert.ok(!html.includes('onclick'));assert.ok(html.includes('<progress'));
 assert.equal((metricGrid([html,html]).match(/<article /g)||[]).length,2);
});
test('shared table preserves module action markup and footer but escapes headings and status labels',()=>{
 const html=dataTable({headers:['<Name>','Actions'],rowsHtml:'<tr><td>Record</td><td><button data-backup="details">View</button></td></tr>',footerHtml:'<nav aria-label="Pagination"></nav>',className:'archive-table',caption:'<History>'});
 assert.ok(html.includes('<th scope="col">&lt;Name&gt;</th>'));assert.ok(html.includes('&lt;History&gt;'));
 assert.ok(html.includes('data-backup="details"'));assert.ok(html.indexOf('</table>')<html.indexOf('<nav'));
 assert.equal((html.match(/<table /g)||[]).length,1);
 assert.ok(statusBadge('<paid>',{tone:'success'}).includes('ui-status--success'));
 assert.ok(statusBadge('<paid>').includes('&lt;paid&gt;'));
});
