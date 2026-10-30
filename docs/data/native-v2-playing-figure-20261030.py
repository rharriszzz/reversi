#!/usr/bin/env python3
"""Plot the complete fixed sample only; no interim scoring or engine changes."""
import json,pathlib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT=pathlib.Path(__file__).resolve().parents[2]
r=json.loads((ROOT/'docs/data/native-v2-results-20261030.json').read_text())
assert r['complete'] and r['games']==2048
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False,'svg.fonttype':'none'})
fig,ax=plt.subplots(2,2,figsize=(12,8),layout='constrained');colors=['#2670a8','#cb6734']
for i,ms in enumerate([80,300]):
    s=r['statistics']['conditions'][str(ms)];m=s['mean']*100;lo,hi=[x*100 for x in s['approximate95']]
    ax[0,0].errorbar(i,m,yerr=[[m-lo],[hi-m]],fmt='o',capsize=6,color=colors[i],ms=8)
    ax[0,0].scatter(i,s['conservativeOneSided975Lower']*100,marker='v',s=65,color=colors[i])
    ax[0,0].annotate(f"{m:.2f}%\n{s['n']} families",(i,m),xytext=(12,0),textcoords='offset points',va='center')
ax[0,0].axhline(50,color='#666',ls='--',lw=1)
ax[0,0].set(xticks=[0,1],xticklabels=['80 ms','300 ms'],xlim=(-.4,1.7),ylabel='P game-point score (%)',title='Complete color-swapped families; Student 95% intervals')
ax[0,0].text(.02,.08,'Triangles: conservative one-sided 97.5% lower bounds',transform=ax[0,0].transAxes,fontsize=9,bbox=dict(facecolor='white',edgecolor='none',alpha=.9))
d=r['statistics']['difference'];m=d['mean']*100;lo,hi=[x*100 for x in d['interval95']]
ax[0,1].errorbar(m,0,xerr=[[m-lo],[hi-m]],fmt='o',capsize=6,color='#535b65',ms=8)
blo,bhi=[x*100 for x in d['bootstrap']['difference']['interval95']]
ax[0,1].plot([blo,bhi],[-.15,-.15],lw=4,color='#8babc5')
ax[0,1].axvline(0,color='#666',ls='--',lw=1)
ax[0,1].set(yticks=[0,-.15],yticklabels=['Student 95%','Bootstrap 95%'],ylim=(-.35,.25),xlabel='P score: 300 minus 80 ms (percentage points)',title='Matched 256 families; budgets jointly resampled')
for b,ms in enumerate([80,300]):
    for k,model in enumerate(['B','P']):
        xs=[next(x for x in r['telemetry'] if x['timeMs']==ms and x['model']==model and x['phase']==phase) for phase in ['opening','middle','endgame']]
        ax[1,0].plot(range(3),[x['meanDepth'] for x in xs],marker='o',ls='-' if ms==80 else '--',color=colors[k],label=f'{model}, {ms} ms')
        allrow=next(x for x in r['telemetry'] if x['timeMs']==ms and x['model']==model and x['phase']=='all')
        ax[1,1].bar(b+(k-.5)*.32,allrow['nodesPerSecond']/1e6,width=.29,color=colors[k],label=model if b==0 else None)
ax[1,0].set(xticks=range(3),xticklabels=['Opening','Middle','Endgame'],ylabel='Mean completed placement depth',title='Descriptive phase telemetry; exact late horizons shrink');ax[1,0].legend(frameon=False,ncol=2,fontsize=9)
ax[1,1].set(xticks=[0,1],xticklabels=['80 ms','300 ms'],ylabel='Million nodes / search second',title='Actual games: work rates on different played trees');ax[1,1].legend(frameon=False)
fig.suptitle('Native P versus native B — one frozen optimized engine, 2,048 games',fontsize=15)
svg=ROOT/'docs/native-v2-playing-20261030.svg';fig.savefig(svg);svg.write_text('\n'.join(l.rstrip() for l in svg.read_text().splitlines())+'\n')
fig.savefig(ROOT/'.local-research/native-v2-20261030/playing-figure.png',dpi=150)
