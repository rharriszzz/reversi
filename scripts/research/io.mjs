import { openSync, writeFileSync, fsyncSync, closeSync, renameSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
let profiler=null;
export const instrumentIO=p=>{profiler=p;};
const measured=(name,fn)=>profiler?profiler.measure(name,fn):fn();
export function atomic(path,value) {
  mkdirSync(dirname(path),{recursive:true});const temporary=`${path}.tmp-${process.pid}`;
  const fd=openSync(temporary,'w');
  try {const text=typeof value==='string'?value:measured('json.stringify',()=>JSON.stringify(value));measured('checkpoint.write',()=>writeFileSync(fd,text));measured('checkpoint.fsync',()=>fsyncSync(fd));} finally {closeSync(fd);}
  measured('checkpoint.rename',()=>renameSync(temporary,path));
  // Persist directory entry where supported (Linux/macOS); Windows is optional.
  let directory;try {directory=openSync(dirname(path),'r');measured('checkpoint.directory_fsync',()=>fsyncSync(directory));} catch {} finally {if(directory!==undefined) closeSync(directory);}
}
export function sourceDigest(root) {
  const files=[];
  function visit(path) {for(const d of readdirSync(path,{withFileTypes:true})) {
    if(d.name==='__pycache__') continue;
    const p=resolve(path,d.name);if(d.isDirectory()) visit(p);else if(/\.(js|mjs|py|json|ps1|cpp|h)$/.test(d.name)) files.push(p);
  }}
  for(const dir of ['src','scripts','tests','docs/data']) visit(resolve(root,dir));files.push(resolve(root,'package.json'));
  const hash=createHash('sha256');for(const file of files.sort()) {hash.update(relative(root,file));hash.update(readFileSync(file));}
  return hash.digest('hex');
}
export const seedFor=(seed,name,index=0)=>createHash('sha256').update(`${seed}:${name}:${index}`).digest().readUInt32LE(0);
export const read=path=>{const text=measured('file.read',()=>readFileSync(path,'utf8'));return measured('json.parse',()=>JSON.parse(text));};
