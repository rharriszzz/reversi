"""Synthetic importer integrity cases; not experimental measurements."""
import importlib.util,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('profiling_normalize',ROOT/'scripts/profiling/normalize.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ImporterTests(unittest.TestCase):
    def xml(self,text):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);p=Path(self.tmp.name)/'test.xml';p.write_text(text);return m.XML(p)
    def test_references_and_malformed_width(self):
        x=self.xml('<trace-query-result><node><schema name="s"><col><mnemonic>x</mnemonic></col></schema><row><uint64 ref="1"/></row><row><uint64 id="1">10</uint64></row></node></trace-query-result>');self.assertEqual([x.integer(r['x']) for r in x.rows('s')],[10,10])
        x=self.xml('<trace-query-result><node><schema name="s"><col><mnemonic>x</mnemonic></col></schema><row/></node></trace-query-result>')
        with self.assertRaises(ValueError):list(x.rows('s'))
    def test_node_scoped_references_do_not_cross_contaminate_tables(self):
        x=self.xml('<trace-query-result><node><uint64 id="1">10</uint64><uint64 ref="1"/></node><node><uint64 id="1">20</uint64><uint64 ref="1"/></node></trace-query-result>')
        self.assertEqual(x.integer(x.root[0][1]),10);self.assertEqual(x.integer(x.root[1][1]),20)
    def test_unknown_reference_is_not_silently_dropped(self):
        x=self.xml('<root><uint64 ref="missing"/></root>')
        with self.assertRaises(ValueError):x.integer(x.root[0])
    def test_marker_provenance_is_required(self):
        x=self.xml('<trace-query-result/>')
        with self.assertRaises(ValueError):m.marker_range(x)
    def test_repeated_table_schema_and_duplicate_boundaries(self):
        text='<trace-query-result><node><schema name="os-signpost"><col><mnemonic>time</mnemonic></col><col><mnemonic>event-type</mnemonic></col><col><mnemonic>name</mnemonic></col></schema><row><event-time>100</event-time><event-type>Begin</event-type><signpost-name>FixedWork</signpost-name></row><row><event-time>200</event-time><event-type>End</event-type><signpost-name>FixedWork</signpost-name></row></node><node><row><event-time>100</event-time><event-type>Begin</event-type><signpost-name>FixedWork</signpost-name></row><row><event-time>200</event-time><event-type>End</event-type><signpost-name>FixedWork</signpost-name></row></node></trace-query-result>'
        self.assertEqual(m.marker_range(self.xml(text)),(100,200))
    def test_constant_ratio_has_zero_interval_width(self):
        effect=m.effect([1.1]*5);self.assertAlmostEqual(effect['percent'],10);self.assertAlmostEqual(effect['low'],10);self.assertAlmostEqual(effect['high'],10)
    def test_raw_cumulative_counter_is_not_summed_as_sample_weight(self):
        columns=['time','thread','core-index','thread-state','pmi-count','sampled-counter','program-counter','cp-kernel-callstack','cp-user-callstack']
        def schema(name,cols):return '<schema name="'+name+'">'+''.join('<col><mnemonic>'+c+'</mnemonic></col>' for c in cols)+'</schema>'
        rows=''
        for i in range(3):rows+=f'<row><sample-time>{100+i}</sample-time><thread><tid>1</tid></thread><core fmt="CPU 6 (P Core)">6</core><thread-state fmt="Running">Running</thread-state><uint64>{(i+1)*1000000}</uint64><uint64>2</uint64><uint64>4096</uint64><sentinel/><sentinel/></row>'
        markers=''.join(f'<row><event-time>{t}</event-time><event-type>{kind}</event-type><signpost-name>FixedWork</signpost-name></row>' for kind,t in [('Begin',100),('End',200)])
        text='<trace-query-result><node>'+schema('pmi-sample',columns)+rows+'</node><node>'+schema('os-signpost',['time','event-type','name'])+markers+'</node></trace-query-result>';x=self.xml(text)
        row={'mode':'ip-1000000','raw':str(Path(self.tmp.name)/'raw.trace'),'result':{'wallSeconds':1e-7,'loadAddress':'0x1000'},'id':'test','workload':'test','tag':'after'}
        with patch.object(m,'export',return_value=(x,0)):
            summary,_=m.parse_capture(row,{})
        self.assertEqual(summary['samples'],3);self.assertEqual(summary['weight'],3000000)
        # Even a stack collected outside the retained work interval disqualifies IP-only collection.
        x=self.xml(text.replace('<sample-time>100</sample-time>','<sample-time>99</sample-time>').replace('<sentinel/><sentinel/>','<sentinel/><kperf-bt/>',1))
        with patch.object(m,'export',return_value=(x,0)):
            with self.assertRaises(AssertionError):m.parse_capture(row,{})
if __name__=='__main__':unittest.main()
