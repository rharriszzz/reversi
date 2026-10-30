#!/usr/bin/env python3
"""Standalone scientific performance figure; Matplotlib is reporting-only."""
import json,pathlib,statistics
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[2]
r=json.loads((ROOT/'docs/data/native-v2-engineering-20261030.json').read_text())
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False,'svg.fonttype':'none'})
fig,ax=plt.subplots(2,2,figsize=(12,8),layout='constrained')
colors=['#2670a8','#cb6734']
for i,model in enumerate(['B','P']):
    rows=[x for x in r['benchmarks'] if x['model']==model]
    ratios=[]
    for rep in range(7):
        xs=[x for x in rows if x['rep']==rep]
        ratios.append(sum(x['baseline']['search']['elapsedMs'] for x in xs)/sum(x['current']['search']['elapsedMs'] for x in xs))
    ax[0,0].scatter([i+(j-3)*.035 for j in range(7)],ratios,color=colors[i],s=28)
    ax[0,0].plot([i-.18,i+.18],[statistics.median(ratios)]*2,color=colors[i],lw=3)
    for j,side in enumerate(['baseline','current']):
        ns=statistics.mean(statistics.median(x[side]['evaluation']['elapsedMs']*1e6/x[side]['evaluation']['evaluations'] for x in rows if x['position']==p) for p in set(x['position'] for x in rows))
        ax[0,1].bar(i+(j-.5)*.33,ns,width=.29,color=colors[i],alpha=1 if j else .35,label=side if i==0 else None)
ax[0,0].axhline(1,color='#777',ls='--',lw=1)
ax[0,0].set(xticks=[0,1],xticklabels=['B','P'],ylabel='Baseline time / improved time',title='Complete searches: seven matched batches')
ax[0,1].set(xticks=[0,1],xticklabels=['B','P'],ylabel='Nanoseconds / complete static evaluation',title='Full feature extraction and pattern evaluation');ax[0,1].legend(frameon=False)
parts=['Search / TT / order','Legal','Flips','Linear features','Patterns','Other / protocol']
profile_colors=['#575c68','#4b9dc4','#78b3a6','#c0b15d','#d17844','#d8dadd']
for i,(phase,tag) in enumerate((p,t) for p in ['opening','middle','endgame'] for t in ['baseline','final']):
    rows=r['profiles']['selfSamples'][f'{tag}-{phase}'];sums=[0]*6
    for x in rows:
        f=x['function'];k=0 if 'Engine::' in f else 1 if '::legal' in f else 2 if '::flips' in f else 3 if '::features' in f or '::evaluate' in f else 4 if '::pattern' in f else 5;sums[k]+=x['samples']
    total=sum(sums);bottom=0
    for k,n in enumerate(sums):ax[1,0].bar(i,n/total*100,bottom=bottom,color=profile_colors[k],width=.72,label=parts[k] if i==0 else None);bottom+=n/total*100
ax[1,0].set(xticks=range(6),xticklabels=['Old\nopen','V2\nopen','Old\nmid','V2\nmid','Old\nlate','V2\nlate'],ylabel='Self samples (%)',title='Optimized sampling (includes waits/protocol)');ax[1,0].legend(fontsize=8,frameon=False,ncol=2,loc='upper left',bbox_to_anchor=(0,-.18))
for i,model in enumerate(['B','P']):
    xs=[x for x in r['timed'] if x['model']==model and x['timeMs']==300]
    stopped=sum(x['capped']['depth']==14 and not x['capped']['exact'] and not x['capped']['timedOut'] for x in xs)
    deeper=sum(x['uncapped']['depth']>14 for x in xs)
    ax[1,1].bar(i-.17,stopped,width=.3,color=colors[i],alpha=.35,label='Stopped at old ceiling' if i==0 else None)
    ax[1,1].bar(i+.17,deeper,width=.3,color=colors[i],label='Completed beyond 14' if i==0 else None)
ax[1,1].set(xticks=[0,1],xticklabels=['B','P'],ylabel='Trials out of 108 per model',title='Natural depth limit at 300 ms');ax[1,1].legend(frameon=False,fontsize=9)
fig.suptitle('Native search V2 — M4, frozen evaluators, qualified engineering work',fontsize=15)
fig.savefig(ROOT/'docs/native-v2-engineering-20261030.svg')
fig.savefig(ROOT/'.local-research/native-v2-20261030/engineering-figure.png',dpi=150)

svg=ROOT/'docs/native-v2-engineering-20261030.svg'
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
