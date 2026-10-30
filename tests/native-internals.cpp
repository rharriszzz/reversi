#include "engine.hpp"
#include "frozen.hpp"
#include <cassert>
#include <limits>
namespace reversi { double patterns(Board,int); }
using namespace reversi;
namespace reversi {
struct EngineQualification {
  static void rollover(Engine& e) {
    e.generation=std::numeric_limits<uint32_t>::max();
    for(auto& slot:e.table)slot={0,0,999999,1,1,64,0,1,true};
  }
};
}
int main() {
  // Independently recompute every pattern in the original digit order, for
  // every occupancy of each geometry (including long rays/edge wraps).
  for(int j=0;j<16;j++) {
    int size=j<8?729:6561;
    for(int c=0;c<size;c++) {
      Board board{};int digits=c;
      for(int k=0;k<frozen::lengths[j];k++) {
        int value=digits%3;digits/=3;
        if(value==2)board.black|=Bits(1)<<frozen::squares[j][k];
        if(value==0)board.white|=Bits(1)<<frozen::squares[j][k];
      }
      for(int phase=0;phase<3;phase++) {
        double sum=0;
        for(int g=0;g<16;g++) {
          int code=0,power=1;
          for(int k=0;k<frozen::lengths[g];k++) {
            int q=frozen::squares[g][k];
            int digit=(board.black&(Bits(1)<<q))?2:(board.white&(Bits(1)<<q))?0:1;
            code+=digit*power;power*=3;
          }
          sum+=g<8?frozen::table0[phase*729+code]:frozen::table1[phase*6561+code];
        }
        assert(patterns(board,phase)==sum);
      }
    }
  }
  Board b{(Bits(1)<<28)|(Bits(1)<<35),(Bits(1)<<27)|(Bits(1)<<36)};
  Engine e(0),reference(0);reference.configure(false,false);
  auto expected=reference.search(b,1,4,2);
  EngineQualification::rollover(e);
  auto actual=e.search(b,1,4,2);
  assert(actual.generation==1&&actual.score==expected.score);
  auto leaf=e.search(b,1,1,2);assert(leaf.stats.probes==0);
  auto stop=e.search(b,1,20,2,0,1);assert(!stop.hasScore&&stop.timedOut);
  Board terminal{0xffffffffffffULL,0};
  auto deep=e.search(terminal,1,64,0);assert(deep.depth==64&&deep.exact&&deep.score==10048);
}
