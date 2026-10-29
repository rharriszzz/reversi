#!/usr/bin/env python3
"""Standalone publication plots; matplotlib is optional and used only here."""
import json
from pathlib import Path
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

output, root = map(Path, sys.argv[1:3])
data = json.loads((root / 'docs/data/residual-frontier-v1-20261028.json').read_text())
pilot = data['pilot']
plt.rcParams.update({'svg.fonttype': 'none', 'font.size': 10, 'axes.spines.top': False,
                     'axes.spines.right': False, 'figure.facecolor': 'white', 'svg.hashsalt': 'reversi-residual-v1'})
local = output / 'publication'
local.mkdir(exist_ok=True)


def save(fig, name):
    svg = root / 'docs' / (name + '.svg')
    fig.savefig(svg, bbox_inches='tight', metadata={'Date': None})
    svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines()) + '\n')
    fig.savefig(local / (name + '.png'), dpi=130, bbox_inches='tight')
    plt.close(fig)


fig, ax = plt.subplots(figsize=(10, 4.8))
colors = ['#325fa8', '#278577', '#d77a2b']
for j, (key, label) in enumerate([('frontierMs', 'B: complete continuation witnesses'),
                                 ('teacher10Ms', 'Edax D10'), ('teacher12Ms', 'Edax D12')]):
    values = [np.array([r[key] / 1000 for r in pilot['costs'] if r['phase'] == phase]) for phase in range(4)]
    means = np.array([v.mean() for v in values])
    error = np.array([[m-v.min() for m, v in zip(means, values)],
                      [v.max()-m for m, v in zip(means, values)]])
    ax.bar(np.arange(4) + (j-1)*.25, means, .23, color=colors[j], label=label,
           yerr=error, capsize=3, error_kw={'linewidth': 1})
labels = [f'{lo}–{hi}\n(n={sum(r["phase"] == phase for r in pilot["costs"])})'
          for phase, (lo, hi) in enumerate(data['protocol']['strata'])]
ax.set(xticks=np.arange(4), xticklabels=labels, ylabel='Wall seconds per source (all frontier parents)',
       xlabel='Source occupied stratum', title='24-root pilot: mean complete-source cost; whiskers show measured range')
ax.legend(frameon=False, fontsize=9)
fig.text(.1, -.02, 'Engineering timing only. The experiment forecast uses cell maxima, rejection costs, 35% allowance and a reporting reserve.', fontsize=9)
fig.tight_layout(rect=(0, .1, 1, 1))
fig.texts[-1].set_position((.1, .01))
save(fig, 'residual-frontier-v1-20261028')

events = [json.loads(line) for line in (output / 'events.jsonl').read_text().splitlines() if line]
rows = [e for e in events if e['event'] == 'source-labeled' and e['stage'] == 'label-training']
fig, ax = plt.subplots(figsize=(10, 4.5))
if rows:
    origin = rows[0]['activeMinutes']
    x, y, maximum = [0.0], [0], 0
    for row in rows:
        maximum = max(maximum, row['completed'])
        x.append(row['activeMinutes']-origin)
        y.append(maximum)
    ax.plot(x, y, color=colors[0], linewidth=2)
    ax.scatter([x[-1]], [y[-1]], color=colors[0])
    ax.annotate(f'{y[-1]:,} complete sources', (x[-1], y[-1]), xytext=(-8, -18),
                textcoords='offset points', ha='right')
ax.axhline(1600, color='#64748b', linestyle='--', linewidth=1, label='Frozen target: 1,600')
ax.set(xlabel='Charged active labeling minutes (clean pauses excluded)', ylabel='Completed independent training sources',
       ylim=(0, 1700), title='First-session training collection; assessment and confirmation remain unopened')
ax.legend(frameon=False)
save(fig, 'residual-frontier-collection-v1-20261028')

fig, ax = plt.subplots(figsize=(7, 4.5))
before = [pilot['BTraining']['loss'], pilot['BDevelopment']['loss']]
after = [pilot['training']['loss'], pilot['development']['loss']]
x = np.arange(2)
ax.bar(x-.17, before, .32, color=colors[0], label='Unchanged B')
ax.bar(x+.17, after, .32, color=colors[2], label='Pilot correction')
for i, (b, a) in enumerate(zip(before, after)):
    ax.text(i, max(b, a)+.015, f'{100*(b-a)/b:.1f}% lower loss', ha='center')
ax.set(xticks=x, xticklabels=[f'Engineering training (n={pilot["training"]["sources"]})',
                             f'Engineering development (n={pilot["development"]["sources"]})'],
       ylabel='Source-mean preference loss', ylim=(0, max(before)*1.22),
       title='Pilot machinery check; no independent strength conclusion')
ax.legend(frameon=False)
save(fig, 'residual-frontier-pilot-loss-v1-20261028')
print('Three standalone SVG figures and local PNG previews written.')
