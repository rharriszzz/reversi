#!/usr/bin/env python3
"""Offline engineering figure; matplotlib is not a playing dependency."""
import sys,json,pathlib
import matplotlib
matplotlib.use('Agg');matplotlib.rcParams['svg.hashsalt']='reversi-edax-bound-v1'
import matplotlib.pyplot as plt
r=json.load(open(sys.argv[1]));out=sys.argv[2];fig,axes=plt.subplots(2,2,figsize=(11,7));phases=['12–19','20–35','36–47','48–55'];colors=['#4c78a8','#f58518']
for j,kind in enumerate(['original','fixed']):
 x=[i+(j-.5)*.32 for i in range(4)];rows=[p[kind] for p in r['metrics']['byPhase']]
 axes[0,0].bar(x,[p['wallMeanMs'] for p in rows],width=.32,label=kind,color=colors[j]);axes[0,1].bar(x,[p['cpuMeanMs'] for p in rows],width=.32,label=kind,color=colors[j])
for ax,title,y in [(axes[0,0],'Matched full-window root query cost','Mean elapsed ms'),(axes[0,1],'Actual native child CPU','Mean CPU ms')]:ax.set_xticks(range(4),phases);ax.set(xlabel='Occupied squares; 32 root/depth queries per group',ylabel=y,title=title);ax.legend()
old=[p['original']['wallMs'] for p in r['failurePairs']];fixed=[p['fixed']['wallMs'] for p in r['failurePairs']]
axes[1,0].plot(range(1,6),old,'o-',label='pinned: rejected bound');axes[1,0].plot(range(1,6),fixed,'o-',label='fixed: complete value');axes[1,0].set(title='Disclosed failure: five complete-query trials',xlabel='Paired trial',ylabel='Elapsed ms');axes[1,0].legend(fontsize=8)
changed=len(r['changed']);axes[1,1].bar([0,1],[100*(128-changed)/128,100],label='Unchanged',color=colors[0]);axes[1,1].bar([0,1],[100*changed/128,0],bottom=[100*(128-changed)/128,100],label='Independently verified correction',color=colors[1]);axes[1,1].set_xticks([0,1],['Fresh development\n128 root/depth queries','Disclosed V3 regression\n308 root/depth queries']);axes[1,1].set(title='All-alternative value comparison',ylabel='Percent',ylim=(0,112));axes[1,1].legend(fontsize=8,loc='lower center');axes[1,1].text(0,103,'1 changed query; 3 corrected alternatives',ha='center',fontsize=8)
fig.suptitle('Edax interface engineering — independent V4 prepared, not assessed\nApproximate horizon values remain distinct from exact endgame margins');fig.tight_layout(rect=(0,0,1,.91));fig.savefig(out,**({'metadata':{'Date':None}} if out.endswith('.svg') else {}));plt.close(fig)
if out.endswith('.svg'):
 p=pathlib.Path(out);p.write_text('\n'.join(x.rstrip() for x in p.read_text().splitlines())+'\n')
