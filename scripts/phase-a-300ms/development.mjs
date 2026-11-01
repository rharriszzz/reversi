import {generate,keysFor} from '../residual/data.mjs';
import {admissionKeys} from '../frozen-player/execution.mjs';
import {KeyIndex} from '../residual/index.mjs';
import {play} from '../../src/rules.js';
import {OUT,checked,atomic,read,sealed} from './tournament-common.mjs';
import {slots,TOURNAMENT} from './prospective-protocol.mjs';
const f=checked(`${OUT}/fixtures.json`),cal=checked(`${OUT}/calibration.json`),keys=new Set(),trs=[];
for(const spec of slots().slice(0,4))trs.push(generate(spec,spec.family,{namespace:TOURNAMENT.namespace+'-disclosed-test',strata:[[12,19]],commonPrefixBoundary:12}));
atomic(`${OUT}/development-test-trajectories.json`,trs);
for(const tr of [...trs,...f.attempts]){
 if(tr.root)for(const key of admissionKeys(tr).all)keys.add(key);
 else for(const s of tr.history)for(const key of keysFor(s.board))keys.add(key);
}
for(const {opening,result} of [...f.games,...cal.games]){
 let board=opening.board;
 for(const m of result.moves){for(const key of keysFor(board))keys.add(key);if(m.move!==null)board=play(board,m.player,m.move);}
}
KeyIndex.from(keys).save(`${OUT}/disclosed-development-keys.bin`);
console.log(JSON.stringify({disclosedSourcePaths:8,disclosedGames:4,excludedKeys:keys.size}));
