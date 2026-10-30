// Persistent, complete-search boundary. No board or evaluator callbacks at leaves.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { build, sha } from './build.mjs';
export function boardArgs(board,player,model='P') {
  if(!board||board.length!==64||![1,-1].includes(player)||!['B','L','P'].includes(model))throw Error('Invalid board/player/model');
  let black=0n,white=0n;
  for(let q=0;q<64;q++) {if(![-1,0,1].includes(board[q]))throw Error('Invalid cell');if(board[q]===1)black|=1n<<BigInt(q);if(board[q]===-1)white|=1n<<BigInt(q);}
  return `${black.toString(16)} ${white.toString(16)} ${player} ${['B','L','P'].indexOf(model)}`;
}
export function decodeBoard({black,white}) {const b=BigInt(`0x${black}`),w=BigInt(`0x${white}`);return Array.from({length:64},(_,q)=>(b>>BigInt(q))&1n?1:(w>>BigInt(q))&1n?-1:0);}
export class NativeEngine {
  constructor({receipt=null,ttMiB=16}={}) {
    if(!Number.isInteger(ttMiB)||ttMiB<0||ttMiB>1024)throw Error('TT must be 0..1024 MiB');
    this.receipt=receipt??build();this.ttMiB=ttMiB;this.nextId=1;this.pending=new Map();this.child=null;this.closed=false;
  }
  start() {
    if(this.closed)throw Error('Native engine closed');if(this.child)return;
    if(sha(readFileSync(this.receipt.executable))!==this.receipt.executableSha256)throw Error('Native executable identity changed');
    const child=spawn(this.receipt.executable,[String(this.ttMiB)],{stdio:['pipe','pipe','pipe']});this.child=child;let stderr='';
    child.stderr.on('data',b=>{stderr=(stderr+b).slice(-8192);});
    const fail=error=>{if(this.child===child)this.child=null;for(const [id,p] of this.pending){if(p.child===child){p.reject(error);this.pending.delete(id);}}};
    createInterface({input:child.stdout}).on('line',line=>{
      try {const row=JSON.parse(line),p=this.pending.get(row.id);if(!p||p.child!==child)throw Error('Unexpected native reply');this.pending.delete(row.id);row.error?p.reject(Error(row.error)):p.resolve(row);}catch(e){fail(e);child.kill();}
    });
    child.on('error',fail);child.stdin.on('error',fail);child.on('exit',(code,signal)=>fail(Error(`Native exited ${code??signal}: ${stderr}`)));
  }
  request(command,{signal,timeoutMs=120000}={}) {
    if(signal?.aborted)return Promise.reject(signal.reason??Error('Search cancelled'));
    this.start();const id=this.nextId++,child=this.child,start=performance.now();
    return new Promise((resolve,reject)=>{
      const cancel=()=>{this.cancel(signal?.reason??Error('Search cancelled'));};
      const timer=setTimeout(()=>this.cancel(Error('Native response deadline exceeded')),timeoutMs);
      const clean=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);};
      this.pending.set(id,{child,resolve:r=>{clean();resolve({...r,interfaceMs:performance.now()-start});},reject:e=>{clean();reject(e);}});
      signal?.addEventListener('abort',cancel,{once:true});child.stdin.write(`${id} ${command}\n`);
    });
  }
  async ready() {const r=await this.request('hello');if(JSON.stringify(r.models)!==JSON.stringify(Object.values(this.receipt.models)))throw Error('Native model identity mismatch');return r;}
  inspect(board,player,model='P',options) {return this.request(`inspect ${boardArgs(board,player,model)}`,options);}
  async search(board,player,{model='P',depth,timeMs,tt=true,hints=true,nodeLimit=0,signal}={}) {
    depth??=timeMs===undefined?14:0;
    if(!Number.isInteger(depth)||depth<0||depth>64||(!depth&&timeMs===undefined)||timeMs!==undefined&&(!Number.isFinite(timeMs)||timeMs<=0)||!Number.isSafeInteger(nodeLimit)||nodeLimit<0)throw Error('Invalid search options');
    // Fresh wall time must match the receiver system clock. timeOrigin+now
    // is anchored at process startup and can drift from NTP-adjusted realtime.
    // Date.now floors to a millisecond, conservatively costing at most 1 ms.
    const deadlineUnixMs=timeMs===undefined?0:Date.now()+timeMs;
    const row=await this.request(`search ${boardArgs(board,player,model)} ${depth} ${timeMs??0} ${+tt} ${+hints} ${nodeLimit} ${deadlineUnixMs}`,{signal,timeoutMs:timeMs===undefined?120000:Math.max(30000,timeMs+10000)});
    if(row.modelIdentity!==this.receipt.models[model])throw Error('Wrong native model');
    return {...row,player,budgetMs:timeMs??null,backend:'native',buildIdentity:this.receipt.fingerprint};
  }
  windows(board,player,model,depth,ranges,{tt=true}={}) {return this.request(`windows ${boardArgs(board,player,model)} ${depth} ${+tt} ${ranges.length} ${ranges.flat().join(' ')}`);}
  cancel(reason=Error('Native searches cancelled')) {const child=this.child;this.child=null;for(const [id,p] of this.pending){if(p.child===child){p.reject(reason);this.pending.delete(id);}}child?.kill();}
  close() {this.closed=true;this.cancel(Error('Native engine closed'));}
}
