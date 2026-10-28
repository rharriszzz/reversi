#!/usr/bin/env python3
"""Reproduce the V4 report figure from audited receipts; optional matplotlib."""
import json,sys,statistics
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
matplotlib.rcParams['svg.hashsalt']='reversi-teacher-v4'
import matplotlib.pyplot as plt

e=json.load(open(sys.argv[1]));d=e['diagnostics'];fig,axs=plt.subplots(3,3,figsize=(14,12))
phases=['12–19','20–35','36–47','48–55'];cost=e['calibration']['cost'];depths=e['calibration']['depths']
for phase in range(4):
 axs[0,0].plot(depths,[statistics.mean(x['depths'][str(h)]['wallMs']/1000 for x in cost if x['phase']==phase) for h in depths],'o-',label=phases[phase])
axs[0,0].set(title='Complete calibration: all-alternative cost',xlabel='Depth',ylabel='Mean elapsed seconds',yscale='log');axs[0,0].legend(title='Occupied squares',fontsize=8)
axs[0,1].plot(depths,[sum(x['depths'][str(h)]['native']['userSeconds']+x['depths'][str(h)]['native']['systemSeconds'] for x in cost) for h in depths],'o-')
axs[0,1].set(title='Native CPU, complete calibration samples',xlabel='Depth',ylabel='Summed CPU seconds',yscale='log')
pairs=e['calibration']['pairs'];axs[0,2].bar([f"D{x['h']}→D{x['r']}" for x in pairs],[x['summary']['mean'] for x in pairs]);axs[0,2].axhline(.75,ls='--',color='red');axs[0,2].set(title='Calibration choice regret',ylabel='Estimated discs; limit 0.75')
records=(e.get('assessment') or e.get('partialAssessment') or {}).get('records',[]);H=(e.get('selection') or {}).get('h');R=(e.get('selection') or {}).get('r')
if records:
 groups=[(0,0),(1,1),(2,2),(3,3),(4,7),(8,128)];names=['0','1','2','3','4–7','≥8']
 for j,(field,label) in enumerate([('regret',f'Edax D{H}'),('bRegret','B d6')]):
  axs[1,0].bar([i+(j-.5)*.35 for i in range(6)],[sum(lo<=r[field]<=hi for r in records) for lo,hi in groups],width=.35,label=label)
 axs[1,0].set_xticks(range(6),names);axs[1,0].legend(fontsize=8);axs[1,0].set(title=f'Choice regret under D{R}; n={len(records)}',xlabel='Estimated disc regret',ylabel='Independent roots')
 for j,(field,label) in enumerate([('mean',f'Edax D{H}'),('bMeanRegret','B d6')]):
  axs[1,1].bar([i+(j-.5)*.35 for i in range(4)],[x['summary'][field] or 0 for x in d['byPhase']],width=.35,label=label)
 axs[1,1].set_xticks(range(4),phases);axs[1,1].legend(fontsize=8);axs[1,1].set(title=f'Phase regret under D{R}',xlabel='Occupied squares',ylabel='Mean estimated discs')
 for i,x in enumerate(d['byPhase']):
  s=x['summary'];r=s['rates']['useful'];rate=r['rate']
  if rate is not None:
   lo,hi=r['interval95'];axs[1,2].bar(i,100*rate,color='#4c78a8');axs[1,2].errorbar(i,100*rate,yerr=[[100*(rate-lo)],[100*(hi-rate)]],fmt='none',color='black',capsize=3);axs[1,2].text(i,100*hi+2,f"{s['useful']}/{s['n']}",ha='center',fontsize=8)
 axs[1,2].set_xticks(range(4),phases);axs[1,2].set(title='Useful corrections; Wilson 95% intervals',xlabel='Occupied squares',ylabel='Percent of roots',ylim=(0,100))
else:
 for ax in axs[1]:ax.text(.5,.5,'Assessment not opened',ha='center',va='center',transform=ax.transAxes)
exact=d['exactChoices']
if exact:
 for empty in [10,12]:
  rows=[x for x in exact if x['empty']==empty];ds=[6,8]+([10] if empty==12 else [])
  axs[2,0].plot(ds,[statistics.mean(x['conventions']['awarded']['choices'][f'D{h}']['regret'] for x in rows) for h in ds],'o-',label=f'{empty} empties (n={len(rows)})')
 axs[2,0].legend(fontsize=8);axs[2,0].set_xticks([6,8,10]);axs[2,0].set(title='Truncated-choice regret against exact',xlabel='Edax depth',ylabel='Mean exact awarded-disc regret')
 for j,empty in enumerate([10,12]):
  rows=[x for x in exact if x['empty']==empty]
  names=['D6','D8','D10','B6'];counts=[sum(x['conventions']['awarded']['choices'][name]['wdl'] in ['win-to-loss','win-to-draw','draw-to-loss'] for x in rows) if all(name in x['conventions']['awarded']['choices'] for x in rows) else None for name in names]
  for i,n in enumerate(counts):
   if n is not None:axs[2,1].bar(i+(j-.5)*.35,n,width=.35,color=['#4c78a8','#f58518'][j],label=f'{empty} empties' if i==0 else None)
 axs[2,1].set_xticks(range(4),names);axs[2,1].legend(fontsize=8);axs[2,1].set(title='Exact W/D/L decision errors',ylabel='Roots; D10 only at 12 empties')
else:
 for ax in axs[2,:2]:ax.text(.5,.5,'Independent exact assessment not opened',ha='center',va='center',transform=ax.transAxes)
f=d['forecast'];selected=f['selected']
if selected and f['actualRemainingWorkMs'] is not None:
 axs[2,2].bar(['Serial forecast','Forecast ×1.35','Observed stages'],[selected['forecastMs']/60000,1.35*selected['forecastMs']/60000,f['actualRemainingWorkMs']/60000],color=['#4c78a8','#72b7b2','#f58518']);axs[2,2].tick_params(axis='x',labelsize=8);axs[2,2].set(title='Reliability plus exact assessment time',ylabel='Minutes; final 20-minute reserve separate')
else:axs[2,2].text(.5,.5,'Complete forecast comparison unavailable',ha='center',va='center',transform=axs[2,2].transAxes)
fig.suptitle(('V4R1' if e['protocol'].get('revision') else 'V4')+' Edax qualification — '+e['status']+'\nHorizon estimates and mathematically exact endgame margins are distinct');fig.tight_layout(rect=(0,0,1,.94))
out=sys.argv[2];fig.savefig(out,**({'metadata':{'Date':None}} if out.endswith('.svg') else {}));plt.close(fig)
if out.endswith('.svg'):
 p=Path(out);p.write_text('\n'.join(x.rstrip() for x in p.read_text().splitlines())+'\n')
