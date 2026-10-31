"""Publication figure from committed Mac data. Does not run a benchmark."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT=Path(__file__).resolve().parents[2]
data=json.loads((ROOT/'docs/data/fast-flips-mac/summary.json').read_text())
panels=['profile-root','exact12','mixed48','opening','middle','coaching']
labels=['Single twelve-empty root (1)','Independent exact panel (12)','Mixed panel (48)','Opening, depth 8 (4)','Middle, depth 7 (6)','All-move coaching, depth 6 (2)']
rows=[next(r for r in data['panels'] if r['workload']==p+'-P' and r['tag']=='refined') for p in panels]
gain=[-r['vsOriginal']['percent'] for r in rows]
errors=[[g+r['vsOriginal']['high'] for g,r in zip(gain,rows)],[-r['vsOriginal']['low']-g for g,r in zip(gain,rows)]]
plt.rcParams.update({'font.size':10,'svg.hashsalt':'reversi-fast-flips-m4'})
fig,ax=plt.subplots(figsize=(8.4,4.8));ax.barh(range(6),gain,xerr=errors,color='#326c9a',height=.6,capsize=3)
ax.set_yticks(range(6),labels);ax.invert_yaxis();ax.set_xlim(0,50);ax.set_xlabel('Complete search elapsed reduction (%)')
ax.spines[['top','right']].set_visible(False);ax.grid(axis='x',alpha=.2);ax.set_axisbelow(True)
for i,g in enumerate(gain):ax.text(g+1.2,i,f'{g:.1f}%',va='center')
fig.suptitle('M4 Mac · frozen P · original → ray/sentinel',fontsize=13)
fig.text(.5,.02,'Nine timing pairs; descriptive 95% intervals. Scores and all search/TT counters identical.',ha='center',fontsize=9)
fig.tight_layout(rect=(0,.06,1,.94));svg=ROOT/'docs/flip-optimization-mac.svg';fig.savefig(svg,metadata={'Date':None})
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
preview=ROOT/'.local-research/fast-flips-m4-20261031/figure-preview.png';fig.savefig(preview,dpi=150);print(preview)
