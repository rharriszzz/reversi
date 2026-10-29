import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,createReadStream} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {read,atomic} from '../research/io.mjs';
import {hash,PROTOCOL} from './protocol.mjs';
import {sha,terminal,admissionKeys} from './execution.mjs';
import {KeyIndex} from '../residual/index.mjs';
import {keysFor,keyFor,verifyTrajectory,preferences} from '../residual/data.mjs';
import {compile,patternEncoding} from '../next-residual/model.mjs';
import {normalizePairs} from '../next-residual/linear.mjs';
import {jointBootstrap} from '../next-residual/statistics.mjs';
import {pairSummary,jointGameBootstrap,nomination} from './statistics.mjs';
import {replay} from './game.mjs';
import {oracleChildren} from '../../tests/oracle.mjs';
import {mean,quantile} from '../teacher/qualification-core.mjs';
import {terminalScore} from '../../src/search.js';
const names=['B','L','P'];
export function replayTeacher(state,result,onState=()=>{}){
 for(const row of result.rows){let board=state.board,player=state.player;onState(board,player,'query-root',row.move,0);
  const moves=[...(row.move===null?[]:[row.move]),...(row.pv??[])];let i=0;
  for(const move of moves){const children=oracleChildren(board,player);
   if(move===null){assert.equal(children.length,0);assert.ok(oracleChildren(board,-player).length,'PV terminal pass');}
   else{const c=children.find(c=>c.move===move);assert.ok(c,'Independent PV legality');board=c.board;}
   player=-player;onState(board,player,i===0?'direct-query-child':'teacher-internal-PV',row.move,++i);
  }
 }
}
export function rankCorrelation(xs,ys){
 if(xs.length<2)return null;
 const ranks=a=>a.map(v=>(a.filter(x=>x<v).length+(a.filter(x=>x===v).length-1)/2));
 const x=ranks(xs),y=ranks(ys),mx=mean(x),my=mean(y),a=x.map(v=>v-mx),b=y.map(v=>v-my),den=Math.sqrt(a.reduce((s,v)=>s+v*v,0)*b.reduce((s,v)=>s+v*v,0));return den?a.reduce((s,v,i)=>s+v*b[i],0)/den:null;
}
export async function analyze(output,history,preflight,models){
 const started=performance.now(),frozen=read(`${output}/reservations.json`),launch=read(`${output}/launch.json`),h=read(`${history}/manifest.json`),p=read(`${preflight}/preflight.json`),index=KeyIndex.load(`${history}/membership.bin`),eng=KeyIndex.load(`${preflight}/engineering-keys.bin`);
 assert.equal(frozen.roots.length,256);assert.equal(frozen.schedule.length,384);assert.equal(index.digest(),h.digest);assert.equal(eng.digest(),p.engineeringDigest);
 const owners=new Map(),tasks=new Map(),taskInventory=[],overlaps=[],historicalHits=new Set(),directSources=new Set(),queryReplays=[];
 for(const root of frozen.roots){const tr=read(`${output}/trajectories/${root.id}.json`);verifyTrajectory(tr);assert.equal(hash(tr),root.trajectoryHash);const fs=root.diagnostic?read(`${output}/frontiers/${root.id}.json`):[];
  for(const k of admissionKeys(tr,fs).all){assert.ok(!index.has(k)&&!eng.has(k),'Admission historical collision');assert.ok(!owners.has(k),'Admission family collision');owners.set(k,root.id);}
 }
 function auditBoard(board,player,source,role,location,metadata={}){
  if(board.filter(Boolean).length<12)return;const isTerminal=terminal(board),actual=keyFor(board,player);
  for(const key of keysFor(board)){
   const old=index.has(key)||eng.has(key),other=owners.get(key);
   if(old||other&&other!==source){overlaps.push({source,role,location,key,actual:key===actual,terminal:isTerminal,occupied:board.filter(Boolean).length,historical:old,other:other??null,...metadata});if(old)historicalHits.add(key);
    // Direct roots/children/parents were frozen and must remain disjoint.
    if(!isTerminal&&role==='direct-state')directSources.add(source);
   }
  }
 }
 for(const file of readdirSync(`${output}/tasks`).filter(f=>f.endsWith('.json')).sort()){
  const r=read(`${output}/tasks/${file}`);assert.equal(r.runIdentity,launch.checksum);assert.equal(r.inputHash,hash({job:r.job,runIdentity:launch.checksum}));assert.equal(r.resultHash,hash(r.result));tasks.set(file.slice(0,-5),r);taskInventory.push([file,sha(`${output}/tasks/${file}`)]);
  if(r.job.type==='label'){
   const source=file.match(/assessment-\d+/)?.[0];assert.ok(source);const state=r.job.state,result=r.result;
   assert.equal(result.rootDepth,r.job.depth);assert.deepEqual(result.rows.map(r=>r.move).sort((a,b)=>a-b),oracleChildren(state.board,state.player).map(c=>c.move));
   replayTeacher(state,result,(b,t,role,move,step)=>auditBoard(b,t,source,role==='query-root'||role==='direct-query-child'?'direct-state':'teacher-internal-PV',`tasks/${file}`,{move,step,depth:r.job.depth,exact:64-state.board.filter(Boolean).length<=r.job.depth}));queryReplays.push(file);
  }
 }
 // Auditing precedes diagnostic numerical release. No labels influenced games.
 atomic(`${output}/sealed-release.json`,{launch:launch.checksum,at:new Date().toISOString(),queryReplays,taskInventoryHash:hash(taskInventory),directViolations:[...directSources],note:'Full returned PVs independently replayed before diagnostic analysis; all games already complete'});
 const result=id=>{assert.ok(tasks.has(id),`Missing ${id}`);return tasks.get(id).result;};
 const games=[],pairs={80:{L:[],P:[]},300:{L:[],P:[]}};
 for(const [i,condition] of frozen.schedule.entries()){
  const r=read(`${output}/games/game-${i}.json`),{checksum,...body}=r;assert.equal(hash(body),checksum);assert.equal(r.launch,launch.checksum);assert.deepEqual(r.condition,condition);
  const opening=frozen.roots.find(s=>s.id===`games-${condition.family}`),g=r.result;assert.equal(r.identity,hash({launch:launch.checksum,condition,opening}));assert.equal(r.resultHash,hash(g));assert.ok(r.committed>launch.at,'Outcome predates freeze');
  const end=replay(opening,g.moves,{complete:true});assert.deepEqual(end.board,g.board);assert.equal(g.margin,g.board.reduce((a,b)=>a+b,0));assert.equal(g.outcome,Math.sign(g.margin)*condition.color);assert.equal(g.points,(1+g.outcome)/2);
  let board=opening.board,player=opening.player;auditBoard(board,player,opening.id,'played-path',`games/game-${i}`,{step:0});
  for(const [step,m] of g.moves.entries()){if(m.move!==null)board=oracleChildren(board,player).find(c=>c.move===m.move).board;player=-player;auditBoard(board,player,opening.id,'played-path',`games/game-${i}`,{step:step+1});}
  games.push({...condition,...g,receipt:`games/game-${i}.json`});
 }
 const gameSummary={},gameBootstrap={},pairRows=[];
 for(const timeMs of [80,300]){
  const families=[...new Set(games.filter(g=>g.timeMs===timeMs).map(g=>g.family))];const joint=[];
  for(const family of families){const row={family};for(const candidate of ['L','P']){const gs=games.filter(g=>g.family===family&&g.candidate===candidate);assert.equal(gs.length,2);assert.deepEqual(new Set(gs.map(g=>g.color)),new Set([-1,1]));row[candidate]=mean(gs.map(g=>g.points));pairRows.push({family,candidate,timeMs,score:row[candidate],margins:gs.map(g=>g.margin*g.color),points:gs.map(g=>g.points)});pairs[timeMs][candidate].push(row[candidate]);}joint.push(row);}
  gameBootstrap[timeMs]=jointGameBootstrap(joint);gameSummary[timeMs]={};
  for(const candidate of ['L','P']){
   const gs=games.filter(g=>g.timeMs===timeMs&&g.candidate===candidate),moves=gs.flatMap(g=>g.moves.filter(m=>m.move!==null));
   gameSummary[timeMs][candidate]={...pairSummary(pairs[timeMs][candidate]),wins:gs.filter(g=>g.outcome>0).length,draws:gs.filter(g=>g.outcome===0).length,losses:gs.filter(g=>g.outcome<0).length,games:gs.length,
    meanDiscMargin:mean(gs.map(g=>g.margin*g.color)),moveTimeMs:gs.reduce((s,g)=>s+g.moveTimeMs,0),maxOverrunMs:Math.max(...moves.map(m=>m.overrunMs)),over1ms:moves.filter(m=>m.overrunMs>1).length,
    incompleteIterations:moves.filter(m=>m.timedOut).length,fallbacks:moves.filter(m=>m.depth===0).length};
  }
 }
 const moveTelemetry=[];
 for(const timeMs of [80,300])for(const candidate of ['L','P'])for(const evaluator of ['B',candidate])for(const phase of ['opening','middle','endgame']){
  const rows=games.filter(g=>g.timeMs===timeMs&&g.candidate===candidate).flatMap(g=>g.moves.filter(m=>m.move!==null&&(m.player===g.color?candidate:'B')===evaluator)).filter(m=>(m.occupied<28?'opening':m.occupied<52?'middle':'endgame')===phase);
  moveTelemetry.push({timeMs,candidate,evaluator,phase,moves:rows.length,meanDepth:mean(rows.map(r=>r.depth)),medianDepth:quantile(rows.map(r=>r.depth),.5),depthHistogram:Object.fromEntries([...new Set(rows.map(r=>r.depth))].sort((a,b)=>a-b).map(d=>[d,rows.filter(r=>r.depth===d).length])),
   meanMs:mean(rows.map(r=>r.measuredMs)),maxMs:Math.max(...rows.map(r=>r.measuredMs)),nodes:rows.reduce((s,r)=>s+r.nodes,0),evaluations:rows.reduce((s,r)=>s+r.evaluations,0),totalMs:rows.reduce((s,r)=>s+r.measuredMs,0),incomplete:rows.filter(r=>r.timedOut).length,exact:rows.filter(r=>r.exact).length});
 }
 // Fixed/timed choice diagnostics: each source remains one clustered row.
 const rootRows=[],sourceRows=[],exactRows=[];
 for(const root of frozen.roots.filter(r=>r.role!=='games')){
  const labels=root.role==='assessment'?Object.fromEntries([10,12].map(d=>[d,result(`root-${root.id}-d${d}`)])):null;
  const exactTask=tasks.get(`exact-${root.id}`),independent=exactTask?.result,sourceRow={id:root.id,phase:root.phase,policy:root.policy,depth:root.depth};
  const values=labels?new Map(labels[12].rows.map(r=>[r.move,r.value])):new Map(independent.raw.rows.map(r=>[r.move,r.value])),best=Math.max(...values.values());
  const conditions=[4,5,6,'80ms','300ms'];
  for(const condition of conditions){const choices={};
   for(const name of names){let search,choice,productionChoice,fullScores=null;
    if(typeof condition==='number'){search=result(`search-${root.id}-${name}-${condition}`);choice=search.full.rows[0].move;productionChoice=search.production.move;fullScores=search.full.rows;}
    else{const timeMs=parseInt(condition),r=read(`${output}/timed/${root.id}-${name}-${timeMs}.json`);assert.equal(r.identity,hash(r.input));assert.equal(r.input.launch,launch.checksum);assert.equal(r.resultHash,hash(r.result));search=r.result;choice=productionChoice=search.move;}
    const row={source:root.id,role:root.role,phase:root.phase,policy:root.policy,sourceDepth:root.depth,name,condition,choice,productionChoice,tieDifference:choice!==productionChoice,regret:best-values.get(choice),productionRegret:best-values.get(productionChoice),valueKind:labels?(64-root.occupied<=12?'terminal-Edax-awarded-discs':'estimated-Edax-D12-discs'):'exact-raw-discs',search,
     rankCorrelation:fullScores?rankCorrelation(fullScores.map(r=>r.score),fullScores.map(r=>values.get(r.move))):null};
    if(labels){const hvalues=new Map(labels[10].rows.map(r=>[r.move,r.value])),hbest=Math.max(...hvalues.values());row.teacherHorizonRegret=best-values.get(labels[10].rows.slice().sort((a,b)=>b.value-a.value||a.move-b.move)[0].move);row.chosenGap10=hbest-hvalues.get(choice);}
    if(independent){row.exact={};for(const convention of ['raw','awarded']){const ref=independent[convention],v=ref.rows.find(r=>r.move===choice).value;row.exact[convention]={value:v,regret:ref.value-v,wdlError:Math.sign(v)<Math.sign(ref.value),gamePointRegret:(Math.sign(ref.value)-Math.sign(v))/2};}}
    choices[name]=row;rootRows.push(row);sourceRow[`${condition}-${name}`]=row.regret;if(root.role==='exact')exactRows.push(row);
   }
   for(const name of ['L','P'])sourceRow[`${condition}-${name}-B`]=choices[name].regret-choices.B.regret;
  }
  sourceRows.push({...sourceRow,role:root.role});
 }
 const keys=Object.keys(sourceRows[0]).filter(k=>!['id','phase','policy','depth','role'].includes(k));
 const rootUncertainty=jointBootstrap(sourceRows.filter(r=>r.role==='assessment'),keys,{seed:PROTOCOL.statistics.seed});
 const exactUncertainty=jointBootstrap(sourceRows.filter(r=>r.role==='exact'),keys,{seed:PROTOCOL.statistics.seed+1});
 const rootGroups=[];
 for(const role of ['assessment','exact'])for(const condition of [4,5,6,'80ms','300ms'])for(const name of names)for(const phase of [null,0,1,2,3]){
  const rows=rootRows.filter(r=>r.role===role&&r.condition===condition&&r.name===name&&(phase===null||r.phase===phase));if(!rows.length)continue;
  rootGroups.push({role,condition,name,phase,n:rows.length,meanRegret:mean(rows.map(r=>r.regret)),productionMeanRegret:mean(rows.map(r=>r.productionRegret)),tieDifferences:rows.filter(r=>r.tieDifference).length,meanRankCorrelation:mean(rows.map(r=>r.rankCorrelation).filter(r=>r!==null)),exactSources:rows.filter(r=>r.exact).length,
   exactWdlErrors:rows.filter(r=>r.exact?.raw.wdlError).length,exactMeanMarginRegret:mean(rows.filter(r=>r.exact).map(r=>r.exact.raw.regret)),exactMeanGamePointRegret:mean(rows.filter(r=>r.exact).map(r=>r.exact.raw.gamePointRegret))});
 }
 const evals=Object.fromEntries(names.map(n=>[n,compile(models[n]).evaluate])),frontierSources=[],frontierPairs=[],frontierParents=[],witnesses=[];
 for(const root of frozen.roots.filter(r=>r.diagnostic)){
  const fs=read(`${output}/frontiers/${root.id}.json`),union=[...new Map(fs.flatMap(f=>f.parents).map(p=>[hash({board:p.board,player:p.player}),p])).values()];
  const oneSource={id:root.id,phase:root.phase,policy:root.policy,depth:root.depth};
  for(const [si,selector] of names.entries()){
   const frontier=fs[si];assert.equal(frontier.rootId,root.id);for(const line of frontier.lines)assert.ok(line.terminal||line.rootLeafObserved||terminal(line.endpoint.board));
   const labels=frontier.parents.map(parent=>{const j=union.findIndex(p=>hash({board:p.board,player:p.player})===hash({board:parent.board,player:parent.player}));return Object.fromEntries([10,12].map(d=>[d,result(`frontier-${root.id}-p${j}-d${d}`)]));});
   const group=preferences(root,frontier,labels),pairs=normalizePairs([group]);
   const totals=Object.fromEntries(names.map(n=>[n,{error:0,nonterminalLoss:0,terminalLoss:0,terminalMass:0,nonterminalMass:0,fullLoss:0}]));
   for(const pair of pairs){const parent=frontier.parents[pair.parent],a=parent.children.find(c=>c.move===pair.preferred),b=parent.children.find(c=>c.move===pair.other),row={source:root.id,selector,parent:pair.parent,preferred:pair.preferred,other:pair.other,weight:pair.weight,terminal:pair.terminal,gap10:pair.gapH,gap12:pair.gapR,margin:{},loss:{},a:{board:a.board,terminal:a.terminal,base:a.base},b:{board:b.board,terminal:b.terminal,base:b.base}};
    const enc=new Map(patternEncoding(a.board,parent.player));for(const [i,v] of patternEncoding(b.board,parent.player))enc.set(i,(enc.get(i)??0)-v);
    row.maximumAdmissibleMargin=pair.base+100*pair.x.reduce((s,v)=>s+Math.abs(v),0)+25*[...enc.values()].reduce((s,v)=>s+Math.abs(v),0);row.incompatible=row.maximumAdmissibleMargin<0;
    for(const name of names){const value=c=>c.terminal?terminalScore(c.board,parent.player):evals[name](c.board,parent.player),margin=value(a)-value(b),z=-margin/10,loss=pair.weight*(Math.max(0,z)+Math.log1p(Math.exp(-Math.abs(z))));row.margin[name]=margin;row.loss[name]=loss;
     const total=totals[name];total.error+=pair.weight*Number(margin<=0);total[pair.terminal?'terminalLoss':'nonterminalLoss']+=loss;total[pair.terminal?'terminalMass':'nonterminalMass']+=pair.weight;total.fullLoss+=loss;
    }frontierPairs.push(row);
   }
   for(const name of names)for(const [metric,value] of Object.entries(totals[name]))oneSource[`${selector}-${name}-${metric}`]=pairs.length?value:null;
   for(const name of ['L','P'])oneSource[`${selector}-${name}-B-error`]=pairs.length?totals[name].error-totals.B.error:null;
   for(const [j,parent] of frontier.parents.entries()){
    const unionIndex=union.findIndex(p=>hash({board:p.board,player:p.player})===hash({board:parent.board,player:parent.player})),independent=tasks.get(`frontier-exact-${root.id}-p${unionIndex}`)?.result,values=new Map(labels[j][12].rows.map(r=>[r.move,r.value])),best=Math.max(...values.values());
    for(const name of names){const scores=parent.children.map(c=>({move:c.move,value:c.terminal?terminalScore(c.board,parent.player):evals[name](c.board,parent.player)})).sort((a,b)=>b.value-a.value||a.move-b.move),choice=scores[0].move,row={source:root.id,selector,name,parent:j,occupied:parent.occupied,choice,regret:best-values.get(choice),score:scores[0].value,teacherValue:values.get(choice)};
     if(independent){const v=independent.raw.rows.find(r=>r.move===choice).value;row.exact={value:v,regret:independent.raw.value-v,wdlError:Math.sign(v)<Math.sign(independent.raw.value),gamePointRegret:(Math.sign(independent.raw.value)-Math.sign(v))/2};}frontierParents.push(row);
    }
   }
  }
  for(const candidate of ['L','P']){
   const old=fs[0],other=fs[names.indexOf(candidate)],bChoice=old.rootScores[0]?.move,cChoice=other.rootScores[0]?.move;
   if(bChoice!==cChoice){const oldLine=old.lines.find(l=>l.alternative===bChoice),newLine=other.lines.find(l=>l.alternative===cChoice),teacherBest=result(`root-${root.id}-d12`).rows.slice().sort((a,b)=>b.value-a.value||a.move-b.move)[0].move,sourceRoot=rootRows.filter(r=>r.source===root.id&&r.condition===root.depth);
    witnesses.push({source:root.id,candidate,depth:root.depth,bChoice,cChoice,rootRegretB:sourceRoot.find(r=>r.name==='B').regret,rootRegretCandidate:sourceRoot.find(r=>r.name===candidate).regret,
     teacherBest,teacherBestOutsideBTopTwo:!old.rootScores.slice(0,2).some(r=>r.move===teacherBest),
     siblingErrorChange:Object.fromEntries(names.map(selector=>[selector,oneSource[`${selector}-${candidate}-error`]-oneSource[`${selector}-B-error`]])),
     correctedSiblingPreferences:frontierPairs.filter(r=>r.source===root.id&&r.margin.B<=0&&r.margin[candidate]>0).length,
     correctedPreferencesAtBActiveParent:frontierPairs.filter(r=>r.source===root.id&&r.selector==='B'&&old.parents[r.parent]?.key===oldLine?.parentKey&&r.margin.B<=0&&r.margin[candidate]>0).length,
     candidateOutsideBTopTwo:!old.rootScores.slice(0,2).some(r=>r.move===cChoice),sameActiveEndpoint:hash(oldLine?.endpoint)===hash(newLine?.endpoint),B:oldLine,candidateLine:newLine,
     proof:'Actual cutoff witness and all remaining-depth full-window opponent alternatives. Descriptive continuation evidence; no attribution from immediate root features.'});
   }
  }frontierSources.push(oneSource);
 }
 const frontierKeys=Object.keys(frontierSources[0]).filter(k=>!['id','phase','policy','depth'].includes(k)),frontierUncertainty=jointBootstrap(frontierSources,frontierKeys,{seed:PROTOCOL.statistics.seed+2});
 // Resolve every observed historical overlap against all occurrence records,
 // expanding content-identical file aliases through the inventory. Unknowns
 // remain explicit, never relabeled oracle-only to obtain a favorable claim.
 const provenance=new Map([...historicalHits].map(k=>[k,[]])),lines=createInterface({input:createReadStream(`${history}/occurrences.jsonl.gz`).pipe(createGunzip()),crlfDelay:Infinity});
 for await(const line of lines){if(!line)continue;const r=JSON.parse(line);for(const k of r.keys??[])if(provenance.has(k))provenance.get(k).push(r);}
 const historicalInventory=read(`${history.replace(/\/history[^/]*$/,'')}/pc-inventory-before.json`).files;
 const classifications=[];
 for(const [key,records] of provenance){
  const occurrences=records.map(r=>({...r,path:r.file<historicalInventory.length?historicalInventory[r.file].path:h.localInputs[r.file-historicalInventory.length]}));
  const restricted=occurrences.some(r=>r.role==='direct-scored-child'||/^historical-(training|development|assessment)/.test(r.role)||/\/(frontiers|trajectories)\/(training|development|assessment)-|\/labels\//.test(r.path??''));
  const unknown=occurrences.length===0||occurrences.some(r=>r.role==='unknown-conservatively-restricted'||r.role==='encoded-history-unknown');
  classifications.push({key,occurrences,restricted,unknown,interpretation:restricted?'historical direct/assessment state':unknown?'historical role unresolved; conservative restriction':'known historical internal/played occurrence'});
 }
 const byKey=new Map(classifications.map(c=>[c.key,c]));
 const independenceViolations=overlaps.filter(r=>!r.terminal&&r.role==='played-path'&&r.historical&&(byKey.get(r.key)?.restricted||byKey.get(r.key)?.unknown));
 const independence={sourceDisjoint:directSources.size===0,gameClaim:directSources.size===0&&independenceViolations.length===0,
  directSources:[...directSources],playedPathRestrictedOrUnknown:independenceViolations,overlapOccurrences:overlaps.length,terminalOccurrences:overlaps.filter(r=>r.terminal).length,
  internalNonterminalOccurrences:overlaps.filter(r=>r.role==='teacher-internal-PV'&&!r.terminal).length,uniqueHistoricalKeys:historicalHits.size,
  interpretation:'Prospective source/family-disjoint claim; incidental oracle-internal and terminal convergence reported. Unknown historical roles conservatively restrict game claims. No outcomes or sources replaced.'};
 atomic(`${output}/overlap-audit.json`,{launch:launch.checksum,independence,overlaps,classifications});
 const frontierSummary=names.map(selector=>({selector,sources:32,informative:frontierSources.filter(r=>r[`${selector}-B-error`]!==null).length,pairs:frontierPairs.filter(r=>r.selector===selector).length,
  terminalPairs:frontierPairs.filter(r=>r.selector===selector&&r.terminal).length,incompatiblePairs:frontierPairs.filter(r=>r.selector===selector&&r.incompatible).length,
  models:Object.fromEntries(names.map(n=>[n,Object.fromEntries(['error','fullLoss','nonterminalLoss','terminalLoss','terminalMass','nonterminalMass'].map(metric=>[metric,mean(frontierSources.map(r=>r[`${selector}-${n}-${metric}`]).filter(v=>v!==null))]))]))}));
 const calibration=[];for(const selector of names)for(const name of names){const sources=frontierSources.map(r=>r.id);const scales={};for(const scale of [.5,1,2]){const losses=[];for(const source of sources){const rows=frontierPairs.filter(r=>r.selector===selector&&r.source===source&&!r.terminal);if(!rows.length)continue;losses.push(rows.reduce((sum,r)=>{const z=-scale*r.margin[name]/10;return sum+r.weight*(Math.max(0,z)+Math.log1p(Math.exp(-Math.abs(z))));},0));}scales[scale]=mean(losses);}calibration.push({selector,name,storedNonterminalMarginScaleSensitivity:scales,interpretation:'Offline confidence-scale sensitivity only; no evaluator coefficient changed, no fitted calibration, ordinal decisions unchanged under positive scaling of stored compatible margins.'});}
 const summary={format:'frozen-player-scientific-summary-v1',integrity:true,launch:launch.checksum,reservations:frozen.checksum,history:h.checksum,models:PROTOCOL.models,
  gameSummary,gameBootstrap,pairRows,calibration,nomination:nomination(gameSummary[80],gameSummary[300]),moveTelemetry,rootGroups,rootUncertainty,exactUncertainty,frontierSummary,frontierUncertainty,
  independence,counts:{assessment:128,exact:32,diagnostic:32,families:96,games:384,taskReceipts:tasks.size,teacherQueries:queryReplays.length,witnesses:witnesses.length},
  taskInventoryHash:hash(taskInventory),analysisMs:performance.now()-started,
  rootGamePrediction:'Disjoint source panels: only aggregate model/time-control alignment; per-opening prediction and correlation are unidentifiable without additional labels. No game positions were retrospectively labeled.',
  production:'B'};
 atomic(`${output}/root-source-rows.json`,sourceRows);atomic(`${output}/frontier-source-rows.json`,frontierSources);atomic(`${output}/root-rows.json`,rootRows);atomic(`${output}/frontier-pairs.json`,frontierPairs);atomic(`${output}/frontier-parents.json`,frontierParents);atomic(`${output}/witnesses.json`,witnesses);atomic(`${output}/replayed-games.json`,games);
 return summary;
}
