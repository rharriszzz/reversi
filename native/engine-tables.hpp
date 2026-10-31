#pragma once
#include "engine.hpp"
#include "frozen.hpp"
#include <algorithm>
namespace reversi::detail {
inline constexpr Bits CORNERS=0x8100000000000081ULL;
constexpr auto makeFlipRays() {
  std::array<std::array<Bits,8>,64> rays{};
  constexpr int dr[8]={0,0,1,-1,1,1,-1,-1},dc[8]={1,-1,0,0,1,-1,1,-1};
  for(int q=0;q<64;q++)for(int d=0;d<8;d++)
    for(int r=q/8+dr[d],c=q%8+dc[d];r>=0&&r<8&&c>=0&&c<8;r+=dr[d],c+=dc[d])rays[q][d]|=Bits(1)<<(8*r+c);
  return rays;
}
inline constexpr auto flipRays=makeFlipRays();
template<int J> constexpr auto makePatternContributions() {
  constexpr bool corner=J<8;
  std::array<uint16_t,corner?512:256> table{};
  int row=7,col=7;
  for(int k=0;k<frozen::lengths[J];k++) {
    row=std::min(row,frozen::squares[J][k]/8);
    col=std::min(col,frozen::squares[J][k]%8);
  }
  for(size_t mask=0;mask<table.size();mask++) {
    int power=1;
    for(int k=0;k<frozen::lengths[J];k++) {
      int q=frozen::squares[J][k];
      int bit=corner?(q/8-row)*3+q%8-col:
        (frozen::squares[J][0]/8==frozen::squares[J][1]/8?q%8:q/8);
      if(mask&(size_t(1)<<bit))table[mask]+=power;
      power*=3;
    }
  }
  return table;
}
template<int J> inline constexpr auto patternContributions=makePatternContributions<J>();
constexpr auto makePriorities() {
  std::array<std::array<int16_t,64>,16> result{};
  constexpr int rows[4][4]={{0,9,1,8},{7,14,6,15},{56,49,48,57},{63,54,55,62}};
  for(int mask=0;mask<16;mask++)for(int q=0;q<64;q++) {
    if((Bits(1)<<q)&CORNERS){result[mask][q]=1000;continue;}
    int value=0;for(int k=0;k<4;k++)if(!(mask&(1<<k))) {
      if(q==rows[k][1])value-=150;
      if(q==rows[k][2]||q==rows[k][3])value-=45;
    }
    if(q<8||q>=56||(q&7)==0||(q&7)==7)value+=35;
    result[mask][q]=int16_t(value);
  }
  return result;
}
inline constexpr auto priorities=makePriorities();
}
