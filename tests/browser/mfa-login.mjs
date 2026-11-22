import {createRequire} from 'node:module';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const server=await createServer({server:{host:'127.0.0.1',port:0},plugins:[{name:'mfa-test-page',configureServer(s){s.middlewares.use('/mfa-test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<html><body></body></html>');});}}]});
let browser;
try{
 await server.listen();browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 const page=await browser.newPage();
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/mfa-test`);
 async function start(mode){
  await page.evaluate(async mode=>{
   localStorage.clear();window.calls=[];window.progress=[];window.result=null;
   const {authenticatorLogin}=await import('/src/mfa-login.js');
   const request=async(path,options)=>{
    window.calls.push({path,body:options.body});
    if(path==='/api/auth/login'){
     if(mode==='enrollment'&&!options.body.enrollmentToken)return {mfaRequired:true,enrollmentRequired:true,setupRequired:false};
     if(mode==='enrollment'&&options.body.enrollmentToken==='b'.repeat(64))throw Error('Mã cấp quyền không hợp lệ');
     return {mfaRequired:true,setupRequired:mode==='enrollment',challengeToken:'challenge'};
    }
    if(path==='/api/auth/mfa/setup')return {secret:'TESTSECRET',qrDataUrl:'data:image/png;base64,'};
    if(path==='/api/auth/mfa/verify')return {token:'verified-session',user:{id:1},...(mode==='enrollment'?{recoveryCodes:['ABCD-1234-ABCD-1234']}:{} )};
    throw Error('Unexpected request '+path);
   };
   window.login=authenticatorLogin(request,'admin','password',value=>window.progress.push(value)).then(result=>{window.result=result;},error=>{window.result={error:error.message};});
  },mode);
 }
 await start('verify');
 await page.getByRole('heading',{name:'Xác thực hai bước',exact:true}).waitFor();
 assert.equal(await page.locator('dialog img').count(),0);
 await page.locator('input[name=code]').fill('123456');await page.locator('form button[type=submit]').click();
 await page.waitForFunction(()=>window.result?.token);
 assert.equal(await page.evaluate(()=>window.calls.some(c=>c.path.endsWith('/setup'))),false);
 await start('verify');
 await page.getByRole('button',{name:'Mất Authenticator? Dùng mã khôi phục'}).click();
 await page.locator('[data-recovery-help]:visible').waitFor();
 assert.match(await page.locator('[data-recovery-help]').innerText(),/xác minh danh tính/);
 assert.equal(await page.locator('input[name=trustDevice]').isDisabled(),true);
 await page.locator('input[name=code]').fill('ABCD-1234-ABCD-1234');
 await page.locator('form button[type=submit]').click();await page.waitForFunction(()=>window.result?.token);
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1).body),{challengeToken:'challenge',code:'ABCD-1234-ABCD-1234',trustDevice:false});
 await start('enrollment');
 await page.getByRole('heading',{name:'Cấp quyền thiết lập Authenticator'}).waitFor();
 assert.equal(await page.locator('dialog img').count(),0);
 assert.equal(await page.evaluate(()=>window.calls.length),1);
 await page.locator('input[name=enrollmentToken]').fill('b'.repeat(64));await page.locator('form button').click();
 await page.getByRole('status').filter({hasText:'Mã cấp quyền không hợp lệ'}).waitFor();
 assert.equal(await page.locator('dialog img').count(),0);
 await page.locator('input[name=enrollmentToken]').fill('a'.repeat(64));await page.locator('form button').click();
 await page.getByRole('heading',{name:'Thiết lập Authenticator',exact:true}).waitFor();
 assert.equal(await page.locator('dialog img').count(),1);
 await page.locator('input[name=code]').fill('123456');await page.locator('form button[type=submit]').click();
 await page.getByRole('heading',{name:'Lưu mã khôi phục'}).waitFor();
 assert.equal(await page.evaluate(()=>window.result),null);
 await page.locator('.mfa-ack input').check();await page.getByRole('button',{name:'Tiếp tục vào hệ thống'}).click();
 await page.waitForFunction(()=>window.result?.token);
 await start('enrollment');await page.getByRole('heading',{name:'Cấp quyền thiết lập Authenticator'}).waitFor();
 await page.getByRole('button',{name:'Đóng',exact:true}).click();await page.waitForFunction(()=>window.result?.error);
 assert.equal(await page.evaluate(()=>window.calls.length),1);
 assert.equal(await page.locator('dialog').count(),0);
 console.log('Passed: existing MFA has no QR; enrollment needs separate code; errors, recovery acknowledgment and cancellation work.');
}finally{await browser?.close();await server.close();}
