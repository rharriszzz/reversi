// Experimental kernels only. Production retains just the selected algorithm.
#pragma once
#include <array>
#include <cstdint>
namespace flip_experiment {
using Bits=uint64_t;
constexpr Bits A=0x0101010101010101ULL,H=A<<7;
template<int D> inline Bits step(Bits x) {
  if constexpr(D==0)return (x&~H)<<1;
  if constexpr(D==1)return (x&~A)>>1;
  if constexpr(D==2)return x<<8;
  if constexpr(D==3)return x>>8;
  if constexpr(D==4)return (x&~H)<<9;
  if constexpr(D==5)return (x&~A)<<7;
  if constexpr(D==6)return (x&~H)>>7;
  return (x&~A)>>9;
}
template<int D,int N=1> inline Bits raw(Bits x) {
  constexpr int distance=D<2?1:D<4?8:(D==4||D==7)?9:7;
  if constexpr(D==0||D==2||D==4||D==5)return x<<(distance*N);
  else return x>>(distance*N);
}
template<int Algorithm,int D> inline Bits direction(Bits move,Bits own,Bits opp) {
  if constexpr(Algorithm==0) {
    Bits ray=step<D>(move),run=0;
    while(ray&opp){run|=ray;ray=step<D>(ray);}
    return ray&own?run:0;
  } else {
    // An opponent on a file edge cannot have a bracketing disc beyond it.
    // Mask it once; every propagation and final endpoint shift can be raw.
    if constexpr(D!=2&&D!=3)opp&=~(A|H);
    Bits run=raw<D>(move)&opp;
    if constexpr(Algorithm==1) {
      Bits ray=run;
      while(ray){ray=raw<D>(ray)&opp;run|=ray;}
    } else if constexpr(Algorithm==2) {
      for(int i=0;i<5;i++)run|=raw<D>(run)&opp;
    } else {
      run|=raw<D>(run)&opp;
      const Bits pairs=opp&raw<D>(opp);
      run|=raw<D,2>(run)&pairs;
      run|=raw<D,2>(run)&pairs;
    }
    return (raw<D>(run)&own)?run:0;
  }
}
constexpr auto makeRays() {
  std::array<std::array<Bits,8>,64> rays{};
  constexpr int dr[8]={0,0,1,-1,1,1,-1,-1},dc[8]={1,-1,0,0,1,-1,1,-1};
  for(int q=0;q<64;q++)for(int d=0;d<8;d++)
    for(int r=q/8+dr[d],c=q%8+dc[d];r>=0&&r<8&&c>=0&&c<8;r+=dr[d],c+=dc[d])rays[q][d]|=Bits(1)<<(8*r+c);
  return rays;
}
inline constexpr auto rays=makeRays(); // 4096 geometry bytes, no occupancy table
template<int D> inline Bits endpoint(Bits own,Bits opp,int q) {
  const Bits ray=rays[q][D],stops=ray&~opp;
  if(!stops)return 0;
  if constexpr(D==0||D==2||D==4||D==5) {
    const Bits stop=stops&-stops;
    return (stop&own)?ray&(stop-1):0;
  } else {
    const Bits stop=Bits(1)<<(63-__builtin_clzll(stops));
    return (stop&own)?ray&~(stop|(stop-1)):0;
  }
}
template<int Algorithm> [[gnu::always_inline]] inline Bits calculate(Bits own,Bits opp,int q) {
  if constexpr(Algorithm==4)return endpoint<0>(own,opp,q)|endpoint<1>(own,opp,q)|endpoint<2>(own,opp,q)|endpoint<3>(own,opp,q)|endpoint<4>(own,opp,q)|endpoint<5>(own,opp,q)|endpoint<6>(own,opp,q)|endpoint<7>(own,opp,q);
  const Bits move=Bits(1)<<q;
  return direction<Algorithm,0>(move,own,opp)|direction<Algorithm,1>(move,own,opp)|direction<Algorithm,2>(move,own,opp)|direction<Algorithm,3>(move,own,opp)|direction<Algorithm,4>(move,own,opp)|direction<Algorithm,5>(move,own,opp)|direction<Algorithm,6>(move,own,opp)|direction<Algorithm,7>(move,own,opp);
}
}
