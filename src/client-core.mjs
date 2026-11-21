/** Public-only logic. NO checksum engine, constants or format-specific parsing. */
export const MAX_INPUT_BYTES=1024*1024;
export const OUTPUT_FILENAME='database.txt';
export function localStamp(now=new Date()) {
  if(!(now instanceof Date)||Number.isNaN(now.valueOf())) throw Error('Device clock unavailable.');
  const p=n=>String(n).padStart(2,'0');
  return {
    date:`${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}`,
    time:`${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`,
  };
}
export function validateSelection(file) {
  if(!file||typeof file.size!=='number'||typeof file.name!=='string') return 'Select a database file.';
  if(!/\.txt$/i.test(file.name)) return 'Select a .txt database file.';
  if(file.size===0) return 'The selected file is empty.';
  if(file.size>MAX_INPUT_BYTES) return 'File exceeds the 1 MB limit.';
  return null;
}
export function validatePublicConfig(config){
  if(!config||typeof config!=='object') return false;
  try {
    const backend=new URL(config.backendUrl);
    const login=new URL(config.loginUrl);
    return backend.protocol==='https:'&&backend.hostname.endsWith('.supabase.co')
      &&backend.pathname==='/functions/v1/check-mate' && backend.searchParams.get('forceFunctionRegion')==='ap-southeast-2'
      &&login.protocol==='https:'&&login.hostname===backend.hostname
      &&login.pathname==='/functions/v1/check-mate-login' && login.searchParams.get('forceFunctionRegion')==='ap-southeast-2';
  } catch{return false;}
}
export function backendError(status,code){
  if(status===401) return 'Your session expired. Please sign in again.';
  if(status===403) return 'This account is not approved for Check Mate.';
  if(status===429) return 'Usage limit reached. Please try again later.';
  if(status===413) return 'File exceeds the service size limit.';
  if(status===415||status===422) return 'This file is not a supported or valid database.';
  if(status===503) return 'The private service is temporarily unavailable.';
  return 'The file could not be validated. No download was produced.';
}