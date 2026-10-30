"""Static scientific figure from published measured evidence; matplotlib only."""
from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
x=json.loads((ROOT/'docs/data/wasm-engine-results-20261030.json').read_text())
fig,axes=plt.subplots(2,2,figsize=(11,7.5),constrained_layout=True)
colors=['#235b45','#488eae','#b97335'];tags=['native','wasm','javascript'];labels=['Native ARM64','Browser Wasm','Original JS']
for ax,key,title,ylabel in [(axes[0,0],'medianBatchMs','Complete fixed-search batch (5 repetitions)','milliseconds; logarithmic scale'),(axes[0,1],'medianStaticNs','Complete static evaluation','ns / evaluation; logarithmic scale')]:
 for i,(tag,label,color) in enumerate(zip(tags,labels,colors)):
  vals=[next(r[key] for r in x['performance'] if r['model']==m and r['backend']==tag) for m in ['B','P']]
  bars=ax.bar(np.arange(2)+(i-1)*.23,vals,.23,label=label,color=color)
  for b,v in zip(bars,vals):ax.text(b.get_x()+b.get_width()/2,v*1.08,f'{v:.1f}',ha='center',fontsize=8)
 ax.set_yscale('log');ax.set_ylim(min(r[key] for r in x['performance'])*.7,max(r[key] for r in x['performance'])*1.5);ax.set_xticks([0,1],['B','P']);ax.set_ylabel(ylabel);ax.set_title(title);ax.legend(fontsize=8)
ax=axes[1,0]
vals={'Baseline':[100,100],'Two-way TT':[112.24,110.24],'Pass mobility':[100.46,100.37],'Combined':[112.07,109.52]}
for i,(label,v) in enumerate(vals.items()):ax.bar(np.arange(2)+(i-1.5)*.19,v,.19,label=label)
ax.set_xticks([0,1],['B','P']);ax.set_ylim(90,118);ax.axhline(100,color='#333',linewidth=.8);ax.set_ylabel('elapsed time / baseline (%)');ax.set_title('Native experiments: both reverted');ax.legend(fontsize=8)
b=json.loads((ROOT/'docs/data/wasm-browser-benchmarks-20261030.json').read_text());ax=axes[1,1];categories=['Search / inlined rules','Legal generation','Linear features','Patterns','Other']
shares=[]
for r in b['profiles']:
 totals=[0]*5
 for name,count in r['selfSamples'].items():
  k=0 if 'Engine::' in name else 1 if 'reversi::legal' in name else 2 if 'reversi::features' in name else 3 if 'patternSum' in name else 4
  totals[k]+=count
 shares.append(np.array(totals)/r['totalSamples']*100)
bottom=np.zeros(3)
for i,c in enumerate(categories):
 val=[s[i] for s in shares];ax.bar(['Opening','Middle','Exact endgame'],val,bottom=bottom,label=c);bottom+=val
ax.set_ylabel('self samples (%)');ax.set_title('Actual Wasm worker CPU profiles');ax.legend(fontsize=7,loc='upper center',bbox_to_anchor=(.5,-.14),ncol=2,frameon=False)
fig.suptitle('M4 iMac • Chromium 156 • unchanged frozen B/P • engineering measurements',fontsize=13)
fig.savefig(ROOT/'docs/wasm-engine-results-20261030.svg')

fig.savefig(ROOT/'.local-research/wasm-20261030/figure.png',dpi=150)
