"""Separate call-count/corpus diagnostic. Never a performance measurement."""
import json,os,subprocess
from pathlib import Path
OUT=Path(os.environ.get('REVERSI_FLIP_RUN','.local-research/fast-flips-m4-20261031')).resolve()
b=json.loads((OUT/'builds.json').read_text());directory=OUT/'diagnostic';directory.mkdir(exist_ok=True)
source=(OUT/'original/engine.cpp').read_text()
source='#include <fstream>\n#include <iostream>\n'+source
source=source.replace('Bits flips(Bits own,Bits opp,int q) {', '''
uint64_t flipCounts[65]{},helperCounts[65]{};
std::ofstream cases;
Bits flips(Bits own,Bits opp,int q) {
  int empty=64-pop(own|opp);auto count=++flipCounts[empty];
  if(count%97==1&&count<970001)cases<<std::hex<<own<<' '<<opp<<std::dec<<' '<<q<<'\\n';
''')
at=source.index('[[gnu::noinline]] double Engine::lastEmpties')
source=source[:at]+'''Bits helperFlips(Bits own,Bits opp,int q) {helperCounts[64-pop(own|opp)]++;return flips(own,opp,q);}
'''+source[at:]
at=source.index('[[gnu::noinline]] double Engine::lastEmpties');end=source.index('double Engine::negamax',at)
source=source[:at]+source[at:end].replace('flips(', 'helperFlips(')+source[end:]
(directory/'engine.cpp').write_text(source)
root=next(p for p in json.loads((OUT/'positions.json').read_text()) if p['id']=='native-engineering-10')
bits=lambda v:hex(sum(1<<q for q,x in enumerate(root['board']) if x==v))+'ULL'
(directory/'driver.cpp').write_text('''#include "engine.hpp"
#include <fstream>
#include <iostream>
namespace reversi {extern uint64_t flipCounts[65],helperCounts[65];extern std::ofstream cases;}
int main(int argc,char**argv){using namespace reversi;cases.open(argv[1]);Engine e;e.configure(true,false);
auto r=e.search({'''+bits(1)+','+bits(-1)+'},'+str(root['player'])+''',12,2);
std::cout<<"{\\"score\\":"<<r.score<<",\\"nodes\\":"<<r.stats.nodes<<",\\"byEmpties\\":[";
for(int i=0;i<65;i++)std::cout<<(i?",":"")<<"["<<i<<","<<flipCounts[i]<<","<<helperCounts[i]<<"]";
std::cout<<"]}\\n";}
''')
cmd=[os.environ.get('CXX','c++'),*b['flags'],'-I',str(OUT/'original'),str(directory/'engine.cpp'),str(directory/'driver.cpp'),'-o',str(directory/'diagnostic')]
subprocess.run(cmd,check=True)
result=subprocess.check_output([str(directory/'diagnostic'),str(OUT/'search-cases.txt')],text=True)
(OUT/'diagnostic.json').write_text(result);print(result)
