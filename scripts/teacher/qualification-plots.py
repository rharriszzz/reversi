#!/usr/bin/env python3
"""Render compact qualification evidence; matplotlib is optional offline tooling."""
import argparse,json,statistics
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
matplotlib.rcParams['svg.hashsalt']='reversi-teacher-qualification-v1'
import matplotlib.pyplot as plt

def main():
    p=argparse.ArgumentParser();p.add_argument('evidence');p.add_argument('output');a=p.parse_args()
    e=json.load(open(a.evidence));fig,axes=plt.subplots(2,3,figsize=(14,8));cost=(e.get('calibration') or {}).get('cost',[])
    depths=sorted({int(d) for row in cost for d in row['depths'] if int(d)%2==0})
    if depths:
        for phase in range(4):
            axes[0,0].plot(depths,[statistics.mean(row['depths'][str(d)]['wallMs']/1000 for row in cost if row['phase']==phase and str(d) in row['depths']) for d in depths],marker='o',label=['12–19','20–35','36–47','48–55'][phase])
        axes[0,0].set_xticks(depths);axes[0,1].set_xticks(depths);axes[0,0].set_yscale('log');axes[0,0].legend(title='Occupied',fontsize=8)
        means=[statistics.mean(row['depths'][str(d)]['native']['userSeconds']+row['depths'][str(d)]['native']['systemSeconds'] for row in cost if str(d) in row['depths']) for d in depths]
        axes[0,1].plot(depths,means,marker='o');axes[0,1].set_yscale('log')
    axes[0,0].set(title='All-alternative cost by phase',xlabel='Depth',ylabel='Mean wall seconds (log)')
    axes[0,1].set(title='Native CPU per root',xlabel='Depth',ylabel='Mean busy-core seconds (log)')
    pairs=(e.get('calibration') or {}).get('pairs',[])
    if pairs:
        names=[f"{x['h']}→{x['r']}" for x in pairs]
        axes[0,2].bar(names,[x['summary']['mean'] for x in pairs]);axes[0,2].axhline(.75,color='red',linestyle='--',label='calibration limit');axes[0,2].legend(fontsize=8)
        axes[1,0].plot(names,[100*x['summary']['choiceStable']/x['summary']['n'] for x in pairs],marker='o',label='Same best choice')
        axes[1,0].plot(names,[100*x['summary']['within2']/x['summary']['n'] for x in pairs],marker='o',label='Within 2 estimated discs');axes[1,0].legend(fontsize=8)
    axes[0,2].set(title='Calibration choice regret',ylabel='Estimated Edax discs')
    axes[1,0].set(title='Choice stability versus near-best coverage',ylabel='Percent',ylim=(0,105))
    partial=e.get('partialAssessment');assessment=e.get('assessment') or partial
    if assessment:
        phases=assessment['byPhase'];present=[i for i,x in enumerate(phases) if x['n']]
        axes[1,1].bar([i-.17 for i in present],[phases[i]['mean'] for i in present],width=.34,label='D10 choice')
        axes[1,1].bar([i+.17 for i in present],[phases[i]['bMeanRegret'] for i in present],width=.34,label='B d6 choice');axes[1,1].legend(fontsize=8)
        for ax in axes[1,1:]: ax.set_xlim(-.6,3.6);ax.set_xticks(range(4),[f"{name}\nn={x['n']}/64" for name,x in zip(['12–19','20–35','36–47','48–55'],phases)])
        axes[1,2].bar(present,[100*phases[i]['useful']/phases[i]['n'] for i in present])
        for i,x in enumerate(phases):
            if not x['n']:
                for ax in axes[1,1:]:ax.text(i,.05,'not queried',ha='center',fontsize=8,transform=ax.get_xaxis_transform())
    else:
        if pairs:
            phases=pairs[0].get('byPhase',[])
            if phases:
                axes[1,1].bar(range(4),[x['mean'] for x in phases]);axes[1,1].set_xticks(range(4),['12–19','20–35','36–47','48–55'])
        axes[1,2].text(.5,.5,'B d6 assessment not opened\nYield not measured',ha='center',va='center',transform=axes[1,2].transAxes)
    axes[1,1].set(title=('Partial assessment regret under D12' if partial else 'Assessment regret by phase') if assessment else 'Calibration D10→D12 regret by phase (6 roots each)',xlabel='Occupied',ylabel='Estimated Edax discs')
    axes[1,2].set(title=('Partial useful disagreements with B d6' if partial else 'Robust useful disagreements with B d6'),xlabel='Occupied',ylabel='Percent of independent roots')
    fig.suptitle('Deeper Edax qualification — '+e['status']+('\nIncomplete sample: 154/256 reliability, 0/64 exact assessment' if partial else '\nHorizon agreement is not exact minimax correctness'))
    fig.tight_layout(rect=(0,0,1,.93));fig.savefig(a.output,**({'metadata':{'Date':None}} if a.output.endswith('.svg') else {}));plt.close(fig)
    if a.output.endswith('.svg'):
        path=Path(a.output);path.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines())+'\n')
if __name__=='__main__':main()
