#!/usr/bin/env node
// Diagnostic windows never feed qualification labels. Check their containment
// against completed full-window values on the same board, turn and horizon.
import {mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {read,atomic} from '../research/io.mjs';
import {hash} from './qualification-core.mjs';
import {identity,obf,sha} from './edax.mjs';
import {legalMoves,play} from '../../src/rules.js';
const root=fileURLToPath(new URL('../..',import.meta.url));
const [benchmark,buildFile,destination,confirmation]=process.argv.slice(2),output=resolve(destination),meta=read(buildFile),pin=identity(meta.binary,`${root}/.local-research/teacher/edax/bin/data/eval.dat`,{buildFile}),reservation=read(`${benchmark}/tasks/reservation.json`).result;
const reference=confirmation?read(confirmation):null;if(reference&&(!reference.allValidated||reference.protocol.pin.binarySha!==pin.binarySha))throw Error('Window reference must be the verified same candidate');
mkdirSync(output,{recursive:true});const protocol={source:sha(fileURLToPath(import.meta.url)),pin,inputs:hash(reservation.roles.cost),depths:[10,12],windows:[[-64,-62],[62,64]],all:64,capMs:300000,notLabels:true,referenceSha256:confirmation?sha(confirmation):null};atomic(`${output}/protocol.json`,protocol);
const start=performance.now(),records=[];let comparisons=0;
for(const [i,s] of reservation.roles.cost.entries())for(const d of protocol.depths){
 const full=reference?reference.records.fresh.find(x=>x.state.id===s.id).labels[d].fixed:read(`${benchmark}/tasks/${s.id}-d${d}-repaired.json`).result;if(full.rejected)throw Error('Missing completed reference');const states=[];
 for(const row of full.rows){const board=[...play(s.board,s.player,row.move)],player=-s.player,legal=legalMoves(board,player),other=legalMoves(board,-player);if(!legal.length&&!other.length)continue;const pass=!legal.length;states.push({board,player:pass?-player:player,pass,expected:pass?-row.score:row.score});}
 for(const [alpha,beta] of protocol.windows){if(performance.now()-start>protocol.capMs)throw Error('Diagnostic cap');const name=`${s.id}-d${d}-${alpha}`,input=`${output}/${name}.obf`,usage=`${output}/${name}-usage.json`;atomic(input,states.map(x=>obf(x.board,x.player)).join('\n')+'\n');
  const args=['-eval-file',pin.evalFile,'-n','1','-h','16','-depth',String(d-1),'-selectivity','5','-verbose','1','-noise','0','-width','200','-alpha',String(alpha),'-beta',String(beta),'-solve',input];const r=spawnSync('nice',['-n','10','python3',`${root}/scripts/teacher/native-resource.py`,usage,pin.binary,...args],{encoding:'utf8',timeout:20000,cwd:output});atomic(`${output}/${name}.json`,{args,stdout:r.stdout,stderr:r.stderr,status:r.status});if(r.status!==0)throw Error('Diagnostic native failure');
  const rows=[...r.stdout.matchAll(/^\s*(\d+)\|\s*(\d+)(@\s*\d+%)?\s+([<>? ]?)([+-]\d+)/gm)];if(rows.length!==states.length)throw Error('Diagnostic row count');
  for(const [j,m] of rows.entries()){const q=states[j].expected,value=Number(m[5]),bound=m[4].trim(),depth=Math.min(d-1,states[j].board.filter(x=>!x).length);if(Number(m[1])!==j+1||Number(m[2])!==depth||m[3]||Math.abs(value)>64)throw Error('Diagnostic depth/selectivity mismatch');const valid=bound==='>'?q>=value:bound==='<'?q<=value:bound===''?q===value:false;comparisons++;if(!valid)throw Error(`Window contradiction ${name} child ${j}: ${bound}${value}, full ${q}`);}
  records.push({id:s.id,depth:d,alpha,beta,rows:rows.length,native:read(usage)});
 }
 if((i+1)%16===0&&d===12)console.log(`window consistency ${i+1}/64 roots; ${comparisons} child comparisons; ${((performance.now()-start)/1000).toFixed(1)}s`);
}
atomic(`${output}/results.json`,{passed:true,protocol,comparisons,records,elapsedMs:performance.now()-start});console.log(JSON.stringify({passed:true,comparisons,elapsedMs:performance.now()-start}));
