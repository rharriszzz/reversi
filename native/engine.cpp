#include "engine.hpp"
#include "frozen.hpp"
#include <algorithm>
#include <cmath>
#include <ctime>
#include <stdexcept>
#include <limits>
#include <utility>
namespace reversi {
Profile profile;
#ifdef NATIVE_PROFILE
struct Span {
  Profile::Part part; Clock::time_point start; uint64_t childNs=0; Span* parent;
  static inline Span* active=nullptr;
  explicit Span(Profile::Part p):part(p),start(Clock::now()),parent(active){active=this;}
  ~Span(){auto elapsed=std::chrono::duration_cast<std::chrono::nanoseconds>(Clock::now()-start).count();profile.ns[part]+=elapsed-childNs;profile.calls[part]++;active=parent;if(parent)parent->childNs+=elapsed;}
};
#define SPAN(x) Span span(Profile::x)
#else
#define SPAN(x)
#endif
constexpr Bits A=0x0101010101010101ULL,H=A<<7,CORNERS=0x8100000000000081ULL;
constexpr double INF=1e9;
int pop(Bits x) {return __builtin_popcountll(x);}
int first(Bits x) {return __builtin_ctzll(x);} // only called for nonzero masks
// Templates let the compiler unroll directions with immediate shifts/masks.
template<int D> inline Bits shift(Bits x) {
  if constexpr(D==0)return (x&~H)<<1;
  if constexpr(D==1)return (x&~A)>>1;
  if constexpr(D==2)return x<<8;
  if constexpr(D==3)return x>>8;
  if constexpr(D==4)return (x&~H)<<9;
  if constexpr(D==5)return (x&~A)<<7;
  if constexpr(D==6)return (x&~H)>>7;
  return (x&~A)>>9;
}
template<int D> inline Bits movesIn(Bits own,Bits opp) {
  Bits run=shift<D>(own)&opp;
  for(int k=0;k<5;k++)run|=shift<D>(run)&opp;
  return shift<D>(run);
}
Bits legal(Bits own,Bits opp) {
  SPAN(Legal);
  return (movesIn<0>(own,opp)|movesIn<1>(own,opp)|movesIn<2>(own,opp)|movesIn<3>(own,opp)|movesIn<4>(own,opp)|movesIn<5>(own,opp)|movesIn<6>(own,opp)|movesIn<7>(own,opp))&~(own|opp);
}
template<int D> inline Bits flipsIn(Bits move,Bits own,Bits opp) {
  Bits ray=shift<D>(move),run=0;
  while(ray&opp){run|=ray;ray=shift<D>(ray);}
  return ray&own?run:0;
}
Bits flips(Bits own,Bits opp,int q) {
  SPAN(Flips);Bits m=Bits(1)<<q;
  return flipsIn<0>(m,own,opp)|flipsIn<1>(m,own,opp)|flipsIn<2>(m,own,opp)|flipsIn<3>(m,own,opp)|flipsIn<4>(m,own,opp)|flipsIn<5>(m,own,opp)|flipsIn<6>(m,own,opp)|flipsIn<7>(m,own,opp);
}
Board play(Board b,int player,int q) {
  Bits f=flips(player==1?b.black:b.white,player==1?b.white:b.black,q),m=Bits(1)<<q;
  return player==1?Board{b.black|f|m,b.white&~f}:Board{b.black&~f,b.white|f|m};
}
Bits adjacent(Bits x) {return shift<0>(x)|shift<1>(x)|shift<2>(x)|shift<3>(x)|shift<4>(x)|shift<5>(x)|shift<6>(x)|shift<7>(x);}
double terminal(Board b,int p) {int margin=(pop(b.black)-pop(b.white))*p;return margin==0?0:(margin>0?10000:-10000)+margin;}
double norm(int a,int b,int offset=0) {return double(a-b)/std::max(1,a+b+offset);}
std::array<double,7> features(Board b,int p,Bits ownMoves) {
  SPAN(Features);
  Bits own=p==1?b.black:b.white,opp=p==1?b.white:b.black,empty=~(own|opp),nearEmpty=adjacent(empty);
  int ownX=0,oppX=0,ownC=0,oppC=0;
  constexpr int corners[4][4]={{0,9,1,8},{7,14,6,15},{56,49,48,57},{63,54,55,62}};
  for(const auto& row:corners)if(empty&(Bits(1)<<row[0])) {
    ownX+=int((own>>row[1])&1);oppX+=int((opp>>row[1])&1);
    for(int k=2;k<4;k++){ownC+=int((own>>row[k])&1);oppC+=int((opp>>row[k])&1);}
  }
  return {norm(pop(ownMoves),pop(legal(opp,own)),2),norm(pop(empty&adjacent(opp)),pop(empty&adjacent(own)),2),
    double(pop(own&CORNERS)-pop(opp&CORNERS))/4,double(oppX-ownX)/4,double(oppC-ownC)/8,
    norm(pop(opp&nearEmpty),pop(own&nearEmpty),2),norm(pop(own),pop(opp))};
}
template<int J,size_t... K> inline int patternCode(Board b,std::index_sequence<K...>) {
  constexpr int power[8]={1,3,9,27,81,243,729,2187};
  constexpr int base=frozen::lengths[J]==6?364:3280;
  // Constants in each specialization remove geometry loads, variable shifts,
  // per-square branches and the power recurrence. Original ternary code.
  return base+(0+...+(int((b.black>>frozen::squares[J][K])&1)*power[K]))
    -(0+...+(int((b.white>>frozen::squares[J][K])&1)*power[K]));
}
template<int J> inline double patternValue(Board b,int phase) {
  int code=patternCode<J>(b,std::make_index_sequence<frozen::lengths[J]>{});
  if constexpr(J<8)return frozen::table0[phase*729+code];
  else return frozen::table1[phase*6561+code];
}
template<size_t... J> inline double patternSum(Board b,int phase,std::index_sequence<J...>) {
  double sum=0;((sum+=patternValue<J>(b,phase)),...);return sum;
}
double patterns(Board b,int phase) {
  SPAN(Patterns);return patternSum(b,phase,std::make_index_sequence<16>{});
}
double evaluate(Board b,int p,int model,Bits ownMoves) {
  auto f=features(b,p,ownMoves);int occupied=pop(b.black|b.white),phase=occupied<28?0:occupied<52?1:2;
  double score=0;
  for(int j=0;j<7;j++)score+=frozen::weights[model][phase][j]*f[j];
  return model==2?score+p*patterns(b,phase):score;
}
const char* modelIdentity(int model) {return frozen::identities[model];}
static Bits mix(Bits x) {x^=x>>30;x*=0xbf58476d1ce4e5b9ULL;x^=x>>27;x*=0x94d049bb133111ebULL;return x^(x>>31);}
Engine::Engine(size_t mib) {
  if(mib>1024)throw std::runtime_error("TT must be 0..1024 MiB");
  size_t count=1,target=std::max(size_t(1),mib*1024*1024/sizeof(Entry));
  while(count<=target/2)count*=2;table.resize(count);
}
size_t Engine::index(Board b,int p) const {return (mix(b.black)^mix(b.white+0x9e3779b97f4a7c15ULL)^Bits(p==1?0:0xa0761d6478bd642fULL))&(table.size()-1);}
bool Engine::same(const Entry& e,Board b,int p) const {return e.player==p&&e.black==b.black&&e.white==b.white;}
void Engine::nextGeneration() {if(++generation==0){std::fill(table.begin(),table.end(),Entry{});generation=1;}}
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
constexpr auto priorities=makePriorities();
int Engine::ordered(Board b,Bits moves,int favored,std::array<int,64>& output) {
  SPAN(Ordering);int n=0;std::array<int,64> ranks;
  Bits occupied=b.black|b.white;int mask=int(occupied&1)|int((occupied>>6)&2)|int((occupied>>54)&4)|int((occupied>>60)&8);
  while(moves){int q=first(moves);moves&=moves-1;int rank=q==favored?2000:priorities[mask][q],at=n++;
    while(at>0&&rank>ranks[at-1]){ranks[at]=ranks[at-1];output[at]=output[at-1];at--;}
    ranks[at]=rank;output[at]=q;
  }return n;
}
struct Timeout{};
double Engine::negamax(Board b,int p,int depth,double alpha,double beta) {
  if((timed&&((stats.nodes&63)==0)&&Clock::now()>=deadline)||(stopNodes&&stats.nodes>=stopNodes))throw Timeout{};
  stats.nodes++;
  double oldAlpha=alpha,oldBeta=beta;uint64_t horizon=stats.horizonHits;
  int favored=-1;size_t slot=0;
  if(useTT) {
    SPAN(TT);stats.probes++;slot=index(b,p);const auto& e=table[slot];
    if(e.player&&same(e,b,p)) {
      stats.hits++;if(orderingHints)favored=e.move;
      // Same-depth only, even when the old score was endgame-solved. This
      // preserves truncated minimax semantics at every qualified horizon.
      if(e.generation==generation&&e.depth==depth) {
        stats.boundHits++;if(!e.solved)stats.horizonHits++;
        if(e.flag==1){stats.ttCutoffs++;return e.score;}
        if(e.flag==2)alpha=std::max(alpha,e.score);
        if(e.flag==3)beta=std::min(beta,e.score);
        if(alpha>=beta){stats.ttCutoffs++;return e.score;}
      }
    }else if(e.player)stats.collisions++;
  }
  Bits own=p==1?b.black:b.white,opp=p==1?b.white:b.black,moves=legal(own,opp);
  if(!moves) {
    if(!legal(opp,own))return terminal(b,p);
    return -negamax(b,-p,depth,-beta,-alpha);
  }
  if(depth<=0){stats.evaluations++;stats.horizonHits++;return evaluate(b,p,model,moves);}
  std::array<int,64> list;int n=ordered(b,moves,favored,list),bestMove=-1;double best=-INF;
  for(int i=0;i<n;i++) {
    int q=list[i];double value=-negamax(play(b,p,q),-p,depth-1,-beta,-alpha);
    if(value>best){best=value;bestMove=q;}alpha=std::max(alpha,best);
    if(alpha>=beta){stats.cutoffs++;break;}
  }
  if(useTT) {
    SPAN(TT);auto& e=table[slot];
    // Prefer current-generation deep entries, but always replace the same
    // identity/depth so a re-search can strengthen a bound to exact.
    if(e.generation!=generation||same(e,b,p)||e.depth<=depth) {
      if(e.player&&!same(e,b,p))stats.replacements++;
      uint8_t flag=best<=oldAlpha?3:best>=oldBeta?2:1;
      e={b.black,b.white,best,generation,int8_t(p),int8_t(depth),int8_t(bestMove),flag,stats.horizonHits==horizon};
    }
  }
  return best;
}
Result Engine::root(Board b,int p,int depth,int favored) {
  Result r;Bits own=p==1?b.black:b.white,opp=p==1?b.white:b.black,moves=legal(own,opp);uint64_t horizon=stats.horizonHits;
  if(!moves){r.score=negamax(b,p,depth,-INF,INF);}
  else {
    std::array<int,64> list;int n=ordered(b,moves,favored,list);r.score=-INF;
    for(int i=0;i<n;i++) {
      double value=-negamax(play(b,p,list[i]),-p,depth-1,-INF,-r.score);
      if(value>r.score){r.score=value;r.move=list[i];}
    }
  }
  r.hasScore=true;r.depth=depth;r.exact=64-pop(b.black|b.white)<=depth||stats.horizonHits==horizon;return r;
}
Result Engine::search(Board b,int p,int depth,int selectedModel,double timeMs,uint64_t nodeLimit) {
  if((b.black&b.white)||std::abs(p)!=1||depth<1||depth>14||selectedModel<0||selectedModel>2||!std::isfinite(timeMs)||timeMs<0)throw std::runtime_error("Invalid search parameters");
  auto start=Clock::now();auto cpu=std::clock();model=selectedModel;stats={};timed=timeMs>0;stopNodes=nodeLimit;
  deadline=start+std::chrono::duration_cast<Clock::duration>(std::chrono::duration<double,std::milli>(timeMs));
  Result result;std::array<int,64> list;int n=ordered(b,legal(p==1?b.black:b.white,p==1?b.white:b.black),-1,list);if(n)result.move=list[0];
  for(int current=timed?1:depth;current<=depth;current++) {
    nextGeneration();
    try {result=root(b,p,current,result.move);}catch(const Timeout&){result.timedOut=true;break;}
    if(!timed||result.exact)break;
  }
  result.stats=stats;result.elapsedMs=std::chrono::duration<double,std::milli>(Clock::now()-start).count();
  result.cpuMs=1000.*(std::clock()-cpu)/CLOCKS_PER_SEC;result.tableBytes=tableBytes();result.generation=generation;return result;
}
std::vector<double> Engine::windows(Board b,int p,int depth,int selectedModel,const std::vector<std::array<double,2>>& ranges) {
  if((b.black&b.white)||std::abs(p)!=1||depth<0||depth>14||selectedModel<0||selectedModel>2)throw std::runtime_error("Invalid window parameters");
  stats={};timed=false;stopNodes=0;model=selectedModel;nextGeneration();std::vector<double> values;
  for(auto w:ranges){if(!std::isfinite(w[0])||!std::isfinite(w[1])||w[0]>=w[1])throw std::runtime_error("Invalid window");values.push_back(negamax(b,p,depth,w[0],w[1]));}
  return values;
}
}
