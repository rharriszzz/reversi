import { BLACK, WHITE, initialBoard, counts, coord, flipsFor, legalMoves, play, nextPlayer } from './rules.js';
import { cloneWeights, DEFAULT_WEIGHTS, FEATURE_NAMES, validWeights } from './features.js';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'reversi-coach-lab-learning-v1';

function loadModel() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && validWeights(saved.weights)) {
      return { weights: cloneWeights(saved.weights), version: Math.max(0, Number(saved.version) || 0), attempts: Math.max(0, Number(saved.attempts) || 0) };
    }
  } catch (_) { /* Storage may be unavailable; continue without persistence. */ }
  return { weights: cloneWeights(DEFAULT_WEIGHTS), version: 0, attempts: 0 };
}
let model = loadModel();
function saveModel() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(model)); }
  catch (_) { $('training-status').textContent += ' (Browser storage unavailable; export to keep weights.)'; }
}

const game = { board: initialBoard(), turn: BLACK, human: BLACK, history: [], message: '' };
let revision = 0;
let reviewIndex = null; // null = live, integer = earlier position before this ply
let analysis = null;
let pendingAnalysis = null;
let pendingAi = null;
let trainingBusy = false;
let selectedMove = null;
let nextJob = 1;
let trainingMessage = model.version ? `Loaded learned model ${model.version} from local browser storage.` : 'Starter weights loaded. No training performed.';

const analyzer = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const opponent = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const trainer = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

function currentView() {
  if (reviewIndex !== null && reviewIndex < game.history.length) {
    const frame = game.history[reviewIndex];
    return { board: Int8Array.from(frame.board), turn: frame.player, lastMove: reviewIndex ? game.history[reviewIndex - 1].move : null, live: false };
  }
  return { board: game.board, turn: game.turn, lastMove: game.history.at(-1)?.move ?? null, live: true };
}

function viewKey() {
  return `${revision}/${reviewIndex === null ? 'live' : reviewIndex}/${$('analysis-depth').value}/${model.version}`;
}
function sideName(side) { return side === BLACK ? 'Black' : 'White'; }
function scoreText(value) {
  if (value > 9000) return `Win +${Math.round(value - 10000)}`;
  if (value < -9000) return `Loss ${Math.round(value + 10000)}`;
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
}
function signed(value) { return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`; }

function renderBoard(view) {
  const boardElement = $('board');
  boardElement.replaceChildren();
  const legal = view.turn === null ? [] : legalMoves(view.board, view.turn);
  const allowed = view.live && view.turn === game.human;
  const best = analysis?.results?.[0]?.move;
  for (let pos = 0; pos < 64; pos++) {
    const square = document.createElement('button');
    square.type = 'button';
    const row = pos >> 3, col = pos & 7;
    const isLegal = legal.includes(pos);
    square.className = `square${(row + col) % 2 ? ' alt' : ''}${isLegal ? ' legal' : ''}${view.lastMove === pos ? ' last-square' : ''}${pos === best ? ' best-square' : ''}${pos === selectedMove ? ' selected-square' : ''}`;
    square.setAttribute('role', 'gridcell');
    square.setAttribute('aria-label', `${coord(pos)}: ${view.board[pos] === BLACK ? 'black disc' : view.board[pos] === WHITE ? 'white disc' : isLegal ? 'legal move' : 'empty'}`);
    square.disabled = !(allowed && isLegal);
    const label = document.createElement('span');
    label.className = 'square-coord';
    label.textContent = coord(pos);
    square.append(label);
    if (view.board[pos] !== 0) {
      const disc = document.createElement('span');
      disc.className = 'disc ' + (view.board[pos] === BLACK ? 'black' : 'white');
      square.append(disc);
    } else if (isLegal) {
      const dot = document.createElement('span');
      dot.className = 'move-dot';
      square.append(dot);
    }
    if (allowed && isLegal) square.addEventListener('click', () => makeMove(pos, 'human'));
    boardElement.append(square);
  }
}

function renderMoveRows() {
  const tbody = $('move-rows');
  tbody.replaceChildren();
  if (!analysis) {
    const row = document.createElement('tr');
    row.className = 'empty-row';
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = pendingAnalysis ? 'Searching every legal move...' : 'No analysis for this position yet.';
    row.append(cell);
    tbody.append(row);
    $('search-metrics').textContent = 'Positive scores favor the side to move; heuristic points are not win percentages.';
    return;
  }
  const results = analysis.results;
  if (!results.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = 'No legal moves. This player must pass, or the game has ended.';
    tr.append(td); tbody.append(tr);
  }
  results.forEach((r, rank) => {
    const tr = document.createElement('tr');
    tr.className = `${rank === 0 ? 'best ' : ''}${selectedMove === r.move ? 'active' : ''}`;
    tr.tabIndex = 0;
    tr.setAttribute('aria-label', `Inspect ${r.notation}, ${scoreText(r.score)}`);
    const entries = [String(rank + 1), r.notation, scoreText(r.score), rank === 0 ? '—' : (Math.abs(results[0].score - r.score) > 9000 ? 'Outcome gap' : `−${(results[0].score - r.score).toFixed(1)}`)];
    entries.forEach((entry, index) => {
      const cell = document.createElement('td');
      cell.textContent = entry;
      if (index === 3) cell.className = 'delta';
      if (index === 1 && rank === 0) {
        const badge = document.createElement('span');
        badge.className = 'best-tag'; badge.textContent = 'BEST'; cell.append(badge);
      }
      tr.append(cell);
    });
    tr.addEventListener('click', () => { selectedMove = r.move; render(); });
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectedMove = r.move; render(); }
    });
    tbody.append(tr);
  });
  $('search-metrics').textContent = `${analysis.nodes.toLocaleString()} search nodes · ${analysis.elapsedMs.toLocaleString()} ms · ${analysis.exact ? 'Exact outcome (search reaches all finishes)' : 'Heuristic estimate; horizon limited'} · Equal depth for all moves.`;
}

function renderInterpretation(view) {
  const box = $('interpretation');
  if (!analysis?.results?.length) {
    box.replaceChildren();
    const title = document.createElement('h3'); title.textContent = 'Why is one move better?';
    const p = document.createElement('p'); p.textContent = 'The coach will show search continuations and position-feature comparisons here. You can also replay earlier positions.';
    box.append(title, p); return;
  }
  const best = analysis.results[0];
  const chosen = analysis.results.find(r => r.move === selectedMove) ?? best;
  const isBest = chosen.move === best.move;
  const flipCount = flipsFor(view.board, view.turn, chosen.move).length;
  const topFeatures = Object.entries(chosen.immediate.contributions)
    .filter(([, value]) => Math.abs(value) > .5)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3);
  const comparative = Object.entries(FEATURE_NAMES).map(([key, name]) => ({
    name, value: chosen.immediate.contributions[key] - best.immediate.contributions[key],
  })).filter(x => Math.abs(x.value) > .75).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);

  box.replaceChildren();
  const h3 = document.createElement('h3');
  h3.textContent = isBest ? `${chosen.notation} — best found` : `${chosen.notation} versus ${best.notation}`;
  box.append(h3);
  const summary = document.createElement('p');
  summary.textContent = isBest
    ? `At ${analysis.depth} plies, ${chosen.notation} ranks first (${scoreText(chosen.score)}). It flips ${flipCount} disc${flipCount === 1 ? '' : 's'} immediately.`
    : `${chosen.notation} scores ${scoreText(chosen.score)}, versus ${scoreText(best.score)} for ${best.notation}, after equally deep searches. It flips ${flipCount} disc${flipCount === 1 ? '' : 's'} now.`;
  box.append(summary);
  if (isBest && topFeatures.length) {
    const p = document.createElement('p');
    p.append('Largest weighted features immediately after the move: ');
    const features = topFeatures.map(([k, val]) => `${FEATURE_NAMES[k]} ${signed(val)}`).join(' · ');
    const strong = document.createElement('strong'); strong.textContent = features;
    p.append(strong); box.append(p);
  } else if (!isBest && comparative.length) {
    const p = document.createElement('p');
    p.append('Relative to the best move, its immediate weighted features differ: ');
    const strong = document.createElement('strong');
    strong.textContent = comparative.map(x => `${x.name} ${signed(x.value)}`).join(' · ');
    p.append(strong); box.append(p);
  }
  const pv = document.createElement('p');
  pv.className = 'variation';
  pv.textContent = `Illustrative search continuation: ${chosen.pv.join(' → ') || chosen.notation}`;
  box.append(pv);
  const caveat = document.createElement('p');
  caveat.textContent = 'The feature figures describe the immediate resulting position; they are NOT an attribution of the multi-ply alpha–beta score. Opponent replies, mobility changes, and horizon effects can reverse their apparent importance.';
  box.append(caveat);
}

function renderWeights() {
  const wrap = $('weights-table');
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const title = document.createElement('tr');
  for (const text of ['Feature', 'Opening', 'Middle', 'Endgame']) {
    const th = document.createElement('th'); th.textContent = text; title.append(th);
  }
  head.append(title); table.append(head);
  const body = document.createElement('tbody');
  for (const [feature, name] of Object.entries(FEATURE_NAMES)) {
    const tr = document.createElement('tr');
    for (const value of [name, model.weights.opening[feature], model.weights.middle[feature], model.weights.endgame[feature]]) {
      const td = document.createElement('td'); td.textContent = typeof value === 'number' ? value.toFixed(1) : value; tr.append(td);
    }
    body.append(tr);
  }
  table.append(body); wrap.replaceChildren(table);
  $('model-version').textContent = `Model ${model.version}`;
  $('training-status').textContent = trainingMessage;
  $('train').disabled = trainingBusy;
  $('train').textContent = trainingBusy ? 'Training…' : 'Train one generation';
  $('reset-model').disabled = trainingBusy;
}

function render() {
  const view = currentView();
  const pieces = counts(view.board);
  $('black-count').textContent = pieces.black;
  $('white-count').textContent = pieces.white;
  if (view.turn === null) $('turn-title').textContent = 'Game over';
  else $('turn-title').textContent = `${sideName(view.turn)} to move`;
  $('turn-detail').textContent = view.live
    ? (view.turn === game.human ? `You are ${sideName(game.human)} · Pick a highlighted legal square.` : view.turn === null ? 'Review the game with the slider below.' : `You are ${sideName(game.human)} · The computer is thinking.`)
    : `Review mode · Analyzing ${sideName(view.turn)}'s choices.`;
  $('status').textContent = !view.live ? 'Viewing an earlier position. Return the replay slider to the right to resume play.'
    : view.turn === null ? `Final result: Black ${pieces.black} · White ${pieces.white}. ${pieces.black === pieces.white ? 'Draw.' : `${pieces.black > pieces.white ? 'Black' : 'White'} wins!`}`
    : (game.message || (view.turn === game.human ? 'Your turn. Use the move table to compare candidate moves.' : 'The computer is considering its reply.'));
  $('last-play').textContent = view.lastMove === null ? 'No moves played' : `Last move: ${coord(view.lastMove)}`;
  $('position-label').textContent = view.live ? 'Live position' : `Historical position ${reviewIndex}`;
  const slider = $('review-slider');
  slider.max = game.history.length;
  slider.value = reviewIndex ?? game.history.length;
  $('review-value').textContent = `${reviewIndex ?? game.history.length} / ${game.history.length} plies`;
  $('undo').disabled = !game.history.length;
  $('depth-label').textContent = `Depth ${analysis?.depth ?? $('analysis-depth').value}`;
  $('analysis-caption').textContent = view.turn === null
    ? 'The game is complete. Use the replay slider to examine past decisions.'
    : `Scores favor ${sideName(view.turn)}. ${view.live ? 'Select a row to inspect; click the board to commit a move.' : 'You are reviewing this earlier position.'}`;
  const historyElement = $('history');
  historyElement.replaceChildren();
  if (!game.history.length) historyElement.textContent = 'No moves played yet.';
  else for (const [index, item] of game.history.entries()) {
    const span = document.createElement('span'); span.className = 'history-item';
    span.textContent = `${index + 1}. ${item.player === BLACK ? 'B' : 'W'} ${coord(item.move)}`;
    historyElement.append(span);
  }
  renderBoard(view);
  renderMoveRows();
  renderInterpretation(view);
  renderWeights();
}

function startAnalysis() {
  const view = currentView();
  analysis = null;
  selectedMove = null;
  pendingAnalysis = null;
  if (view.turn !== null) {
    const id = nextJob++;
    const key = viewKey();
    pendingAnalysis = { id, key };
    analyzer.postMessage({ type: 'analyze', id, board: Array.from(view.board), player: view.turn, depth: Number($('analysis-depth').value), weights: model.weights });
  }
  render();
}

function requestComputer() {
  if (game.turn === null || game.turn === game.human || (pendingAi && pendingAi.revision === revision)) return;
  const id = nextJob++;
  pendingAi = { id, revision };
  opponent.postMessage({ type: 'analyze', id, board: Array.from(game.board), player: game.turn, depth: Number($('computer-depth').value), weights: model.weights });
  render();
}

function schedule() {
  if (reviewIndex !== null) startAnalysis();
  else if (game.turn !== null && game.turn !== game.human) { analysis = null; pendingAnalysis = null; requestComputer(); }
  else startAnalysis();
}

function makeMove(move, source) {
  if (reviewIndex !== null && source === 'human') return;
  if (game.turn === null || !legalMoves(game.board, game.turn).includes(move)) return;
  if (source === 'human' && game.turn !== game.human) return;
  if (source === 'computer' && game.turn === game.human) return;
  const previous = game.turn;
  game.history.push({ board: Array.from(game.board), player: previous, move });
  game.board = play(game.board, previous, move);
  game.turn = nextPlayer(game.board, previous);
  game.message = game.turn === previous
    ? `${sideName(-previous)} has no legal move and must pass. ${sideName(previous)} plays again.`
    : game.turn === null ? '' : `${sideName(previous)} played ${coord(move)}. ${game.turn === game.human ? 'Your turn.' : 'Computer to move.'}`;
  revision++;
  pendingAi = null;
  schedule();
}

function newGame() {
  revision++;
  reviewIndex = null;
  game.board = initialBoard();
  game.turn = BLACK;
  game.human = Number($('human-color').value);
  game.history = [];
  game.message = 'New game. Black opens.';
  pendingAi = null;
  schedule();
}

function undoTurn() {
  if (!game.history.length) return;
  // Roll back to the last decision made by the human when possible.
  do {
    const item = game.history.pop();
    game.board = Int8Array.from(item.board);
    game.turn = item.player;
  } while (game.history.length && game.turn !== game.human);
  game.message = 'Move(s) taken back. Consider a different continuation.';
  reviewIndex = null;
  revision++;
  pendingAi = null;
  schedule();
}

analyzer.onmessage = (event) => {
  const message = event.data;
  if (!pendingAnalysis || message.id !== pendingAnalysis.id || pendingAnalysis.key !== viewKey()) return;
  pendingAnalysis = null;
  if (message.type === 'error') {
    $('status').textContent = 'Analysis failed: ' + message.message;
    return;
  }
  analysis = message.analysis;
  selectedMove = analysis.results[0]?.move ?? null;
  render();
};
opponent.onmessage = (event) => {
  const message = event.data;
  if (!pendingAi || message.id !== pendingAi.id || pendingAi.revision !== revision) return;
  pendingAi = null;
  if (message.type === 'error') {
    game.message = 'Computer search failed: ' + message.message;
    render(); return;
  }
  const choice = message.analysis.results[0];
  if (choice) makeMove(choice.move, 'computer');
  else {
    game.message = 'Computer has no legal move.';
    render();
  }
};
trainer.onmessage = (event) => {
  const message = event.data;
  if (message.id !== trainingJobId) return;
  trainingBusy = false;
  if (message.type === 'error') {
    trainingMessage = 'Training error: ' + message.message;
    render(); return;
  }
  const x = message.outcome;
  if (x.accepted) {
    model.weights = cloneWeights(x.weights);
    model.version++;
  }
  trainingMessage = `${x.accepted ? 'Accepted challenger!' : 'Challenger rejected.'} ${x.wins} wins, ${x.draws} draws, ${x.losses} losses (${x.points}/${x.total} points). Depth ${x.depth}, paired openings, candidate playing both colors. Attempt ${model.attempts}.`;
  saveModel();
  startAnalysis();
};
let trainingJobId = null;

$('new-game').addEventListener('click', newGame);
$('human-color').addEventListener('change', newGame);
$('undo').addEventListener('click', undoTurn);
$('refresh-analysis').addEventListener('click', startAnalysis);
$('analysis-depth').addEventListener('change', startAnalysis);
$('review-slider').addEventListener('input', e => {
  const idx = Number(e.target.value);
  reviewIndex = idx >= game.history.length ? null : idx;
  schedule();
});
$('train').addEventListener('click', () => {
  if (trainingBusy) return;
  trainingBusy = true;
  model.attempts++;
  const id = nextJob++;
  trainingJobId = id;
  const seed = 20261026 + model.attempts * 104729;
  trainingMessage = 'Playing eight paired tournament games in a background worker. The game board remains usable.';
  saveModel();
  render();
  trainer.postMessage({ type: 'train', id, weights: model.weights, options: { seed, depth: 2, openingPairs: 4 } });
});
$('reset-model').addEventListener('click', () => {
  if (trainingBusy || !window.confirm('Reset all learned evaluator weights to the original starter values?')) return;
  model = { weights: cloneWeights(DEFAULT_WEIGHTS), version: 0, attempts: 0 };
  trainingMessage = 'Learning weights reset to the initial hand-designed model.';
  saveModel();
  startAnalysis();
});
$('export-model').addEventListener('click', () => {
  const json = JSON.stringify({ format: 'reversi-coach-lab-model-v1', exportedAt: new Date().toISOString(), ...model }, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `reversi-coach-model-${model.version}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

newGame();
