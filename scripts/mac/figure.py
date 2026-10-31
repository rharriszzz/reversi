"""Standalone scientific plots from committed compact evidence (Agg SVG)."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT=Path(__file__).resolve().parents[2];DATA=ROOT/'docs/data'
def main():
    r=json.loads((DATA/'mac-optimization-results-20261030.json').read_text())
    fig,axes=plt.subplots(1,3,figsize=(13,4),layout='constrained');colors=['#687787','#df9c43','#197d86']
    for ax,scope,title in zip(axes[:2],['all','exact'],['48-root complete search','12 exact roots']):
        rows=r['optimizationSummary'];labels=[];values=[];cs=[]
        for model in ['B','P']:
            for tag in ['baseline','initial','final']:
                row=next(x for x in rows if x['scope']==scope and x['model']==model and x['tag']==tag)
                labels.append(f'{model} {tag}');values.append(row['medianMs']);cs.append(colors[['baseline','initial','final'].index(tag)])
        ax.barh(labels,values,color=cs);ax.invert_yaxis();ax.set_xlabel('Median complete batch, ms');ax.set_title(title)
        for i,v in enumerate(values):ax.text(v,i,f' {v:.2f}',va='center',fontsize=8)
    ax=axes[2];perf=r['performance'];labels=[];values=[]
    for model in ['B','P']:
        for backend in ['candidate','wasm','javascript']:
            row=next(x for x in perf if x['model']==model and x['backend']==backend);labels.append(f'{model} '+{'candidate':'native','wasm':'Wasm','javascript':'JS'}[backend]);values.append(row['medianBatchMs'])
    ax.barh(labels,values,color=['#197d86','#518ac4','#9a73b8']*2);ax.invert_yaxis();ax.set_xscale('log');ax.set_xlabel('Median 8-root batch, ms (log scale)');ax.set_title('Actual Mac Chrome / native')
    for i,v in enumerate(values):ax.text(v,i,f' {v:.2f}',va='center',fontsize=8)
    fig.suptitle('M4 Reversi: measured complete searches; fixed horizons, serial rotated trials',fontsize=12)
    fig.savefig(ROOT/'docs/mac-search-optimization-20261030.svg');plt.close(fig)
    if r.get('backendAnalysis'):
        cs=r['backendAnalysis']['conditions'];fig,ax=plt.subplots(figsize=(6,3.5),layout='constrained')
        for i,row in enumerate(cs):
            interval=row['bootstrap']['score']['interval95'] if 'interval95' in row['bootstrap']['score'] else None
            # Use the explicitly named paired Student interval from the existing
            # validated pairSummary schema; bootstrap remains in the data table.
            interval=row.get('approximateTwoSided95') or row.get('approximate95')
            if interval is None:continue
            value=row['mean'];ax.errorbar(i,value,yerr=[[value-interval[0]],[interval[1]-value]],fmt='o',capsize=5,color='#197d86')
        ax.axhline(.5,color='gray',ls='--');ax.set_xticks(range(len(cs)),[str(x['budgetMs'])+' ms' for x in cs]);ax.set_ylabel('Native P points / game');ax.set_ylim(0,1);ax.set_title('Backend comparison: 64 paired opening families per budget')
        fig.savefig(ROOT/'docs/mac-backend-games-20261030.svg');plt.close(fig)
if __name__=='__main__':main()
