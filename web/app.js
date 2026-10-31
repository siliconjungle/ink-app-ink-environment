import{mountEnvironment,examples}from'./environment/index.js';
import{starter,sourceText,inkName,baseRevision,settings,selectEntry}from'./model.mjs';
import{textDiff,moveTextOffset,textInputEdit}from'./text-diff.mjs';
const $=id=>document.getElementById(id),root=$('environment'),types=['.ink','text/x-ink','application/x-ink','code'];
let ink,state,doc,unsubscribe,engine,options,source,input,entry,example,backend,file=null,original='',revision=0,busy=false,opening=0,contextId=null,applying=false,range,observer;
const message=text=>$('notice').textContent=text||'';
const dirty=()=>!!source&&source.value!==original;
const preferenceKey=key=>'/programs/'+key;
function currentSettings(){return{input:input.value,entry:entry.disabled?options.initialEntry||starter.entry:entry.value,example:example.value,backend:backend.value};}
function metadata(){
 $('filename').textContent=file?.source||file?.title||'Untitled.ink';$('dirty').hidden=!dirty();
 $('save').disabled=busy||!source||!ink||!!file&&!dirty();$('save-as').disabled=busy||!source||!ink;$('open').disabled=busy||!ink;$('file-input').disabled=busy;$('new').disabled=busy;$('download').disabled=!source;
 if($('env-run')?.disabled&&$('env-stop')?.disabled)for(const id of['env-download-js','env-download-rust','env-download-result'])$(id).disabled=true;
 if(entry&&!entry.disabled){const selected=selectEntry(options.initialEntry,[...entry.options].map(option=>option.value));if(selected!==options.initialEntry){options.initialEntry=selected;entry.value=selected;entry.dispatchEvent(new Event('change'));persistSettings();}}
 const status=doc?.status;$('sync').textContent=!ink?'Browser draft':busy?'Opening…':status?.status==='offline'?'Draft saved locally':status?.pending?'Syncing draft…':dirty()?'Draft saved':file?'Saved in Ink OS':'New program';
}
function renderDrafts(){const selected=$('drafts').value;$('drafts').replaceChildren(new Option('Drafts',''));const drafts=state?.get('/drafts',{})||{};for(const[id,value]of Object.entries(drafts).sort((a,b)=>b[1].created-a[1].created))$('drafts').append(new Option(value.name||'Untitled.ink',id));$('drafts').value=selected;$('drafts').hidden=!Object.keys(drafts).length;}
function backup(){if(!source)return;try{localStorage.setItem('ink-environment-backup:'+(doc?.key||'standalone'),JSON.stringify({source:source.value,...currentSettings()}));}catch{}}
function sourceChanged(){if(applying)return;backup();if(doc&&!source.readOnly){try{const before=range;range=null;const edit=before&&before.text===doc.text?textInputEdit(before.text,source.value,before.start,before.end,before.type):null;void(edit?doc.splice(edit.index,edit.remove,edit.text):doc.replace(source.value)).catch(error=>message(error.message));}catch(error){message(error.message);}}metadata();}
function applySettings(){if(!state||!doc||!source)return;const config=settings(state.get(preferenceKey(doc.key))||(file?{input:'[]',entry:''}:undefined));applying=true;if(input.value!==config.input){input.value=config.input;input.dispatchEvent(new Event('input'));}options.initialEntry=config.entry;if([...entry.options].some(option=>option.value===config.entry)&&entry.value!==config.entry){entry.value=config.entry;entry.dispatchEvent(new Event('change'));}if([...example.options].some(option=>option.value===config.example))example.value=config.example;backend.value=config.backend;applying=false;}
function persistSettings(){backup();if(state&&doc&&!applying){if(!entry.disabled)options.initialEntry=entry.value||options.initialEntry;void state.set(preferenceKey(doc.key),currentSettings()).catch(error=>message(error.message));}}
function applyText(text){if(!source||source.value===text)return;if(!$('env-stop').disabled)$('env-stop').click();const edit=textDiff(source.value,text),start=moveTextOffset(source.selectionStart,edit),end=moveTextOffset(source.selectionEnd,edit),scroll=source.scrollTop;applying=true;source.value=text;source.dispatchEvent(new Event('input'));source.setSelectionRange(start,end);source.scrollTop=scroll;applying=false;metadata();}
function mount(text,config){
 observer?.disconnect();engine?.dispose();options={compilerUrl:new URL('ink-compiler.wasm',location.href).href,initialSource:text,initialInput:config.input,initialEntry:config.entry,initialExample:config.example===starter.id?undefined:config.example};engine=mountEnvironment(root,options);
 source=$('env-source');input=$('env-input');entry=$('env-entry');example=$('env-example');backend=$('env-backend');backend.value=config.backend;
 // Keep the original editor's execution controls and collapse its secondary evidence panels.
 const details=document.createElement('details');details.className='insights';const summary=document.createElement('summary');summary.textContent='Execution & timings';details.append(summary,root.querySelector('.env-placement'),root.querySelector('.env-performance'));root.querySelector('.env-grid').after(details);
 const custom=new Option(starter.name,starter.id);example.prepend(custom);example.value=config.example;source.setAttribute('aria-label','Ink source');input.setAttribute('aria-label','Input JSON');backend.setAttribute('aria-label','Execution target');
 source.addEventListener('beforeinput',event=>range={text:source.value,start:source.selectionStart,end:source.selectionEnd,type:event.inputType});source.addEventListener('input',sourceChanged);
 input.addEventListener('input',persistSettings);entry.addEventListener('change',persistSettings);backend.addEventListener('change',persistSettings);
 // The site editor owns the built-in examples. The app adds a small first program.
 const loadExample=example.onchange;example.onchange=event=>{if(example.value===starter.id){const choice=examples[0].id;example.value=choice;loadExample.call(example,event);source.value=starter.source;input.value=starter.input;example.value=starter.id;source.dispatchEvent(new Event('input'));options.initialEntry=starter.entry;}else{loadExample.call(example,event);options.initialEntry=examples.find(item=>item.id===example.value)?.entry;}range=null;sourceChanged();persistSettings();};
 observer=new MutationObserver(()=>{if(!applying)metadata();});observer.observe($('env-status'),{childList:true,subtree:true});metadata();
}
async function setRoute(id){contextId=id||null;await ink.request('desktop.route',{route:{app:'ink-environment',...(id?{id}:{})}});}
async function bind(next,nextFile,text,updateRoute){
 const previous=doc;unsubscribe?.();doc=next;file=nextFile;original=text;revision=nextFile?baseRevision(nextFile,text,next.text,state.get('/fileBases/'+nextFile.id),next.source):0;
 mount(next.text,settings(state.get(preferenceKey(next.key))||(nextFile?{input:'[]',entry:''}:undefined)));
 unsubscribe=next.subscribe(event=>{if(doc!==next)return;if(event.type==='change'&&!event.local)applyText(next.text);if(event.type==='status'&&event.error){backup();message(event.error);}metadata();});
 void previous?.close();if(updateRoute)await setRoute(file?.id);renderDrafts();metadata();
}
async function openFile(target,{updateRoute=true}={}){
 if(!target)return;const generation=++opening;busy=true;metadata();message();
 try{const result=await ink.files.readText(target.id),text=sourceText(result.text),next=await ink.text.open('ink:file:'+target.id,{seedFile:target.id});if(generation!==opening){await next.close();return;}await bind(next,result.object,text,updateRoute);if(revision!==file.revision)message('The saved file changed. Save As keeps your shared draft.');}
 catch(error){if(generation===opening)message(error.message);}finally{if(generation===opening){busy=false;metadata();}}
}
async function fresh({recover=false,id}={}){
 if(!ink){engine?.dispose();file=null;original='';mount(starter.source,settings());message();return;}
 const generation=++opening;busy=true;metadata();message();
 try{const key='/draftKeys/'+ink.instance;let identity=id||(recover?state.get(key):null),created=!identity;if(!identity)identity=crypto.randomUUID();await state.set(key,identity);const next=await ink.text.open('ink:draft:'+identity);if(generation!==opening){await next.close();return;}if(created){await next.replace(starter.source);await state.set('/drafts/'+identity,{name:'Untitled · '+new Date().toLocaleString(),created:Date.now()});}await bind(next,null,'',true);}
 catch(error){if(generation===opening)message(error.message);}finally{if(generation===opening){busy=false;metadata();}}
}
async function save(){if(!ink||!source)return;if(!file){saveAs();return;}if(busy)return;busy=true;metadata();const current=doc,id=file.id;
 try{await current.flush();const sent=sourceText(current.text),saved=await ink.files.saveText(id,sent,revision);await state.set('/fileBases/'+id,{revision:saved.revision});if(current===doc){file=saved;revision=saved.revision;original=sent;message('Saved to Ink OS.');}}
 catch(error){message(error.status===409?'The saved file changed. Your draft is kept. Use Save As to keep both versions.':error.message);}finally{busy=false;metadata();}
}
function saveAs(){if(!source||!ink)return;$('save-error').hidden=true;$('save-name').value=file?.source||file?.title||'Untitled.ink';$('save-dialog').showModal();$('save-name').select();}
$('save-form').onsubmit=async event=>{event.preventDefault();if(busy||!doc)return;busy=true;metadata();const current=doc;
 try{const name=inkName($('save-name').value);await current.flush();const sent=sourceText(current.text),config=currentSettings(),saved=await ink.files.createText(name,sent);if(current!==doc)return;const next=await ink.text.open('ink:file:'+saved.id,{seedFile:saved.id});if(current!==doc){await next.close();return;}const latest=current.text;await state.set(preferenceKey(next.key),config);await state.set('/fileBases/'+saved.id,{revision:saved.revision});await bind(next,saved,sent,true);if(latest!==sent){await next.replace(latest);applyText(latest);}if(current.key.startsWith('ink:draft:'))await state.delete('/drafts/'+current.key.slice('ink:draft:'.length));$('save-dialog').close();message('Saved to Ink OS.');}
 catch(error){$('save-error').hidden=false;$('save-error').textContent=error.message;}finally{busy=false;metadata();renderDrafts();}
};
$('new').onclick=()=>void fresh();$('open').onclick=async()=>{try{const picked=await ink.files.pick({multiple:false});if(picked[0])await openFile(picked[0]);}catch(error){message(error.message);}};$('file-input').onchange=async()=>{try{if(!ink){const chosen=$('file-input').files[0];if(!chosen)return;const text=sourceText(await chosen.text());file={source:chosen.name,title:chosen.name};original=text;mount(text,settings({input:'[]',entry:''}));message('Imported into this browser draft. Download source to keep changes.');return;}const files=await ink.files.upload($('file-input').files);if(files[0])await openFile(files[0]);}catch(error){message(error.message);}finally{$('file-input').value='';}};$('save').onclick=()=>void save();$('save-as').onclick=saveAs;$('cancel-save').onclick=()=>$('save-dialog').close();$('drafts').onchange=()=>{const id=$('drafts').value;if(id)void fresh({id});};
$('download').onclick=()=>{if(!source)return;const url=URL.createObjectURL(new Blob([source.value],{type:'text/plain'})),link=document.createElement('a');link.href=url;link.download=inkName(file?.source||file?.title||'Untitled.ink');link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();event.stopImmediatePropagation();event.shiftKey?saveAs():void save();}},{capture:true});addEventListener('pagehide',backup);
let refreshing=false;
async function refreshFile(){if(refreshing||busy||!file)return;refreshing=true;const current=doc,id=file.id;
 try{const result=await ink.files.readText(id);if(doc!==current||result.object.revision===revision)return;const marker=state.get('/fileBases/'+id);if(marker?.revision===result.object.revision||current.text===original||current.text===result.text){if(current.text===original&&current.text!==result.text)await current.replace(sourceText(result.text));file=result.object;original=result.text;revision=file.revision;applyText(current.text);metadata();}else message('The saved file changed. Your shared draft is kept; Save As preserves both.');}
 catch(error){if(doc===current)message(error.status===404?'This file was deleted. Save As keeps your draft.':error.message);}finally{refreshing=false;}
}
try{
 if(parent===window){let config=settings(),text=starter.source;try{const backup=JSON.parse(localStorage.getItem('ink-environment-backup:standalone')||'null');if(backup){text=backup.source;config=settings(backup);}}catch{}mount(text,config);$('drafts').hidden=true;metadata();}
 else{ink=await Ink.connect();await ink.request('desktop.features',{inlineRoute:true});state=await ink.state.open();await ink.files.acceptDrops(types,files=>void openFile(files[0])).ready;ink.on('context',value=>{if(!Object.hasOwn(value,'route'))return;const id=value.route?.id||null;if(id===contextId)return;contextId=id;if(id&&id!==ink.snapshot.namespace)void openFile({id},{updateRoute:false});else void fresh({recover:true});});ink.on('world.delta',event=>{if(file&&(event.objects?.some(object=>object.id===file.id)||event.removed?.includes(file.id)))void refreshFile();});state.subscribe(event=>{if(event.type!=='change')return;renderDrafts();if(!event.local)applySettings();if(file)void refreshFile();});contextId=ink.route.id||null;if(contextId&&contextId!==ink.snapshot.namespace)await openFile({id:contextId},{updateRoute:false});else await fresh({recover:true});ink.ready();metadata();}
}catch(error){message(error.message);metadata();}
