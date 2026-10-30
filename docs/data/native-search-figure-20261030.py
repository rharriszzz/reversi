"""Rebuild compact native-engine figure; Matplotlib is reporting-only."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT/'docs/data'
games = json.loads((DATA/'native-search-results-20261030.json').read_text())
bench = json.loads((DATA/'native-search-benchmarks-r2-20261030.json').read_text())
plt.rcParams.update({'svg.hashsalt':'native-search-v1','font.size':9,'axes.spines.top':False,
                     'axes.spines.right':False,'font.family':'DejaVu Sans'})
fig, axes = plt.subplots(1, 3, figsize=(14, 4.4), gridspec_kw={'width_ratios':[1, 1.4, 1.5]})
ax = axes[0]
for i, budget in enumerate((80, 300)):
    s = games['statistics']['conditions'][str(budget)]
    mean = s['mean']*100
    lo, hi = [x*100 for x in s['approximate95']]
    ax.errorbar(i, mean, yerr=[[mean-lo], [hi-mean]], fmt='o', color='#1468a0', capsize=5, ms=8)
    ax.annotate(f'{mean:.1f}%', (i, mean), xytext=(12, 0), textcoords='offset points', va='center')
ax.axhline(50, color='#666', ls='--', lw=1)
ax.set(xticks=[0, 1], xticklabels=['80 ms\n256 pairs','300 ms\n128 pairs'], xlim=(-.5, 1.6),
       ylim=(0, 100), ylabel='Native P game-point score (%)', title='Equal-time engineering games')
ax.text(.5, -.25, 'Paired Student 95% intervals; 768 games', transform=ax.transAxes, ha='center', fontsize=8)
ax = axes[1]
labels = []
for j, (budget, phase) in enumerate(((80,'opening'),(80,'middle'),(300,'opening'),(300,'middle'))):
    labels.append(f'{phase.title()}\n{budget} ms')
    for backend, offset, color in [('javascript',-.17,'#8b969f'),('native',.17,'#1468a0')]:
        row = next(r for r in bench['summary']['timed'] if r['model']=='P' and r['timeMs']==budget
                   and r['phase']==phase and r['backend']==backend)
        ax.bar(j+offset, row['meanDepth'], width=.32, color=color, label=backend if j==0 else None)
        ax.text(j+offset, row['meanDepth']+.15, f"{row['meanDepth']:.1f}", ha='center', fontsize=8)
ax.set(xticks=range(4), xticklabels=labels, ylim=(0,14), ylabel='Mean completed placement depth',
       title='Same disclosed fixed roots, frozen P')
ax.legend(['JavaScript','Native C++'], frameon=False, loc='upper left', fontsize=8)
ax.text(.5, -.25, 'Two opening / three middle roots, five repetitions', transform=ax.transAxes, ha='center', fontsize=8)
ax = axes[2]
colors = {'Search/TT/order':'#66717c','Patterns':'#df8a32','Legal moves':'#51a276',
          'Flips':'#b7656a','Seven features':'#9474ad','Other / interface':'#d8dce0'}
for i, phase in enumerate(('opening','middle','endgame')):
    row = next(r for r in bench['summary']['profiles'] if r['tag']=='final' and r['phase']==phase)
    totals = {k:0. for k in colors}
    for entry in row['top']:
        name = entry['symbol']
        category = ('Patterns' if 'patternSum' in name else 'Legal moves' if 'reversi::legal(' in name
                    else 'Flips' if 'reversi::flips(' in name else 'Seven features' if 'reversi::features(' in name
                    else 'Search/TT/order' if 'reversi::Engine::' in name else 'Other / interface')
        totals[category] += 100*entry['fraction']
    totals['Other / interface'] += 100-sum(totals.values())
    left = 0
    for category, value in totals.items():
        ax.barh(i, value, left=left, color=colors[category], label=category if i==0 else None)
        left += value
ax.set(yticks=range(3), yticklabels=['Opening','Middle','Late endgame'], xlim=(0,100),
       xlabel='Optimized native process self samples (%)', title='Remaining CPU work')
ax.invert_yaxis()
ax.legend(frameon=False, fontsize=7, loc='upper center', bbox_to_anchor=(.5,-.18), ncol=2)
fig.suptitle('Reversi: faster complete searches with unchanged frozen positional knowledge', fontsize=13)
fig.subplots_adjust(left=.055,right=.985,top=.84,bottom=.27,wspace=.35)
fig.savefig(ROOT/'docs/native-search-20261030.svg', metadata={'Date':None})
fig.savefig(ROOT/'.local-research/native-engine-20261030-r2/final-figure.png', dpi=150)
