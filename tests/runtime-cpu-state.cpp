// Linux-only dispatch qualification. No environment mutation in game code.
#include "engine.hpp"
#include <cassert>
#include <cstdlib>
#include <string>
using namespace reversi;
void equal(const Counters& a,const Counters& b) {
#define CHECK(field) assert(a.field==b.field)
 CHECK(nodes);CHECK(evaluations);CHECK(probes);CHECK(hits);CHECK(boundHits);CHECK(collisions);CHECK(replacements);CHECK(cutoffs);CHECK(ttCutoffs);CHECK(horizonHits);CHECK(stores);CHECK(rejectedStores);CHECK(firstMoveCutoffs);
#undef CHECK
}
void equal(const Result& a,const Result& b) {
 assert(a.move==b.move&&a.depth==b.depth&&a.score==b.score&&a.hasScore==b.hasScore&&a.exact==b.exact&&a.timedOut==b.timedOut&&a.tableBytes==b.tableBytes&&a.generation==b.generation);equal(a.stats,b.stats);
}
int main() {
 setenv("REVERSI_CPU_BACKEND","portable",1);Engine portable(0);
 setenv("REVERSI_CPU_BACKEND","auto",1);Engine automatic(0);
 const std::string selected=automatic.backendName();
 setenv("REVERSI_CPU_BACKEND","invalid",1);
 assert(std::string(portable.backendName())=="portable"&&automatic.backendName()==selected);
 Engine copied=portable;copied=automatic;assert(std::string(copied.backendName())==selected);
 const Board b{(Bits(1)<<28)|(Bits(1)<<35),(Bits(1)<<27)|(Bits(1)<<36)};
 for(int repeat=0;repeat<3;repeat++)for(int model:{2,0,1})for(int depth:{4,1,3,2}) {
  for(bool hints:{false,true}) {
   portable.configure(true,hints);automatic.configure(true,hints);
   equal(portable.search(b,1,depth,model),automatic.search(b,1,depth,model));
   // Exact node stop and a long deadline: clock speed cannot change the stop.
   equal(portable.search(b,1,12,model,30000,300),automatic.search(b,1,12,model,30000,300));
  }
  const auto p=portable.analyze(b,1,depth,model),a=automatic.analyze(b,1,depth,model);
  equal(p.summary,a.summary);assert(p.moves.size()==a.moves.size());
  for(size_t i=0;i<p.moves.size();i++){equal(p.moves[i].result,a.moves[i].result);assert(p.moves[i].pv==a.moves[i].pv);}
  const std::vector<std::array<double,2>> windows={{-1,1},{-1e9,1e9},{-20,-10},{10,20},{-1e9,1e9}};
  assert(portable.windows(b,1,depth,model,windows)==automatic.windows(b,1,depth,model,windows));
 }
}
