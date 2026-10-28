// Separate executable teacher. No Edax source or weights are linked/imported.
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { legalMoves, play, counts } from '../../src/rules.js';
export const SOURCE='713a434f13b3d15fb69c61b9ba3641aed82c496c';
export const EVAL_SHA='f8b2299612d9fa4414157e70e932636e33111c2602d0c2fc382a7d90ef21b792';
export const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
export function obf(board,player){if(board.length!==64||!board.every(v=>[-1,0,1].includes(v))||![1,-1].includes(player))throw Error('Invalid board/turn');return Array.from(board,v=>v===1?'X':v===-1?'O':'-').join('')+` ${player===1?'X':'O'};`;} 
export function moveIndex(s){if(/^(pa|ps|pass)$/i.test(s))return null;if(!/^[a-h][1-8]$/i.test(s))throw Error(`Invalid coordinate ${s}`);return s.toLowerCase().charCodeAt(0)-97+8*(Number(s[1])-1);}
export function parse(text,n,depths){
 const rows=[];
 for(const line of text.split('\n')) {const m=line.match(/^\s*(\d+)\|\s*(\d+)(@\s*\d+%)?\s+([<>? ]?)([+-]\d+)\s+(\d+:\d+\.\d+)\s+(\d+)\s+(.*)$/);if(!m)continue;
  const pv=m[8].trim().split(/\s+/);if(/^\d+$/.test(pv[0]))pv.shift();
  rows.push({index:Number(m[1]),depth:Number(m[2]),bound:m[4].trim()||'exact-window',score:Number(m[5]),nodes:Number(m[7]),pv:pv.filter(v=>/^[a-h][1-8]$|^(pa|ps)$/i.test(v)).map(moveIndex),selective:!!m[3]});
 }
 if(rows.length!==n||rows.some((r,i)=>r.index!==i+1||r.selective||Math.abs(r.score)>64||(r.bound!=='exact-window'&&Math.abs(r.score)!==64)||r.depth!==depths[i]))throw Error(`Incomplete, bounded, selective or wrong-depth Edax output: ${JSON.stringify(rows)}`);
 return rows;
}
export function identity(binary,evalFile){if(sha(evalFile)!==EVAL_SHA)throw Error('Evaluation hash mismatch');return {source:SOURCE,version:'Edax 4.6',binary:resolve(binary),evalFile:resolve(evalFile),binarySha:sha(binary),evalSha:sha(evalFile),selectivity:5,tasks:1,hashBits:16,book:false,units:'Edax discs (winner receives unplayed empties)',license:'GPL-3.0; external checkout LICENSE retained'};}
async function queryRaw(pin,states,depth,{timeoutMs=60000,transcript}={}) {
 if(!Number.isInteger(depth)||depth<1||depth>60)throw Error('Invalid depth');
 const dir=mkdtempSync(join(tmpdir(),'reversi-edax-')),input=join(dir,'input.obf');writeFileSync(input,states.map(s=>obf(s.board,s.player)).join('\n')+'\n');
 const args=['-eval-file',pin.evalFile,'-n','1','-h',String(pin.hashBits),'-depth',String(depth),'-selectivity','5','-verbose','1','-noise','0','-width','200','-alpha','-64','-beta','64','-solve',input];
 const start=performance.now();
 try{return await new Promise((ok,bad)=>{const child=spawn(pin.binary,args,{cwd:dir,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',expired=false;
  const timer=setTimeout(()=>{expired=true;child.kill('SIGKILL');},timeoutMs);
  child.stdout.on('data',s=>{stdout+=s;if(stdout.length>8e6)child.kill('SIGKILL');});child.stderr.on('data',s=>{stderr+=s;});child.on('error',e=>{clearTimeout(timer);bad(e);});
  child.on('close',(code,signal)=>{clearTimeout(timer);try{if(transcript){mkdirSync(resolve(transcript,'..'),{recursive:true});writeFileSync(transcript,JSON.stringify({args,stdout,stderr,code,signal,expired}));}if(code!==0||expired||/ERROR|cannot|failed/i.test(stderr))throw Error(`Edax failure ${code}: ${stderr}`);const rows=parse(stdout,states.length,states.map(s=>Math.min(depth,counts(s.board).empty)));ok({rows,wallMs:performance.now()-start});}catch(e){bad(e);}});
 });}finally{rmSync(dir,{recursive:true,force:true});}
}
export async function alternatives(pin,state,depth,options={}) {
 if(!Number.isInteger(depth)||depth<2||depth>60)throw Error("Alternative depth must be 2..60");
 const moves=legalMoves(state.board,state.player);
 // Search each child independently with full window and the SAME remaining
 // placement depth. Forced passes do not consume another placement.
 if(!moves.length){const r=await query(pin,[state],depth,options);return {...r,rows:r.rows.map(v=>({...v,move:null,value:v.score})),rootDepth:depth};}
 const children=moves.map(move=>({board:[...play(state.board,state.player,move)],player:-state.player}));
 const r=await query(pin,children,depth-1,options);
 return {...r,rows:r.rows.map((v,i)=>({...v,move:moves[i],value:-v.score})),rootDepth:depth};
}

// Edax's OBF reporting path crashes on a forced-pass root in the pinned builds.
// Normalize passes explicitly before invoking it, preserving placement depth.
export async function query(pin,states,depth,options={}) {
 if(!Number.isInteger(depth)||depth<1||depth>60)throw Error("Invalid depth");
 const requests=[],slots=[];const rows=states.map((s,index)=>{
  const moves=legalMoves(s.board,s.player),other=legalMoves(s.board,-s.player);
  if(!moves.length&&!other.length){const raw=s.board.reduce((a,v)=>a+v*s.player,0);return {index:index+1,depth:0,score:raw+Math.sign(raw)*counts(s.board).empty,nodes:0,pv:[],bound:'terminal',selective:false,adapterTerminal:true};}
  const pass=!moves.length;requests.push({...s,player:pass?-s.player:s.player});slots.push({index,pass});return null;
 });
 const r=requests.length?await queryRaw(pin,requests,depth,options):{rows:[],wallMs:0};
 for(let i=0;i<slots.length;i++){const {index,pass}=slots[i],v=r.rows[i];rows[index]={...v,index:index+1,score:pass?-v.score:v.score,pv:pass?[null,...v.pv]:v.pv,normalizedPass:pass};}
 return {...r,rows};
}
