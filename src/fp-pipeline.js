import { escapeHtml as e } from './api.js';
import './fp-pipeline.css';
export async function mountFpPipeline(root, api, branchId) {
  let dataset = null, result = null, page = 0, busy = false;
  const today = new Date(Date.now()+7*3600000).toISOString().slice(0,10);
  let from = new Date(Date.parse(today)-59*86400000).toISOString().slice(0,10), to = today, message = '';
  const table = (headers, rows) => `<div class="fp-scroll"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(c=>`<tr>${c.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  function draw() {
    if (!root.isConnected) return;
    const rows = dataset?.rows.slice(page*20,(page+1)*20) || [];
    const names = ids => ids.map(id=>e(dataset.columns.find(c=>String(c.id)===String(id))?.name || id)).join(' + ');
    root.innerHTML = `<div class="fp-pipeline"><header><span>THỰC HÀNH DỮ LIỆU · NODE.JS</span><h1>Từ hóa đơn đến gợi ý món</h1><p>PostgreSQL → Node.js tinh chế → MongoDB lưu ma trận 0/1 → FP-Growth</p></header>
      <section class="panel"><form id="fp-form"><label>Từ ngày<input type="date" name="from" required value="${e(from)}" ${busy?'disabled':''}></label><label>Đến ngày<input type="date" name="to" required value="${e(to)}" ${busy?'disabled':''}></label><button class="btn primary" ${busy?'disabled':''}>1. Đọc SQL và lưu ma trận</button><button type="button" class="btn secondary" id="fp-mine" ${busy||!dataset?'disabled':''}>2. Đọc MongoDB và chạy FP-Growth</button></form><p role="status" aria-live="polite">${e(message)}</p><p>Chỉ lấy đơn đã thanh toán, ngày theo UTC+7. Số lượng nhiều suất vẫn được mã hóa thành 1. Thao tác tạo bộ dữ liệu mới, không sửa hóa đơn.</p></section>
      ${dataset?`<div class="fp-summary"><strong>${dataset.rows.length} hóa đơn</strong><strong>${dataset.columns.length} cột món</strong></div><p>Bộ dữ liệu MongoDB: <code>${e(dataset._id)}</code> · Ngày bán ${e(dataset.from)} → ${e(dataset.to)} · Bỏ ${dataset.emptyOrders} hóa đơn rỗng</p>`:''}
      <section class="panel"><h2>1. Dữ liệu gốc từ PostgreSQL</h2><p>Mỗi hóa đơn có các dòng món và số lượng; đây là bản chụp tại lúc tinh chế.</p>${dataset?table(['Hóa đơn','Nguồn','Món × số lượng'],rows.map(r=>[e(r.orderCode || r.orderId),e(r.origin),r.raw.map(i=>`${names([i.productId])} × ${i.quantity}`).join('<br>')])):'<p>Chọn khoảng ngày rồi nhấn “Đọc SQL và lưu ma trận”.</p>'}</section>
      <section class="panel"><h2>2. Dữ liệu tinh chế đã đọc từ MongoDB</h2><p>Mỗi dòng là một hóa đơn, mỗi cột là một mã món. <b>1 = có món</b>, 0 = không có. Kéo ngang để xem các cột.</p>${dataset?table(['Hóa đơn',...dataset.columns.map(c=>`${e(c.name)}<br><small>ID ${c.id}</small>`)],rows.map(r=>[e(r.orderCode || r.orderId),...r.bits.map(b=>`<span class="fp-bit ${b?'one':''}">${b}</span>`)])):'<p>Chưa có bộ dữ liệu.</p>'}
      ${dataset?`<div class="fp-pager"><button id="fp-prev" class="btn secondary" ${page===0||busy?'disabled':''}>Trang trước</button><span>Trang ${page+1}/${Math.ceil(dataset.rows.length/20)} · 20 hóa đơn/trang cho cả hai bảng</span><button id="fp-next" class="btn secondary" ${(page+1)*20>=dataset.rows.length||busy?'disabled':''}>Trang sau</button></div>`:''}</section>
      <section class="panel"><h2>3. Kết quả FP-Growth</h2><p>Ngưỡng: support 5% · confidence 30% · lift 1,2 · tối đa 3 món/tập. Engine lấy mã món ở các cột bằng 1 để dựng cây FP-tree.</p>${result?`<p><b>${result.patternCount} tập phổ biến · ${result.ruleCount} luật</b> · ${result.elapsedMs.toFixed(1)} ms khai phá, chưa tính thời gian đọc MongoDB.</p><p>Nguồn: ${e(result.source)} · Bộ dữ liệu ${e(result.datasetId)}. Hiển thị tối đa 100 tập và 100 luật.</p><h3>Nhóm món phổ biến</h3>${table(['Nhóm món','Số giỏ','Support'],result.patterns.map(p=>[names(p.items),p.supportCount,(p.support*100).toFixed(2)+'%']))}<h3>Luật gợi ý</h3>${table(['Đã chọn','Gợi ý thêm','Support','Confidence','Lift'],result.rules.map(r=>[names(r.antecedents),names(r.consequents),(r.support*100).toFixed(2)+'%',(r.confidence*100).toFixed(2)+'%',r.lift.toFixed(3)]))}${result.ruleCount?'':'<p>Không có luật đạt ngưỡng.</p>'}`:'<p>Sau khi có ma trận, nhấn “Đọc MongoDB và chạy FP-Growth”.</p>'}<p>Confidence là tỷ lệ trong lịch sử, không phải độ chính xác dự đoán khách sẽ mua. Nhãn nguồn giữ nguyên như database.</p></section></div>`;
    root.querySelector('#fp-form').onsubmit = event => { event.preventDefault(); const form=new FormData(event.target); from=form.get('from'); to=form.get('to'); run('refine'); };
    root.querySelector('#fp-mine').onclick = ()=>run('mine');
    root.querySelector('#fp-prev')?.addEventListener('click',()=>{page--;draw();});
    root.querySelector('#fp-next')?.addEventListener('click',()=>{page++;draw();});
  }
  async function run(action) {
    if (busy) return;
    busy=true; message=action==='refine'?'Đang đọc PostgreSQL và lưu MongoDB…':'Đang đọc ma trận từ MongoDB và khai phá…'; draw();
    try {
      const data=await api(`/api/fp-pipeline/${action}`,{method:'POST',body:action==='refine'?{branchId,from,to}:{branchId,datasetId:dataset._id}});
      if(action==='refine'){dataset=data.dataset;page=0;result=null;}else result=data;
      message=action==='refine'?'Đã lưu và đọc lại bộ dữ liệu từ MongoDB.':'Đã khai phá xong từ bộ dữ liệu MongoDB.';
    } catch(err){message=`Không hoàn tất: ${err.message}`;} finally {busy=false;draw();}
  }
  busy=true; message='Đang tìm bộ dữ liệu đã lưu của chi nhánh…'; draw();
  try { const data=await api(`/api/fp-pipeline?branchId=${branchId}`);dataset=data.dataset;if(dataset){from=dataset.from;to=dataset.to;}message=dataset?'Đã tải bộ dữ liệu gần nhất từ MongoDB.':'Chưa có dữ liệu tinh chế. Hãy chọn ngày và tạo bộ dữ liệu.'; }
  catch(err){message=`Không kết nối được: ${err.message}`;}finally{busy=false;draw();}
}
