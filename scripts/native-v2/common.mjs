import assert from 'node:assert/strict';
import {existsSync,mkdirSync,openSync,closeSync,writeFileSync,renameSync,fsyncSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {hash} from '../p-confirmation/protocol.mjs';
process.env.NATIVE_RUN??='.local-research/native-v2-20261030';
const measurement=await import('../native/measure.mjs');
export const {output,read,resources,measure}=measurement;
export {hash};
export function atomic(path,value){mkdirSync(dirname(path),{recursive:true});const tmp=`${path}.tmp`,fd=openSync(tmp,'w');try{writeFileSync(fd,JSON.stringify(value)+'\n');fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,path);const dir=openSync(dirname(path),'r');try{fsyncSync(dir);}finally{closeSync(dir);}}
export function checked(path){const r=read(path),{checksum,...body}=r;assert.equal(hash(body),checksum,`Checksum: ${path}`);return r;}
export function sealed(path,body){const r={...body,checksum:hash(body)};if(existsSync(path))assert.deepEqual(read(path),r,'Immutable evidence changed');else atomic(path,r);return r;}
mkdirSync(output,{recursive:true});
const ledger=resolve(output,'measurement-budget.json');
if(!existsSync(ledger))atomic(ledger,{version:1,capMs:8*3600000,reportingReserveMs:20*60000,spentMs:0,stages:[]});
assert.equal(read(ledger).capMs,8*3600000,'Separate eight-hour allowance required');
