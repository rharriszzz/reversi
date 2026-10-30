import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,copyFileSync,existsSync,statSync} from 'node:fs';
import {dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {read,atomic} from '../research/io.mjs';
import {inventory,sha,resource} from '../frozen-player/execution.mjs';
import {PROTOCOL,hash} from './protocol.mjs';
export {read,atomic,sha};
export const OLD='.local-research/frozen-player-screen-v1-20261029';
export const OUT='.local-research/p-independent-confirmation-v1-20261029';
export function sealed(path,body){const full={...body,checksum:hash(body)};if(existsSync(path))assert.deepEqual(read(path),full,'Immutable artifact changed');else atomic(path,full);return full;}
export function checked(path){const full=read(path),{checksum,...body}=full;assert.equal(hash(body),checksum,`Checksum ${path}`);return full;}
export function scientificInventory(){return [...inventory(),...['tests/p-confirmation.test.mjs','docs/P_CONFIRMATION_PROTOCOL.md'].map(p=>[p,sha(p)])].sort();}
export function snapshot(output,rows){for(const [path,digest] of rows){const target=`${output}/snapshot/${path}`;mkdirSync(dirname(target),{recursive:true});if(!existsSync(target))copyFileSync(path,target);assert.equal(sha(target),digest);}}
export function directoryBytes(path){let size=0;for(const e of readdirSync(path,{withFileTypes:true})){const p=`${path}/${e.name}`;if(e.isDirectory())size+=directoryBytes(p);else if(e.isFile())size+=statSync(p).size;else throw Error('Unexpected artifact symlink');}return size;}
export function resources(output,previous=null){const r=resource(),args=execFileSync('ps',['-axo','pid=,args='],{encoding:'utf8'});r.cpuModel=execFileSync('sysctl',['-n','machdep.cpu.brand_string'],{encoding:'utf8'}).trim();r.physicalBytes=Number(execFileSync('sysctl',['-n','hw.memsize'],{encoding:'utf8'}));
 const competitors=args.split('\n').filter(l=>/\b(?:node|python3?)\s+.*scripts\/(?:frozen-player\/(?:run|qualify|preflight)|(?:next|residual|strong|teacher)\/|machine-benchmark\/run)/.test(l));
 assert.equal(r.activeNativeSearches,0,'Competing native scientific search');assert.deepEqual(competitors,[],'Competing scientific coordinator');assert.ok(r.cpuModel.includes('M4'));assert.ok(r.availableGiB>=PROTOCOL.resources.reserveGiB);
 const disk=r.disk.trim().split('\n').at(-1).trim().split(/\s+/);r.availableDiskGiB=Number(disk[3])/1048576;assert.ok(r.availableDiskGiB>=80,'75 GiB experiment cap plus OS disk reserve');
 r.newArtifactBytes=existsSync(output)?directoryBytes(output):0;assert.ok(r.newArtifactBytes<PROTOCOL.resources.diskGiB*2**30);
 if(previous){const seconds=(Date.parse(r.at)-Date.parse(previous.at))/1000;r.swapPagesPerSecond=seconds>0?Math.max(r.swapins-previous.swapins,r.swapouts-previous.swapouts)/seconds:0;assert.ok(r.swapPagesPerSecond<256,'Swap activity');}
 return r;
}
