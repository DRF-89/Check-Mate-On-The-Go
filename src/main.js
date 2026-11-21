import {localStamp,validateSelection,validatePublicConfig,OUTPUT_FILENAME,backendError} from './client-core.mjs';

const config=window.CHECKMATE_CONFIG||null;
const configured=validatePublicConfig(config);
const previewOnly=configured && config.previewOnly===true;
const $=selector=>document.querySelector(selector);
if(previewOnly){
  const releaseTag=$('.release-tag');
  if(releaseTag) releaseTag.textContent='REV 0.1 / PREVIEW';
}
const loginPanel=$('#login-panel');
const toolPanel=$('#tool-panel');
const passwordInput=$('#password');
const signInStatus=$('#signin-status');
const signinForm=$('#password-form');
const selectedFile=$('#selected-file');
const fileInput=$('#database-file');
const applyButton=$('#apply');
const success=$('#success');
const download=$('#download');
const operationStatus=$('#operation-status');
let session=null;
let objectUrl=null;
let processing=false;

function message(element,text,tone='neutral') {
  element.textContent=text;
  element.dataset.tone=tone;
}
function setBusy(busy){
  processing=busy;
  applyButton.disabled=previewOnly||busy||Boolean(validateSelection(fileInput.files?.[0]));
  fileInput.disabled=busy;
}
function clearDownload(){
  if(objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl=null;
  success.hidden=true;
  download.removeAttribute('href');
}
function storeSession(value){
  session=value;
  if(value) sessionStorage.setItem('checkmate_session',JSON.stringify(value));
  else sessionStorage.removeItem('checkmate_session');
  loginPanel.hidden=Boolean(value);
  toolPanel.hidden=!value;
  if(!value){clearDownload();fileInput.value='';}
}
function saveSession(data){
  if(!data||!/^cm1_[A-Za-z0-9_-]{43}$/.test(data.token||'')||data.expires_in!==28800)
    throw new Error('No valid access session returned.');
  storeSession({token:data.token,expires_at:Date.now()+data.expires_in*1000});
}
function accessToken(){
  if(!session?.token||session.expires_at<=Date.now()+30_000){
    storeSession(null);
    throw new Error('Session expired. Please sign in again.');
  }
  return session.token;
}

signinForm.addEventListener('submit',async(event)=>{
  event.preventDefault();
  if(!configured || processing) return;
  const secret=passwordInput.value;
  if(!secret){message(signInStatus,'Enter the access password.','error');return;}
  $('#sign-in').disabled=true;
  message(signInStatus,'Checking access…');
  try {
    // Credentials go only to the protected login endpoint; no account identifier in browser code.
    const response=await fetch(config.loginUrl,{
      method:'POST',mode:'cors',cache:'no-store',redirect:'error',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({password:secret}),
    });
    if(!response.ok) throw Error('Access denied. Check the password or contact the tool owner.');
    saveSession(await response.json());
    message(operationStatus,previewOnly?'Preview only. File processing is disabled.':'Signed in. Select your modified database.');
    message(signInStatus,'');
  }catch{
    message(signInStatus,'Access denied. Check the password or contact the tool owner.','error');
  }finally{
    passwordInput.value='';
    $('#sign-in').disabled=false;
  }
});
$('#signout').addEventListener('click',async()=>{
  const old=session;
  storeSession(null);
  message(signInStatus,'Signed out.');
  // Best-effort revocation. Never block sign-out on server availability.
  if(old?.token) fetch(config.backendUrl,{
    method:'DELETE',mode:'cors',cache:'no-store',redirect:'error',
    headers:{Authorization:`Bearer ${old.token}`},
  }).catch(()=>{});
});

fileInput.addEventListener('change',()=>{
  clearDownload();
  const file=fileInput.files?.[0];
  selectedFile.textContent=file?file.name:'No file selected';
  const error=validateSelection(file);
  message(operationStatus,error||(previewOnly?'Preview only. The selected file stays on this device.':'File ready. Press Apply Checksum.'),error?'error':'neutral');
  applyButton.disabled=previewOnly||Boolean(error)||processing;
});
$('#apply-form').addEventListener('submit',async(event)=>{
  event.preventDefault();
  if(previewOnly){message(operationStatus,'Preview only. File processing is disabled.');return;}
  const file=fileInput.files?.[0];
  const selectionError=validateSelection(file);
  if(selectionError){message(operationStatus,selectionError,'error');return;}
  clearDownload();setBusy(true);
  message(operationStatus,'Processing securely. Validating result…');
  try {
    const token=accessToken();
    const stamp=localStamp();
    const response=await fetch(config.backendUrl,{
      method:'POST',mode:'cors',cache:'no-store',redirect:'error',
      headers:{
        Authorization:`Bearer ${token}`,
        'Content-Type':'application/octet-stream',
        'X-CM-Local-Date':stamp.date,
        'X-CM-Local-Time':stamp.time,
      },
      body:file, // raw bytes go ONLY to the authenticated private backend.
    });
    if(!response.ok){
      const code=(await response.json().catch(()=>({}))).error;
      throw new Error(backendError(response.status,code));
    }
    if(response.headers.get('X-CM-Validated')!=='true') throw new Error('Private service did not confirm validation.');
    const output=await response.blob();
    if(!output.size) throw new Error('Private service returned an empty file.');
    objectUrl=URL.createObjectURL(output);
    download.href=objectUrl;
    download.download=OUTPUT_FILENAME;
    success.hidden=false;
    message(operationStatus,'Validated. Your corrected file is ready.','success');
  }catch(err){message(operationStatus,err?.message||'Unable to process this file.','error');}
  finally{setBusy(false);}
});

if(configured){
  try {
    const saved=JSON.parse(sessionStorage.getItem('checkmate_session')||'null');
    if(/^cm1_[A-Za-z0-9_-]{43}$/.test(saved?.token||'')&&Number.isFinite(saved?.expires_at)&&saved.expires_at>Date.now()+30_000){
      storeSession(saved);message(operationStatus,previewOnly?'Preview only. File processing is disabled.':'Signed in. Select your modified database.');
    }else storeSession(null);
  }catch{storeSession(null);}
}else{
  storeSession(null);
  passwordInput.disabled=true;
  $('#sign-in').disabled=true;
  message(signInStatus,'Preview only. Private service is not configured yet.','error');
}
window.addEventListener('pagehide',clearDownload);