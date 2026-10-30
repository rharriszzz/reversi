import {python} from '../python.mjs';
import {readFileSync,readdirSync,openSync,readSync,closeSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {legalMoves,play} from '../../src/rules.js';
import {trajectoryKeys,keysFor} from '../residual/data.mjs';
import {hash} from './protocol.mjs';
export function sha(path){const fd=openSync(path,'r'),digest=createHash('sha256'),buffer=Buffer.allocUnsafe(1048576);try{let n;while((n=readSync(fd,buffer,0,buffer.length,null)))digest.update(buffer.subarray(0,n));}finally{closeSync(fd);}return digest.digest('hex');}
export function inventory(){const rows=[];function visit(dir){for(const e of readdirSync(dir,{withFileTypes:true})){
 const p=resolve(dir,e.name);if(e.isDirectory())visit(p);else if(/\.(mjs|js|json|patch|h|c|py)$/.test(p))rows.push([relative(process.cwd(),p),sha(p)]);
}}visit('src');visit('scripts');for(const p of ['tests/oracle.mjs','tests/fixtures/edax-bound.json','tests/fixtures/edax-bound-leaf.json','docs/data/next-residual-coefficients-20261029.json','docs/data/next-residual-results-20261029.json'])rows.push([p,sha(p)]);return rows.sort();}
export const resource=()=>JSON.parse(execFileSync(python,['scripts/frozen-player/resources.py'],{encoding:'utf8'}));
export const terminal=board=>!legalMoves(board,1).length&&!legalMoves(board,-1).length;
export function admissionKeys(tr,frontiers=[]){
 const source=new Set(),direct=new Set(),add=(board,set)=>{if(!terminal(board))for(const k of keysFor(board))set.add(k);};
 for(const s of tr.history)add(s.board,source);
 add(tr.root.board,direct);for(const m of legalMoves(tr.root.board,tr.root.player))add(play(tr.root.board,tr.root.player,m),direct);
 for(const f of frontiers){for(const p of f.parents){add(p.board,direct);for(const c of p.children)add(c.board,direct);}
  for(const line of f.lines){let board=tr.root.board,player=tr.root.player;for(const step of line.steps){if(step.move!==null)board=play(board,player,step.move);add(board,direct);player=-player;}}
 }
 return {source,direct,all:new Set([...source,...direct])};
}
