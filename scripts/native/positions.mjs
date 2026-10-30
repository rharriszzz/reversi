import { randomOpening, seededRandom } from '../../src/learning.js';
export function engineeringPositions() {
 return Array.from({length:18},(_,i)=>{const plies=[8,12,16,20,24,28,32,36,40,44,48,50,52,54,55,56,57,58][i];const p=randomOpening(seededRandom(0x4e430000+i),plies);return {id:`native-engineering-${i}`,seed:0x4e430000+i,plies,board:[...p.board],player:p.player??1,occupied:p.board.filter(Boolean).length};});
}
