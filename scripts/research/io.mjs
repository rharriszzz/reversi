import { openSync, writeFileSync, fsyncSync, closeSync, renameSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
export function atomic(path,value) {
  mkdirSync(dirname(path),{recursive:true});const temporary=`${path}.tmp-${process.pid}`;
  const fd=openSync(temporary,'w');
  try {writeFileSync(fd,typeof value==='string'?value:JSON.stringify(value));fsyncSync(fd);} finally {closeSync(fd);}
  renameSync(temporary,path);
  // Persist directory entry where supported (Linux/macOS); Windows is optional.
  let directory;try {directory=openSync(dirname(path),'r');fsyncSync(directory);} catch {} finally {if(directory!==undefined) closeSync(directory);}
}
export function sourceDigest(root) {
  const files=[];
  function visit(path) {for(const d of readdirSync(path,{withFileTypes:true})) {
    if(d.name==='__pycache__') continue;
    const p=resolve(path,d.name);if(d.isDirectory()) visit(p);else if(/\.(js|mjs|py|json)$/.test(d.name)) files.push(p);
  }}
  for(const dir of ['src','scripts','tests','docs/data']) visit(resolve(root,dir));files.push(resolve(root,'package.json'));
  const hash=createHash('sha256');for(const file of files.sort()) {hash.update(relative(root,file));hash.update(readFileSync(file));}
  return hash.digest('hex');
}
export const seedFor=(seed,name,index=0)=>createHash('sha256').update(`${seed}:${name}:${index}`).digest().readUInt32LE(0);
export const read=path=>JSON.parse(readFileSync(path,'utf8'));
