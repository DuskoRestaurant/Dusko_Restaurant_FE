import './qr-preview.css';

export function showQrPreview({svg, tableName, branchName, url}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'qr-preview';
  dialog.setAttribute('aria-labelledby', 'qr-preview-title');
  dialog.innerHTML = `<button type="button" class="qr-preview-close" aria-label="Đóng">×</button><h2 id="qr-preview-title"></h2><p class="qr-preview-branch"></p><img class="qr-preview-image" alt="Mã QR gọi món của bàn"><p>Dùng camera điện thoại quét mã để mở thực đơn của bàn.</p><div class="qr-preview-actions"><a class="qr-preview-open" target="_blank" rel="noopener">Mở thực đơn</a><a class="qr-preview-download">Tải mã QR</a></div>`;
  dialog.querySelector('h2').textContent = `QR · ${tableName}`;
  dialog.querySelector('.qr-preview-branch').textContent = branchName;
  const imageUrl = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml'}));
  dialog.querySelector('img').src = imageUrl;
  const download = dialog.querySelector('.qr-preview-download');
  download.href = imageUrl;
  download.download = `QR-${String(tableName).replace(/[^\p{L}\p{N}-]+/gu,'-')}.svg`;
  const menu = new URL(url);
  if (!['http:', 'https:'].includes(menu.protocol)) throw Error('Đường dẫn thực đơn không hợp lệ');
  dialog.querySelector('.qr-preview-open').href = menu.href;
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('click', event => { if(event.target === dialog) { const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close(); } });
  dialog.addEventListener('close', () => { URL.revokeObjectURL(imageUrl); dialog.remove(); }, {once:true});
  document.body.append(dialog);
  dialog.showModal();
}
