// Independent mailbox reference, deterministic corpus and complete-flip timings.
#include "engine.hpp"
#include <algorithm>
#include <array>
#include <chrono>
#include <ctime>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <iomanip>
#include <stdexcept>
#include <vector>
using Bits=uint64_t;
extern "C" {
#define DECL(N) Bits kernel##N(Bits,Bits,int);
DECL(0) DECL(1) DECL(2) DECL(3) DECL(4)
}
using Fn=Bits(*)(Bits,Bits,int);
const std::array<Fn,6> functions={kernel0,kernel1,kernel2,kernel3,kernel4,reversi::flips};
const char* names[]={"original","masked-loop","unrolled","doubling","ray-table","selected"};
struct Case {Bits own,opp;int q;};
uint64_t state=0x464c49504d340001ULL;
uint64_t random64(){state^=state<<13;state^=state>>7;state^=state<<17;return state;}
Bits reference(Bits own,Bits opp,int q) {
  // No bitboard propagation or shared geometry: scan mailbox cells directly.
  std::array<int,64> cells{};
  for(int k=0;k<64;k++)cells[k]=int((own>>k)&1)?1:int((opp>>k)&1)?-1:0;
  Bits result=0;
  for(int dr=-1;dr<=1;dr++)for(int dc=-1;dc<=1;dc++)if(dr||dc) {
    std::array<int,7> captured{};int n=0,r=q/8+dr,c=q%8+dc;
    while(r>=0&&r<8&&c>=0&&c<8&&cells[r*8+c]==-1){captured[n++]=r*8+c;r+=dr;c+=dc;}
    if(n&&r>=0&&r<8&&c>=0&&c<8&&cells[r*8+c]==1)
      for(int k=0;k<n;k++)result|=Bits(1)<<captured[k];
  }
  return result;
}
uint64_t checked=0;
void verify(Case c) {
  const Bits expected=reference(c.own,c.opp,c.q),m=Bits(1)<<c.q;
  const reversi::Board want{c.own|expected|m,c.opp&~expected};
  for(Fn f:functions) {
    const Bits flips=f(c.own,c.opp,c.q);
    const reversi::Board got{c.own|flips|m,c.opp&~flips};
    if(flips!=expected||got.black!=want.black||got.white!=want.white)throw std::runtime_error("Mailbox flip/board mismatch");
  }
  const auto black=reversi::play({c.own,c.opp},1,c.q),white=reversi::play({c.opp,c.own},-1,c.q);
  if(black.black!=want.black||black.white!=want.white||white.white!=want.black||white.black!=want.white)
    throw std::runtime_error("Production resulting board mismatch");
  checked++;
}
std::array<std::vector<Case>,8> corpus;
const char* classes[]={"opening","middle","late","last-two","last-one","edge-corner","controlled","search-tail"};
void exhaustive() {
  // Every ternary occupancy of each complete rank/file/diagonal through every
  // possible empty move. Other cells empty. Opposite directions tested together.
  for(int q=0;q<64;q++)for(auto delta:std::array<std::array<int,2>,4>{{{0,1},{1,0},{1,1},{1,-1}}}) {
    std::vector<int> line;
    for(int r=0;r<8;r++)for(int c=0;c<8;c++)if(r*8+c!=q&&
      ((delta[0]==0&&r==q/8)||(delta[1]==0&&c==q%8)||(delta[0]&&delta[1]&&(r-q/8)*delta[1]==(c-q%8))))line.push_back(r*8+c);
    int count=1;for(size_t i=0;i<line.size();i++)count*=3;
    for(int pattern=0;pattern<count;pattern++) {
      Case sample{0,0,q};int code=pattern;
      for(int square:line){int cell=code%3;code/=3;if(cell==1)sample.own|=Bits(1)<<square;if(cell==2)sample.opp|=Bits(1)<<square;}
      verify(sample);
    }
  }
}
void generate() {
  for(int game=0;game<128;game++) {
    Bits own=(Bits(1)<<28)|(Bits(1)<<35),opp=(Bits(1)<<27)|(Bits(1)<<36);
    for(int ply=0;ply<65;ply++) {
      const int occupied=__builtin_popcountll(own|opp);std::vector<int> moves;
      for(int q=0;q<64;q++)if(!(((own|opp)>>q)&1)) {
        Case c{own,opp,q};verify(c);const Bits f=reference(own,opp,q);
        const int group=occupied<28?0:occupied<52?1:occupied==63?4:occupied==62?3:2;
        // Legal moves represent general play; tiny endgame also checks no-capture squares.
        if(f||group==3||group==4)corpus[group].push_back(c);
        if(f){moves.push_back(q);if(q<8||q>=56||q%8==0||q%8==7)corpus[5].push_back(c);}
      }
      if(moves.empty()) {
        bool other=false;for(int q=0;q<64;q++)if(!(((own|opp)>>q)&1)&&reference(opp,own,q)){other=true;break;}
        if(!other)break;std::swap(own,opp);continue;
      }
      const int q=moves[random64()%moves.size()];const Bits f=reference(own,opp,q);
      own|=f|(Bits(1)<<q);opp&=~f;std::swap(own,opp);
    }
  }
  // Arbitrary disjoint sparse/middle/dense boards, every empty square, both turns.
  for(int i=0;i<12000;i++) {
    Bits own=random64(),opp=random64()&~own;
    if(i%3==0){own&=random64()&random64();opp&=random64()&random64();}
    for(int q=0;q<64;q++)if(!(((own|opp)>>q)&1)){verify({own,opp,q});verify({opp,own,q});}
  }
  for(int q=0;q<64;q++)for(int i=0;i<64;i++) {
    Case c{0,0,q};
    for(int k=0;k<64;k++)if(k!=q){if(i%2&&random64()%3==0)c.own|=Bits(1)<<k;else c.opp|=Bits(1)<<k;}
    verify(c);corpus[6].push_back(c);
  }
  // Explicit maximum 6-disc rays in every direction, every origin/length, plus zero/one chains.
  for(int q=0;q<64;q++)for(int dr=-1;dr<=1;dr++)for(int dc=-1;dc<=1;dc++)if(dr||dc)
    for(int n=0;n<=6;n++) {
      Case c{0,0,q};int r=q/8+dr,k=q%8+dc,j=0;
      for(;j<n&&r>=0&&r<8&&k>=0&&k<8;j++,r+=dr,k+=dc)c.opp|=Bits(1)<<(r*8+k);
      if(j==n&&r>=0&&r<8&&k>=0&&k<8)c.own|=Bits(1)<<(r*8+k);
      verify(c);corpus[6].push_back(c);
    }
}
uint64_t work(Fn f,const std::vector<Case>& cases,int repeats) {
  uint64_t checksum=0;
  for(int i=0;i<repeats;i++)for(const auto& c:cases)checksum+=f(c.own,c.opp,c.q);
  return checksum;
}
int main(int argc,char** argv) {
  try {
    exhaustive();generate();
    // Optional diagnostic dump: real production exact-tree flip calls, not timings.
    if(argc>1){std::ifstream file(argv[1]);Case c{};while(file>>std::hex>>c.own>>c.opp>>std::dec>>c.q){verify(c);corpus[7].push_back(c);}}
    // Explicit Fisher-Yates makes the case order identical in libc++/libstdc++.
    for(auto& group:corpus)for(size_t i=group.size();i>1;i--)std::swap(group[i-1],group[random64()%i]);
    std::cout<<"{\"checkedCases\":"<<checked<<",\"corpus\":[";
    for(int group=0;group<8;group++) {
      uint64_t hash=14695981039346656037ULL;
      for(const auto& c:corpus[group])for(uint64_t v:{c.own,c.opp,uint64_t(c.q)})hash=(hash^v)*1099511628211ULL;
      std::cout<<(group?",":"")<<"{\"class\":\""<<classes[group]<<"\",\"cases\":"<<corpus[group].size()<<",\"orderedChecksum\":\""<<hash<<"\"}";
    }
    std::cout<<"],\"rows\":["<<std::setprecision(12);bool comma=false;
    const bool onlyCheck=argc>1&&std::string(argv[1])=="--check";
    const int target=std::getenv("FLIP_MICRO_CALLS")?std::stoi(std::getenv("FLIP_MICRO_CALLS")):20000000;
    if(!onlyCheck)for(int rep=0;rep<7;rep++)for(int group=0;group<8;group++)if(!corpus[group].empty())for(int at=0;at<6;at++) {
      int tag=(at+rep)%6;if(rep%2)tag=5-tag;
      const auto& cases=corpus[group];const int repeats=std::max(1,int(target/cases.size()));
      work(functions[tag],cases,2);const auto start=std::chrono::steady_clock::now();const auto cpu=std::clock();
      const uint64_t checksum=work(functions[tag],cases,repeats);
      const double elapsed=std::chrono::duration<double>(std::chrono::steady_clock::now()-start).count();
      const double cpuSeconds=double(std::clock()-cpu)/CLOCKS_PER_SEC;
      std::cout<<(comma?",":"")<<"{\"rep\":"<<rep<<",\"class\":\""<<classes[group]<<"\",\"algorithm\":\""<<names[tag]<<"\",\"cases\":"<<cases.size()<<",\"calls\":"<<uint64_t(cases.size())*repeats<<",\"wallSeconds\":"<<elapsed<<",\"cpuSeconds\":"<<cpuSeconds<<",\"checksum\":\""<<checksum<<"\"}";comma=true;
    }
    std::cout<<"]}\n";
  }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
