// Reuse retained, hash-verified evidence; no historical reconstruction.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {KeyIndex} from '../residual/index.mjs';
import {admissionKeys,sha} from '../frozen-player/execution.mjs';
import {keysFor} from '../residual/data.mjs';
import {play} from '../../src/rules.js';
let cache;
export function priorEvidence(){
 if(cache)return cache;
 const read=p=>JSON.parse(readFileSync(p,'utf8')),base=resolve('docs/data/phase-a-tournament'),manifest=read(`${base}/manifest.json`),all=new Set(),seeds=new Set(),files={};
 for(const name of ['registration.json','admission-attempts.jsonl.gz','games.json.gz','development-test-trajectories.json','fixtures.json','seed-registry-verification.json']){
  const path=`${base}/${name}`;files[path]=sha(path);
  // Completion inventory binds late supplements as well as the original manifest.
  const expected=read(`${base}/completion.json`).publicFiles[name]??manifest.files[name];assert.equal(files[path],expected,name);
 }
 const add=tr=>{seeds.add(tr.seed);if(tr.root)for(const k of admissionKeys(tr).all)all.add(k);else for(const s of tr.history)for(const k of keysFor(s.board))all.add(k);};
 for(const line of gunzipSync(readFileSync(`${base}/admission-attempts.jsonl.gz`)).toString().trim().split('\n'))add(JSON.parse(line).trajectory);
 for(const tr of read(`${base}/development-test-trajectories.json`))add(tr);
 const fixtures=read(`${base}/fixtures.json`);for(const tr of fixtures.attempts)add(tr);
 const r=read(`${base}/registration.json`),games=JSON.parse(gunzipSync(readFileSync(`${base}/games.json.gz`)));
 for(const g of games.games){let board=r.literalOpenings[g.family].board;for(const [player,move] of g.moves){for(const k of keysFor(board))all.add(k);if(move!==null)board=play(board,player,move);}}
 for(const g of fixtures.games){let board=g.opening.board;for(const m of g.result.moves){for(const k of keysFor(board))all.add(k);if(m.move!==null)board=play(board,m.player,m.move);}}
 const ex=read('docs/data/phase-a-provenance/coverage.json').extraction,catalog=new Map(gunzipSync(readFileSync(`${ex}/files.jsonl.gz`)).toString().trim().split('\n').map(l=>{const v=JSON.parse(l);return [v.localPath,v.sha256];}));
 const old=resolve('.local-research');
 for(const rel of ['frozen-player-screen-v1-20261029/history-v2/manifest.json','frozen-player-screen-v1-20261029/preflight-final/preflight.json','p-independent-confirmation-v1-20261029/history.json','native-v2-20261030/history.json']){
  const p=resolve(old,rel);assert.equal(sha(p),catalog.get(p));files[p]=sha(p);for(const seed of read(p).seeds??[])seeds.add(seed);
 }
 const index=KeyIndex.from(all);
 return cache={index,seeds,binding:{policy:'Supplement completed qualified inventory with every prior M4 source attempt, development path, reserved root/child and played path; full retained historical seed arrays.',files,keys:index.size,indexSha256:index.digest(),seeds:[...seeds].sort((a,b)=>a-b)}};
}
