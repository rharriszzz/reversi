#!/usr/bin/env python3
"""Render bounded engineering benchmark results; optional matplotlib tooling."""
import argparse,json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
matplotlib.rcParams['svg.hashsalt']='reversi-exact-optimization-v1'
import matplotlib.pyplot as plt

def main():
    p=argparse.ArgumentParser();p.add_argument('evidence');p.add_argument('output');a=p.parse_args();e=json.load(open(a.evidence))
    fig,axes=plt.subplots(2,2,figsize=(11,8));groups=e['groups'];x=list(range(3))
    for shift,key,color,label in [(-.18,'original','#b45a4b','Original (timeout at 10 s)'),(.18,'optimized','#337baa','Optimized')]:
        axes[0,0].bar([v+shift for v in x],[g[key]['wallMedianMs'] for g in groups],.36,label=label,color=color)
        axes[0,1].bar([v+shift for v in x],[g[key]['wallMaxMs'] for g in groups],.36,label=label,color=color)
    for ax in axes[0]:ax.set_xticks(x,['8','10','12']);ax.set_yscale('log');ax.set_xlabel('Empty squares (12 fresh roots each)');ax.set_ylabel('Combined convention milliseconds (log)')
    axes[0,0].set_title('Median time per root');axes[0,0].legend(fontsize=8)
    axes[0,1].set_title('Maximum time per root');axes[0,1].axhline(10000,color='black',linestyle='--',label='Unchanged cap');axes[0,1].legend(fontsize=8)
    for g in groups:
        rows=[r for r in e['rows'] if r['id'].startswith('fresh') and r['empty']==g['empty']]
        axes[1,0].scatter([r['original']['wallMs'] for r in rows],[r['optimized']['wallMs'] for r in rows],label=f"{g['empty']} empties")
    axes[1,0].set_xscale('log');axes[1,0].set_yscale('log');axes[1,0].set(xlabel='Original milliseconds (capped at 10,000)',ylabel='Optimized milliseconds',title='Matched fresh roots');axes[1,0].legend(fontsize=8)
    ab=e['ablations'];labels=[('TT' if r['tt'] else 'No TT')+'\n'+('ordering' if r['ordering'] else 'no ordering') for r in ab]
    axes[1,1].bar(range(len(ab)),[r['nodes']/1e6 for r in ab],color='#337baa');axes[1,1].set_xticks(range(len(ab)),labels);axes[1,1].set(ylabel='Millions of visits, both conventions',title='Ablations on six fixed fresh roots + capped fixture')
    fig.suptitle('Independent exact solver engineering\nNo new teacher qualification or playing-strength claim')
    fig.tight_layout(rect=(0,0,1,.94));fig.savefig(a.output,**({'metadata':{'Date':None}} if a.output.endswith('.svg') else {}));plt.close(fig)
    if a.output.endswith('.svg'):
        p=Path(a.output);p.write_text('\n'.join(s.rstrip() for s in p.read_text().splitlines())+'\n')
if __name__=='__main__':main()
