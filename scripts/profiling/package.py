"""Build minimal Instruments collectors. No installed plugins/settings changes.

Request both counter configuration and PMI table: a standalone PMI table can
reuse stale PMU configuration and is NOT qualified event evidence (see report).
Empty callstack arrays mean no stack requests. Counter reads are periodic,
whereas PC records in pmi-sample are hardware-event triggered.
"""
import os
from pathlib import Path
import subprocess,xml.etree.ElementTree as E
OUT=Path(os.environ.get('REVERSI_PROFILE_RUN','.local-research/profiling-m4-20261030'))
def element(parent,name,text=None):
    e=E.SubElement(parent,name);e.text=str(text) if text is not None else None;return e
def attribute(table,name,value,array=False):
    a=element(table,'attribute');element(a,'name',name)
    if array:
        arr=element(a,'array')
        for v in value:element(arr,'string',v)
    else:element(a,'integer' if isinstance(value,int) else 'string',value)
def build():
    if (OUT/'trials.json').exists():raise RuntimeError('Preserve measured packages; choose a fresh REVERSI_PROFILE_RUN directory.')
    OUT.mkdir(parents=True,exist_ok=True)
    root=E.Element('package');element(root,'id','org.reversi.hardware-sampling');element(root,'title','Reversi Hardware Sampling');element(element(root,'owner'),'name','Reversi')
    for schema in ['pmi-sample','kdebug-counters-with-time-sample','os-signpost']:element(root,'import-schema',schema)
    for stack in [False,True]:
      for period in [1000000,10000000]:
        title=f'Reversi Cycles {"Stacks" if stack else "IP"} {period}'
        i=element(root,'instrument');element(i,'id',f'org.reversi.hardware-sampling.{"stacks" if stack else "ip"}{period}');element(i,'title',title);element(i,'category','CPU');element(i,'purpose',title+' with explicit stack requirement.');element(i,'icon','Generic')
        for tid,schema in [('ips','pmi-sample'),('config','kdebug-counters-with-time-sample'),('markers','os-signpost')]:
            t=element(i,'create-table');element(t,'id',tid);element(t,'schema-ref',schema)
            if tid=='markers':
                attribute(t,'target-pid','SINGLE');attribute(t,'category',['PointsOfInterest'],True)
            else:
                attribute(t,'target','SINGLE');attribute(t,'callstack',['user'] if stack and tid=='ips' else [],True)
                if tid=='ips':attribute(t,'pmi-event','CORE_ACTIVE_CYCLE');attribute(t,'pmi-threshold',period)
                else:attribute(t,'pmc-events',['CORE_ACTIVE_CYCLE'],True);attribute(t,'sample-rate-micro-seconds',10000)
        l=element(i,'list');element(l,'title','PMI records');element(l,'table-ref','ips');element(l,'add-all-columns')
    source=Path('scripts/profiling/hardware.instrpkg');E.indent(root);E.ElementTree(root).write(source,encoding='utf-8',xml_declaration=True)
    r=subprocess.run(['xcrun','instrumentbuilder','-o',str(OUT/'hardware.instrdst'),'-l','ktrace',str(source)],capture_output=True,text=True);(OUT/'package-build.log').write_text(r.stdout+r.stderr);r.check_returncode()
if __name__=='__main__':build()
