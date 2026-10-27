import { coord, legalMoves, parseCoord, play } from './rules.js';

// Report only facts from the searched line; no causal attribution to weights.
export function continuationEvidence(board, player, pv) {
  let current = board, side = player;
  const facts = [];
  for (const notation of pv) {
    const choices = legalMoves(current, side);
    if (notation === 'pass') {
      if (choices.length || !legalMoves(current, -side).length) throw new Error('Invalid pass in continuation');
      facts.push({ player: side, pass: true });
    } else {
      const move = parseCoord(notation);
      if (!choices.includes(move)) throw new Error('Illegal continuation move');
      current = play(current, side, move);
      facts.push({ player: side, move: coord(move), corner: [0, 7, 56, 63].includes(move),
        ownMobility: legalMoves(current, player).length, opponentMobility: legalMoves(current, -player).length });
    }
    side = -side;
  }
  return facts;
}
