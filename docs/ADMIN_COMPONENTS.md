# Shared admin cards and tables

The operational overview is the visual reference. `src/ui/admin-components.js`
owns reusable markup and `src/ui/admin-components.css` owns presentation. The
management entry imports this stylesheet once, after legacy module styles.
Other frontend entries can import the same files when adopting these components.
Classes are opt-in; unrelated customer/staff layouts are not restyled globally.

```js
import {metricCard,metricGrid,dataTable,statusBadge} from './ui/admin-components.js';

const metrics=metricGrid([
  metricCard({label:'Records',value:count,description:'Current inventory',icon:'▤'}),
  metricCard({label:'Pending',value:pending,description:'Needs review',tone:'warning'})
]);
const list=dataTable({
  headers:['Reference','Status'],
  rowsHtml:records.map(record=>`<tr><td>${escapeHtml(record.id)}</td><td>${statusBadge(record.label,{tone:record.tone})}</td></tr>`).join(''),
  caption:'Records',
  footerHtml:paginationMarkup
});
```

Text props (`label`, `value`, `description`, `icon`, headers, caption and status
labels) are escaped. `iconHtml`, `detailHtml`, `rowsHtml`, `contentHtml` and
`footerHtml` are trusted application-rendered slots, never raw API/user HTML.
Class names and tone variants are restricted. `tableMarkup` and `tableFrame`
can compose custom empty states and module-specific scroll/menu containers while
retaining the same table component. Headers have `scope="col"`; captions are
available to assistive technology.

Cards use the reference white surface, left 4px semantic accent, 34px circular
icon, 16px radius, shared shadow, 28px value, 11px uppercase label and 12px
description. Small screens retain the reference 25px value and 16px padding.
Tones are primary, warning, accent, danger and success; modules select the tone
without changing card CSS. A tone classifies a metric and does not by itself
declare an operational alert.

Tables use the reference cream header, 14px header text, 12px cell text, 13×14px
header padding, 15×14px cell padding, white rows, thin dividers and rounded status
badges. Column definitions, module actions, empty states, filters and pagination
remain module-owned. The shared renderer does not impose a fixed row height:
secondary information and accessible action controls can make a row taller.

Adoption in this change: operational overview metrics, the management `table()`
and `badge()` helpers, backup metrics, archive table and activity table. Existing
specialized views may adopt the exported API without duplicating visual CSS.
Backup-specific pastel cards, alternating row fills and blue table headers have
been removed. Backup filtering, polling, schedule, MFA and restore behavior are
preserved.

Verification: `tests/browser/admin-components.mjs` compares computed styles at
1440/768/390px with the operational overview captured before extraction from
commit `aa6564b` in `docs/ui/admin-components-baseline.json`, then checks backup
against the same component. `tests/browser/backup-admin.mjs` covers the backup
workflows and responsive layout. Screenshots use mocked APIs only.
