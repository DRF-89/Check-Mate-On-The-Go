import {mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=resolve(root,'dist');
await rm(dist,{recursive:true,force:true});
await mkdir(resolve(dist,'src'),{recursive:true});
for(const file of ['index.html','styles.css','src/main.js','src/client-core.mjs']){
 await copyFile(resolve(root,file),resolve(dist,file));
}
// These values are PUBLIC browser configuration, not service-role secrets.
const settings={
  backendUrl:process.env.CM_BACKEND_URL||'',
  loginUrl:process.env.CM_LOGIN_URL||'',
  previewOnly:process.env.CM_PREVIEW_ONLY==='true',
};
await writeFile(resolve(dist,'config.js'),`window.CHECKMATE_CONFIG = ${JSON.stringify(settings)};\n`);
console.log('Public-only website prepared. No checksum implementation included.');