import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localStamp,validateSelection,validatePublicConfig,backendError,OUTPUT_FILENAME} from '../src/client-core.mjs';
test('technician local date/time captured in browser',()=>{
 const now=new Date(2026,10,16,19,41,15);
 assert.deepEqual(localStamp(now),{date:'2026-11-16',time:'19:41:15'});
});
test('selected file is only preflight checked by size and extension',()=>{
 assert.equal(validateSelection({name:'DATABASE.TXT',size:341234}),null);
 assert.match(validateSelection({name:'FILE.exe',size:341234}),/\.txt/);
 assert.match(validateSelection({name:'file.txt',size:0}),/empty/);
 assert.match(validateSelection({name:'file.txt',size:2*1024*1024}),/limit/);
});
test('only HTTPS same-project backend config accepted',()=>{
 const valid={supabaseUrl:'https://example.supabase.co',backendUrl:'https://example.supabase.co/functions/v1/check-mate?forceFunctionRegion=ap-southeast-2',loginUrl:'https://example.supabase.co/functions/v1/check-mate-login?forceFunctionRegion=ap-southeast-2'};
 assert.equal(validatePublicConfig(valid),true);
 assert.equal(validatePublicConfig({...valid,backendUrl:'http://example.supabase.co/functions/v1/check-mate?forceFunctionRegion=ap-southeast-2'}),false);
 assert.equal(validatePublicConfig({...valid,backendUrl:'https://unknown.example/functions/v1/check-mate'}),false);
 assert.equal(validatePublicConfig({...valid,loginUrl:''}),false);
 assert.equal(validatePublicConfig({...valid,loginUrl:'https://evil.example/login'}),false);
});
test('public error responses are generic; output name fixed',()=>{
 assert.equal(OUTPUT_FILENAME,'database.txt');
 assert.match(backendError(429,'any'),/Usage limit/);
 assert.match(backendError(422,'any'),/not a supported/);
});

test('single password entry replaces email OTP UI',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(html,/id="password" type="password"/);
 assert.doesNotMatch(html,/id="otp"|id="email"|send-code|verify-code/);
 assert.match(main,/fetch\(config\.loginUrl/);
 assert.doesNotMatch(main,/sharedLoginEmail|grant_type=password/);
 assert.doesNotMatch(main,/token\?grant_type=otp|signInWithOtp|authCall\('otp'/);
});
test('shared password is never emitted in browser build configuration',()=>{
 const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 assert.match(build,/CM_LOGIN_URL/);
 assert.doesNotMatch(build,/CM_SHARED_PASSWORD|CM_PASSWORD|ACCESS_PASSWORD|CM_SHARED_LOGIN_EMAIL|CM_PUBLISHABLE_KEY/);
});

test('public code and built site contain no configured private account identity',()=>{
 const files=['src/main.js','src/client-core.mjs','scripts/build.mjs','README.md','SECURITY.md'];
 for(const name of files){
  const source=readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
  assert.doesNotMatch(source,/sharedLoginEmail|CM_SHARED_LOGIN_EMAIL|shared@example\.test|CHECKMATE_LOGIN_EMAIL/);
 }
});

test('site stores anonymous session tokens only, with no auth account fields',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 assert.match(main,/saveSession/);
 assert.match(main,/cm1_\[A-Za-z0-9_-\]/);
 assert.doesNotMatch(main,/access_token|refresh_token|supabaseUrl|publishableKey|token\?grant_type/);
 assert.doesNotMatch(build,/CM_SUPABASE_URL|CM_PUBLISHABLE_KEY|CM_SHARED_LOGIN_EMAIL/);
});
test('preview deployment keeps file-processing controls disabled',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../.github/workflows/ci-pages.yml',import.meta.url),'utf8');
 assert.match(source,/applyButton\.disabled=previewOnly\|\|/);
 assert.match(source,/if\(previewOnly\)\{message\(operationStatus,'Preview only\./);
 assert.match(source,/const previewOnly=configured && config\.previewOnly===true/);
 assert.match(build,/previewOnly:process\.env\.CM_PREVIEW_ONLY==='true'/);
 assert.match(workflow,/vars\.PREVIEW_ENABLED == 'true'/);
 assert.match(workflow,/CM_PREVIEW_ONLY:/);
});

test('DRF is the only public brand identifier',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
 assert.match(html,/Check Mate on the Go \| DRF<\/title>/);
 assert.match(html,/<span class="brand-mark" aria-hidden="true">DRF<\/span>/);
 assert.match(html,/© DRF/);
 assert.doesNotMatch(html,/THE DRILL RIG FILES|The Drill Rig Files|FIELD TECHNICIAN TOOLS/);
 assert.doesNotMatch(readme,/The Drill Rig Files/i);
});
test('compact public page preserves essential controls and removes engineering explanation panels',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 for(const id of ['password','sign-in','database-file','apply','download','signout']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.doesNotMatch(html,/class="information"|class="info-block"|PRIVATE ENGINE|FIELD UTILITY 001|hero-detail/);
 assert.match(css,/max-width:520px/);
 assert.match(css,/\.upload-zone\{margin:12px 16px;padding:15px 12px 11px\}/);
 assert.match(main,/if\(previewOnly\)/);
 assert.match(main,/REV 0\.1 \/ PREVIEW/);
});
