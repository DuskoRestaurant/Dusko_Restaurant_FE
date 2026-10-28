/** Bodies are plain objects; serialization belongs to the transport only. */
export async function jsonRequest(base,path,{method='GET',body,signal,token,fetcher=fetch}={}) {
  if(typeof body==='string')throw new TypeError('Request body must be an object, not serialized JSON');
  let response;
  try { response=await fetcher(base+path,{method,signal,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}); }
  catch(error){if(error.name==='AbortError')throw error;throw Error('Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.');}
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.success===false){const error=Error(payload?.error||`Không thực hiện được yêu cầu (${response.status})`);error.status=response.status;error.code=payload?.code;throw error;}
  if(!payload)throw Error('Máy chủ trả về dữ liệu không hợp lệ. Hãy thử lại.');
  return payload.data ?? payload;
}
