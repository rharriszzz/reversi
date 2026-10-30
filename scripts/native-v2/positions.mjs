import {engineeringPositions} from '../native/positions.mjs';
import {randomOpening,seededRandom} from '../../src/learning.js';
export function positions(){
 const extra=Array.from({length:16},(_,i)=>{const p=randomOpening(seededRandom(0x56320000+i),40+i%8);return {id:`v2-late-${i}`,board:[...p.board],player:p.player??1,occupied:p.board.filter(Boolean).length,seed:0x56320000+i};});
 return [...engineeringPositions(),...extra,
 {id:'forced-pass',board:('.WBBBBBB'+'BBBBBBBB'.repeat(6)+'BBBBBBB.').split('').map(v=>v==='B'?1:v==='W'?-1:0),player:-1,occupied:62},
 {id:'terminal-empties',board:Array.from({length:64},(_,i)=>i<48?1:0),player:1,occupied:48}];
}
