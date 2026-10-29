#!/usr/bin/env python3
"""Standalone scientific SVG figures from audited numerical evidence."""
import json
from pathlib import Path
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
x=json.loads(Path(sys.argv[1]).read_text());destination=Path(sys.argv[2]);destination.mkdir(parents=True,exist_ok=True)
plt.rcParams.update({'font.size':10,'svg.fonttype':'none','axes.spines.top':False,'axes.spines.right':False,'svg.hashsalt':'next-residual-20261029'})
colors={'B':'#596579','L':'#087f8c','P':'#c66a12'}
fig,axes=plt.subplots(1,3,figsize=(12,4.2),constrained_layout=True)
selectors=['B','L'];names=list(x['models'])
for j,n in enumerate(names):
 base=[x['postOutcomeDiagnostics']['panels'][s]['totals'][n]['nonterminal'] for s in selectors]
 terminal=[x['postOutcomeDiagnostics']['panels'][s]['totals'][n]['terminalContaining'] for s in selectors]
 axes[0].bar(np.arange(2)+(j-1)*.23,base,width=.23,color=colors[n],label=n)
 axes[0].bar(np.arange(2)+(j-1)*.23,terminal,bottom=base,width=.23,color=colors[n],alpha=.25)
axes[0].set_xticks([0,1],['B-selected','L-selected']);axes[0].set_ylabel('Mean source preference loss');axes[0].set_title(f"Fixed assessment: {x['design']['sources']} sources\nPale: terminal-containing contribution");axes[0].legend(frameon=False)
for ax,d in zip(axes[1:],[4,6]):
 r=x['rootSummary'][str(d)];contrasts=['L-B']+(['P-L'] if 'P' in names else [])
 for i,c in enumerate(contrasts):
  q=r['intervals'][c];m=q['mean'];lo,hi=q['interval95'];ax.errorbar(i,m,yerr=[[m-lo],[hi-m]],fmt='o',color=colors[c.split('-')[0]],capsize=5)
 ax.axhline(0,color='#777',lw=1);ax.set_xticks(range(len(contrasts)),[c.replace('-',' − ') for c in contrasts]);ax.set_title(f"Depth {d}: {r['sources']} fixed roots");ax.set_ylabel('D12 regret difference (discs)')
fig.suptitle('PV independence qualification failed; all fixed sources retained',fontsize=11)
fig.supxlabel('Root panels: negative favors candidate; whole-source 95% bootstrap intervals',fontsize=9)
fig.savefig(destination/'next-residual-assessment-20261029.svg',metadata={'Date':None});fig.savefig('/tmp/reversi-next-assessment.png',dpi=140);plt.close(fig)
fig,axes=plt.subplots(1,2,figsize=(10,3.6),constrained_layout=True)
for j,n in enumerate(['B','L','P']):
 q=x['cost'][n];axes[0].bar(j-.15,q['staticNs']['False']/1000,.3,color=colors[n],alpha=.6);axes[0].bar(j+.15,q['staticNs']['True']/1000,.3,color=colors[n])
axes[0].set_xticks([0,1,2],['B','L','P']);axes[0].set_ylabel('Complete static evaluation (µs)');axes[0].set_title('16 old-development roots; five repetitions\nLight: no mobility hint; dark: known own mobility')
for n in ['L','P']:
 axes[1].plot([r['size'] for r in x['fit']['curves']],[r[n+'Development'] for r in x['fit']['curves']],'-o',label=n,color=colors[n])
axes[1].set_xlabel('Independent training-source prefix');axes[1].set_ylabel('Reused old-development preference loss');axes[1].set_title('Fixed architecture/selected λ; all fits converged\nP tables conditional on full-corpus frozen L');axes[1].legend(frameon=False)
fig.savefig(destination/'next-residual-cost-learning-20261029.svg',metadata={'Date':None});plt.close(fig)
co=json.loads((destination/'data/next-residual-coefficients-20261029.json').read_text());features=['mobility','potential','corners','xSquares','cSquares','frontier','discs']
fig,axes=plt.subplots(1,3,figsize=(10,4),constrained_layout=True)
for p,(ax,phase) in enumerate(zip(axes,['opening','middle','endgame'])):
 ax.barh(range(7),co['linearCorrections'][p*7:p*7+7],color=colors['L']);ax.axvline(0,color='#777',lw=1);ax.set_yticks(range(7),features);ax.invert_yaxis();ax.set_xlim(-105,105);ax.set_title(phase);ax.set_xlabel('Correction to original B weight')
fig.savefig(destination/'next-residual-corrections-20261029.svg',metadata={'Date':None});plt.close(fig)
if x['games']:
 conditions=x['games']['conditions'];fig,ax=plt.subplots(figsize=(7,3.5),constrained_layout=True)
 for i,(name,r) in enumerate(conditions.items()):
  q=r['bootstrap'];m=q['mean'];lo,hi=q['interval95'];ax.errorbar(i,m,yerr=[[m-lo],[hi-m]],fmt='o',capsize=6,color=colors['P' if name=='P80' else 'L'])
 ax.axhline(.5,color='#777',ls='--');ax.set_xticks(range(len(conditions)),[f"{n} ({r['pairs']} pairs)" for n,r in conditions.items()]);ax.set_ylim(0,1);ax.set_ylabel('Candidate game points / game');ax.set_title('Fixed equal-time games; opening-pair bootstrap 95% intervals\nPrimary claim requires both 97.5% lower bounds >50%')
 fig.savefig(destination/'next-residual-games-20261029.svg',metadata={'Date':None});plt.close(fig)
for artifact in destination.glob('next-residual-*-20261029.svg'):
 artifact.write_text('\n'.join(line.rstrip() for line in artifact.read_text().splitlines())+'\n')
print('Scientific SVG figures written')
