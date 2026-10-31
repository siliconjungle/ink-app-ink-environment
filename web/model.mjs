export const starter={id:'starter',name:'Start · transform a list',entry:'transform',source:'module my_program;\n\nfn transform(xs: List<u32>, scale: u32) -> List<u32> {\n    return xs.map(fn(x) => x * scale);\n}\n',input:'[[1, 2, 3, 5, 8], 3]'};
export function sourceText(text){if(typeof text!=='string')throw Error('The file does not contain text');if(new TextEncoder().encode(text).length>100000)throw Error('Keep Ink source below 100 KB');if(text.includes('\0'))throw Error('This looks like a binary file. Choose an Ink source file.');return text;}
export function inkName(value){const name=String(value||'').trim().split(/[\\/]/).at(-1);if(!name)throw Error('Enter a file name');return name.toLowerCase().endsWith('.ink')?name:name+'.ink';}
export function baseRevision(file,text,draft,marker,source){return draft===text?file.revision:marker?.revision||source?.revision||file.revision;}
export function settings(value={}){return{input:typeof value.input==='string'?value.input:starter.input,entry:typeof value.entry==='string'?value.entry:starter.entry,example:typeof value.example==='string'?value.example:starter.id,backend:value.backend==='gpu'?'gpu':'javascript'};}

export function selectEntry(preferred,entries){return entries.includes(preferred)?preferred:entries.find(entry=>!entry.startsWith('@'))||entries[0]||'';}
