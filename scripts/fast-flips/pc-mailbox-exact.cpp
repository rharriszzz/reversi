// Independent reference only: 10x10 mailbox, direct direction scans, exhaustive
// alpha-beta. No production headers, bitboard captures, TT, evaluator or helper.
#include <array>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <vector>
using Mailbox = std::array<int,100>;
constexpr int directions[8]={-11,-10,-9,-1,1,9,10,11};
uint64_t nodes=0;
std::vector<Mailbox> children(const Mailbox& b,int player) {
  std::vector<Mailbox> result;
  for(int r=1;r<=8;r++)for(int c=1;c<=8;c++) {
    const int at=r*10+c;if(b[at])continue;
    Mailbox next=b;bool any=false;
    for(int step:directions) {
      int end=at+step;
      while(b[end]==-player)end+=step;
      if(end==at+step||b[end]!=player)continue;
      any=true;for(int cell=at+step;cell!=end;cell+=step)next[cell]=player;
    }
    if(any){next[at]=player;result.push_back(next);}
  }
  return result;
}
int solve(const Mailbox& b,int player,int alpha,int beta,bool passed=false) {
  nodes++;
  auto moves=children(b,player);
  if(moves.empty()) {
    if(!passed)return -solve(b,-player,-beta,-alpha,true);
    int margin=0;for(int r=1;r<=8;r++)for(int c=1;c<=8;c++)margin+=player*b[r*10+c];
    return margin>0?10000+margin:margin<0?-10000+margin:0;
  }
  int best=-20000;
  for(const auto& next:moves) {
    const int value=-solve(next,-player,-beta,-alpha);
    if(value>best)best=value;
    if(value>alpha)alpha=value;
    if(alpha>=beta)break;
  }
  return best;
}
int main(int argc,char**argv) {
  if(argc!=2)throw std::runtime_error("positions file required");
  std::ifstream file(argv[1]);if(!file)throw std::runtime_error("positions unavailable");
  uint64_t black,white;int player,depth,model;bool comma=false;
  std::cout<<"[";
  while(file>>std::hex>>black>>white>>std::dec>>player>>depth>>model) {
    if(black&white)throw std::runtime_error("overlapping occupancy");
    Mailbox b{};b.fill(2);
    for(int q=0;q<64;q++)b[11+(q/8)*10+q%8]=(black>>q&1)?1:(white>>q&1)?-1:0;
    nodes=0;int value=solve(b,player,-20000,20000);
    std::cout<<(comma?",":"")<<"{\"score\":"<<value<<",\"referenceNodes\":"<<nodes<<"}";comma=true;
  }
  std::cout<<"]\n";
}
