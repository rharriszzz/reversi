"""Make compact, versioned evidence and a standard Matplotlib figure.

Usage: python3 scripts/summarize-comparison.py /tmp/reversi-r3 docs/data/evaluator-comparison.json docs/evaluator-comparison.svg [preview.png]
Matplotlib is optional documentation tooling, never needed to play or test.
"""
from collections import Counter
from pathlib import Path
import json
import math
import random
import statistics
import sys


def quantile(values, fraction):
    ordered = sorted(values)
    return ordered[max(0,min(len(ordered)-1,math.ceil(len(ordered)*fraction)-1))]


def move_summary(stats):
    times = [s['elapsedMs'] for s in stats]
    overruns = [max(0, s['elapsedMs']-s['budgetMs']) for s in stats]
    elapsed = sum(times)
    return {
        'moves':len(stats), 'depthHistogram':dict(sorted(Counter(s['depth'] for s in stats).items())),
        'medianDepth':statistics.median(s['depth'] for s in stats),
        'nodes':sum(s['nodes'] for s in stats), 'evaluations':sum(s['evaluations'] for s in stats),
        'totalSearchMs':elapsed, 'medianElapsedMs':statistics.median(times),
        'meanElapsedMs':statistics.mean(times), 'p95ElapsedMs':quantile(times, 0.95),
        'nodesPerSecond':sum(s['nodes'] for s in stats)*1000/elapsed,
        'evaluationsPerSecond':sum(s['evaluations'] for s in stats)*1000/elapsed,
        'meanOverrunMs':statistics.mean(overruns), 'p95OverrunMs':quantile(overruns, 0.95),
        'maxOverrunMs':max(overruns), 'overrunsAbove1ms':sum(v>1 for v in overruns),
        'unsearchedFallbacks':sum(s['depth']==0 for s in stats),
    }


def main():
    prefix, json_output, plot_output = sys.argv[1:4]
    load = lambda suffix: json.loads(Path(prefix+'-'+suffix+'.json').read_text())
    selection, quality, cost, fixed, timed = [load(s) for s in ['selection','quality','cost','fixed','timed']]
    assert timed['complete'] == all(j['complete'] for j in timed['jobs'])
    assert selection['reservedFinalQualityKeys'] == [p['key'] for p in quality['positions']]
    assert selection['reservedFinalGameKeys'] == timed['openingKeys']
    # Entire evidence is frozen before any summary. Bootstrap here describes
    # paired positional regret uncertainty; it is not a selection procedure.
    rng = random.Random(31029919)
    differences = []
    late = [p for p in quality['positions'] if p['phase']=='late']
    for depth in [1,3]:
        delta = []
        for p in late:
            rows = {c['name']:c for c in p['choices'] if c['depth']==depth}
            delta.append(rows['C']['regret']-rows['B']['regret'])
        boot = [statistics.mean(rng.choices(delta, k=len(delta))) for _ in range(4000)]
        differences.append({'depth':depth, 'CminusBMeanDiscRegret':statistics.mean(delta),
                            'pairedBootstrap95':[quantile(boot,.025),quantile(boot,.975)],
                            'positions':len(delta),'bootstrapSeed':31029919,'bootstrapSamples':4000})
    matches = []
    for job in timed['jobs']:
        candidate, opponent = [], []
        wins = draws = losses = 0
        for game in job['games']:
            own = 'black' if game['candidateColor']==1 else 'white'
            other = 'white' if own=='black' else 'black'
            candidate.extend(game['stats'][own]); opponent.extend(game['stats'][other])
            if game['outcome']>0: wins+=1
            elif game['outcome']<0: losses+=1
            else: draws+=1
        # Uniform over every possible capped prefix and all six conditions.
        # This accounts conservatively for outcome-correlated game duration
        # influencing the sample count at a wall-clock stop.
        radius=math.sqrt(math.log(2*selection['protocol']['finalPairs']*len(timed['jobs'])/.05)/(2*job['openingPairs']))
        cap_interval=[max(0,job['scoreRate']-radius),min(1,job['scoreRate']+radius)]
        matches.append({key:job[key] for key in ['candidate','opponent','timeMs','openingPairs','scoreRate','interval95','complete','pairPoints']}
                       | {'capAndComparisonsInterval95':cap_interval,'wins':wins,'draws':draws,'losses':losses,
                          'candidateMetrics':move_summary(candidate),'opponentMetrics':move_summary(opponent)})
    fixed_result = fixed['results'][0]
    summary = {
        'protocol':selection['protocol'],'selectedWeight':selection['selectedWeight'],
        'developmentGrid':selection['grid'],
        'selection':[{'weight':s['weight'],'scoreRate':s['games']['scoreRate'],
                      'wins':s['games']['wins'],'draws':s['games']['draws'],'losses':s['games']['losses']}
                     for s in selection['shortlist']],
        'quality':quality['summary'],'lateRegretDifferences':differences,
        'staticCosts':cost['costs'],'matchedFixedDepthSearch':cost['search'],
        'fixedDepthGameResult':{k:fixed_result[k] for k in ['wins','draws','losses','openingPairs','scoreRate','interval95','pairPoints']},
        'timed':matches,'timedComplete':timed['complete'],'timedElapsedSeconds':timed['elapsedMs']/1000,
        'timedIntervalMethod':'Hoeffding; also uniform over all 32 possible prefix counts and six comparisons at familywise alpha 0.05. Assumes representative independent opening-pair samples; host drift remains a limitation.',
        'reservedFinalGameKeys':selection['reservedFinalGameKeys'],
        'reservedFinalQualityKeys':selection['reservedFinalQualityKeys'],
    }
    Path(json_output).parent.mkdir(parents=True, exist_ok=True)
    Path(json_output).write_text(json.dumps(summary,indent=2)+'\n')

    import matplotlib
    matplotlib.use('Agg')
    matplotlib.rcParams['svg.hashsalt']='reversi-evaluator-comparison-v1'
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(1,2,figsize=(12,4.8),layout='constrained')
    colors={'A':'#777777','B':'#147a58','C':'#b56524'}
    for name in ['A','B','C']:
        latency=next(c['microseconds'] for c in cost['costs'] if c['plies']==52 and c['name']==name)
        regret=next(c['meanRegret'] for c in quality['summary'] if c['phase']=='late' and c['name']==name and c['depth']==3)
        axes[0].scatter(latency,regret,color=colors[name],s=90,zorder=3)
        axes[0].annotate({'A':'A: original','B':'B: same math, faster','C':'C: tuned stable edges'}[name],
                         (latency,regret),xytext=(6,-16 if name=='B' else 9),textcoords='offset points',fontsize=9)
    axes[0].set(xlabel='Static evaluation cost, late positions (µs/call)',
                ylabel='Mean exact final-disc regret at depth 3',
                title='Quality versus cost (lower is better)',xlim=(0,3.4),ylim=(0,6.7))
    axes[0].text(.02,.03,'64 independent exact six-empty positions\nTiming: four separate positions, seven samples',
                 transform=axes[0].transAxes,fontsize=8,color='#555555')
    styles=[('B','A','#147a58',-2),('C','B','#b56524',0),('C','A','#4169a2',2)]
    for c,b,color,offset in styles:
        rows=sorted([j for j in matches if j['candidate']==c and j['opponent']==b],key=lambda j:j['timeMs'])
        xs=[j['timeMs']+offset for j in rows]; ys=[100*j['scoreRate'] for j in rows]
        lower=[100*(j['scoreRate']-j['capAndComparisonsInterval95'][0]) for j in rows]
        upper=[100*(j['capAndComparisonsInterval95'][1]-j['scoreRate']) for j in rows]
        axes[1].errorbar(xs,ys,yerr=[lower,upper],label=f'{c} vs {b}',color=color,fmt='o-',capsize=4)
    axes[1].axhline(50,color='#888888',ls='--',lw=1)
    axes[1].set(xlabel='Budget: 20 / 80 ms (markers offset for visibility)',ylabel='Paired game points (%)',
                title='Equal-time strength: cap-adjusted 95% intervals',xticks=[20,80],xlim=(10,90),ylim=(0,103))
    axes[1].legend(loc='lower left',fontsize=9)
    for ax in axes:
        ax.grid(alpha=.2)
        ax.spines[['top','right']].set_visible(False)
    fig.suptitle('Reversi evaluator comparison — exploratory single-machine measurements',fontsize=12)
    fig.savefig(plot_output,metadata={'Date':None})
    # Matplotlib emits trailing spaces in SVG path data. Normalize whitespace
    # without changing geometry, keeping generated artifacts diff-check clean.
    svg=Path(plot_output)
    svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
    if len(sys.argv)>4:
        fig.savefig(sys.argv[4],dpi=150)
    print(json.dumps({'timed':[(j['candidate'],j['opponent'],j['timeMs'],j['openingPairs'],j['scoreRate']) for j in matches],
                      'lateRegretDifferences':differences},indent=2))


if __name__=='__main__':
    main()
