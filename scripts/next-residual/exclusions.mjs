// Played engineering continuations are historical too, beyond their openings.
import { legalMoves,play,counts } from '../../src/rules.js';
import { keysFor } from '../residual/data.mjs';
import { hash } from './protocol.mjs';
export function gameKeys(opening,result) {
  let board=opening.board,player=opening.player,passes=0;const keys=new Set();
  const add=()=>{if(64-counts(board).empty>=12)for(const key of keysFor(board))keys.add(key);};add();
  for(const step of result.moves){if(step.player!==player||passes===2)throw Error('Engineering game turn/termination mismatch');
    if(step.move===null){if(legalMoves(board,player).length)throw Error('Engineering game illegal pass');passes++;}
    else{if(!legalMoves(board,player).includes(step.move))throw Error('Engineering game illegal move');board=[...play(board,player,step.move)];passes=0;}
    add();player=-player;
  }
  if(passes!==2||hash(board)!==hash(result.board))throw Error('Incomplete engineering game continuation');return keys;
}
export function pilotGameKeys(oldPilot,newPilot,oldReservations) {
  const keys=new Set();let games=0;
  for(const cost of oldPilot.gameCosts)for(const result of cost.games){for(const key of gameKeys(result.opening,result))keys.add(key);games++;}
  for(const cost of newPilot.gameCosts)for(const result of cost.games){const opening=oldReservations.roles.games[cost.index];for(const key of gameKeys(opening,result))keys.add(key);games++;}
  return {keys,games};
}
