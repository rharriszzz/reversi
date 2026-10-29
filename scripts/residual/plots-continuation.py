#!/usr/bin/env python3
"""Standalone final figures from audited compact evidence; optional plotting deps."""
import json
from pathlib import Path
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

output, root = map(Path, sys.argv[1:3])
data = json.loads((root / 'docs/data/residual-frontier-final-20261028.json').read_text())
plt.rcParams.update({'svg.fonttype': 'none', 'font.size': 10, 'axes.spines.top': False,
                     'axes.spines.right': False, 'figure.facecolor': 'white',
                     'svg.hashsalt': 'reversi-residual-final'})
local = output / 'publication'
local.mkdir(exist_ok=True)


def save(fig, name):
    fig.tight_layout()
    target = root / 'docs' / f'{name}.svg'
    fig.savefig(target, bbox_inches='tight', metadata={'Date': None})
    target.write_text('\n'.join(line.rstrip() for line in target.read_text().splitlines()) + '\n')
    fig.savefig(local / f'{name}.png', dpi=130, bbox_inches='tight')
    plt.close(fig)


curve = data.get('learningCurve')
if curve:
    rows = curve['curve']
    fig, ax = plt.subplots(figsize=(8, 4.5))
    for key, label, color in [('training', 'Training (changing prefix)', '#325fa8'),
                              ('development', 'Development (fixed 400)', '#d77a2b')]:
        ax.plot([r['size'] for r in rows], [r[key]['loss'] for r in rows], 'o-', label=label, color=color)
    ax.axhline(data['fit']['BDevelopment']['loss'], color='#d77a2b', linestyle='--', label='B on development')
    ax.axhline(data['fit']['BTraining']['loss'], color='#325fa8', linestyle=':', label='B on full training')
    ax.set(xscale='log', xticks=[r['size'] for r in rows],
           xticklabels=[str(r['size']) for r in rows], xlabel='Independent training sources',
           ylabel='Source-mean preference loss', title=f"Frozen learning curve; selected λ = {curve['lambda']}")
    ax.legend(frameon=False, fontsize=9)
    save(fig, 'residual-frontier-final-learning-20261028')

assessment = data.get('assessment')
if assessment:
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    names = ['Training', 'Development', 'Locked assessment']
    before = [data['fit']['BTraining']['loss'], data['fit']['BDevelopment']['loss'], assessment['B']['loss']]
    after = [data['fit']['training']['loss'], data['fit']['development']['loss'], assessment['candidate']['loss']]
    xs = np.arange(3)
    axes[0].bar(xs-.17, before, .32, label='B', color='#325fa8')
    axes[0].bar(xs+.17, after, .32, label='Frozen correction', color='#d77a2b')
    axes[0].set(xticks=xs, xticklabels=names, ylabel='Source-mean preference loss', title='Independent frontier preference assessment')
    axes[0].set_ylim(0, max(before)*1.25)
    axes[0].tick_params(axis='x', labelsize=9)
    axes[0].legend(frameon=False)
    for i, (b, c) in enumerate(zip(before, after)):
        axes[0].text(i, max(b, c)+.008, f'{100*(b-c)/b:.2f}% lower', ha='center', fontsize=9)
    for i, depth in enumerate(['4', '6']):
        row = assessment['rootIntervals'][depth]
        lo, hi = row['interval95']
        mean = row['mean']
        axes[1].errorbar(i, mean, yerr=[[mean-lo], [hi-mean]], fmt='o', capsize=5, color='#278577')
    axes[1].axhline(0, color='#64748b', linestyle='--')
    axes[1].set(xticks=[0, 1], xticklabels=['Depth four', 'Depth six'], xlim=(-.5, 1.5),
                ylabel='Candidate − B D12-relative root regret (estimated discs)',
                title='128 reserved roots; stratified source-bootstrap 95% intervals')
    save(fig, 'residual-frontier-final-assessment-20261028')

if data.get('fit'):
    corrections = data['fit']['corrections']
    values = np.array([r['correction'] for r in corrections]).reshape(3, 7)
    fig, ax = plt.subplots(figsize=(10, 3.5))
    bound = max(abs(values).max(), 1)
    im = ax.imshow(values, cmap='RdBu_r', vmin=-bound, vmax=bound, aspect='auto')
    ax.set(xticks=range(7), xticklabels=[r['feature'] for r in corrections[:7]],
           yticks=range(3), yticklabels=['Opening', 'Middle', 'Endgame'],
           title='Frozen 21 corrections in original B weight units')
    for i in range(3):
        for j in range(7):
            ax.text(j, i, f'{values[i, j]:+.3f}', ha='center', va='center',
                    color='white' if abs(values[i, j]) > bound*.6 else '#111827', fontsize=9)
    fig.colorbar(im, ax=ax, label='Correction')
    save(fig, 'residual-frontier-final-corrections-20261028')

print('Final SVG figures and local PNG previews written.')
