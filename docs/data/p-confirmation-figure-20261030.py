#!/usr/bin/env python3
"""Static publication figure; statistical bounds do not override the provenance gate."""
import json, os, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'.local-research/p-independent-confirmation-v1-20261029'
os.environ.setdefault('MPLCONFIGDIR',str(OUT/'matplotlib'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
s=json.loads((OUT/'summary.json').read_text());fig,axes=plt.subplots(1,2,figsize=(10,4.3),layout='constrained')
fig.suptitle('Frozen P confirmation: historical-target separation gate failed',fontsize=13)
for i,b in enumerate(['80','300']):
    d=s['statistics']['scores'][b];lo,hi=d['approximate95']
    axes[0].errorbar(i,d['mean']*100,yerr=[[100*(d['mean']-lo)],[100*(hi-d['mean'])]],fmt='o',capsize=5,color='#225b99')
    axes[0].scatter(i+.12,d['conservativeOneSided975Lower']*100,marker='v',color='#b86022')
axes[0].axhline(50,color='gray',ls='--')
axes[0].set(xticks=[0,1],xticklabels=['80 ms / 768 pairs','300 ms / 256 pairs'],ylabel='P game points (%)',title='Equal elapsed search time')
handles=[Line2D([0],[0],color='#225b99',marker='o',label='Approximate paired 95% interval'),Line2D([0],[0],color='#b86022',marker='v',linestyle='',label='97.5% Hoeffding lower bound')]
axes[0].legend(handles=handles,loc='lower left',bbox_to_anchor=(.01,.10),fontsize=8,frameon=True,framealpha=1)
d=s['statistics']['difference'];lo,hi=d['interval95']
axes[1].errorbar(0,100*d['mean'],yerr=[[100*(d['mean']-lo)],[100*(hi-d['mean'])]],fmt='o',capsize=5,color='#225b99')
axes[1].axhline(0,color='gray',ls='--');axes[1].set(xticks=[0],xticklabels=['Same 256 families'],ylabel='300 minus 80 ms (percentage points)',title='Matched budget contrast (descriptive)')
fig.savefig(ROOT/'docs/p-confirmation-20261029.svg');fig.savefig(OUT/'p-confirmation-qa-final.png',dpi=160);plt.close(fig)
