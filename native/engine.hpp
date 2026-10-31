#pragma once
#include <array>
#include <chrono>
#include <cstdint>
#include <vector>
#include <string>

namespace reversi {
using Bits=std::uint64_t;
using Clock=std::chrono::steady_clock;
struct Board { Bits black=0, white=0; };
int pop(Bits x);
Bits legal(Bits own, Bits opponent);
Bits flips(Bits own, Bits opponent, int square);
Board play(Board b,int player,int square);
double terminal(Board b,int player);
std::array<double,7> features(Board b,int player,Bits ownMoves);
double evaluate(Board b,int player,int model,Bits ownMoves);
const char* modelIdentity(int model);
struct Counters {
  uint64_t nodes=0,evaluations=0,probes=0,hits=0,boundHits=0,collisions=0,replacements=0,cutoffs=0,ttCutoffs=0,horizonHits=0;
  uint64_t stores=0,rejectedStores=0,firstMoveCutoffs=0;
};
struct Result {
  int move=-1,depth=0; double score=0,elapsedMs=0,cpuMs=0; bool hasScore=false,exact=false,timedOut=false;
  Counters stats; size_t tableBytes=0; uint64_t generation=0;
};
struct MoveAnalysis { Result result; std::vector<int> pv; };
struct Analysis { Result summary; std::vector<MoveAnalysis> moves; };
// Full bitboard identity prevents even deliberately colliding indices from reuse.
struct Entry {
  Bits black=0,white=0; double score=0;
  uint32_t generation=0; int8_t player=0; uint8_t depth=0; int8_t move=-1; uint8_t flag=0; bool solved=false;
};
struct Profile {
  enum Part { Legal, Flips, Features, Patterns, TT, Ordering, Count };
  std::array<uint64_t,Count> ns{},calls{};
};
extern Profile profile;
struct CpuFeatures {
  bool popcnt=false,bmi1=false,bmi2=false,lzcnt=false;
  bool enhanced() const {return popcnt&&bmi1&&bmi2&&lzcnt;}
};
CpuFeatures cpuFeatures();
class Engine {
  friend struct EngineQualification; // standalone regression, no playing API
  std::vector<Entry> table;
  const bool enhancedBackend; // selected at construction; table/state owned once
  uint32_t generation=0;
  int model=0; bool useTT=true, orderingHints=true, exactHorizon=false;
  Clock::time_point deadline; bool timed=false;
  uint64_t stopNodes=0; // deterministic interrupted-iteration regression hook
  Counters stats;
  template<int ISA> size_t index(Board b,int player) const;
  void nextGeneration();
  template<int ISA> bool same(const Entry& e,Board b,int player) const;
  template<int ISA> int ordered(Board b,Bits moves,int favored,std::array<int,64>& output);
  template<int ISA> double negamax(Board b,int player,int depth,double alpha,double beta);
  template<int ISA> double lastEmpties(Board b,int player,int depth,double alpha,double beta,Bits empty);
  template<int ISA> Result root(Board b,int player,int depth,int favored);
  template<int ISA> Result searchImpl(Board,int,int,int,double,uint64_t);
  template<int ISA> Analysis analyzeImpl(Board,int,int,int);
  template<int ISA> std::vector<double> windowsImpl(Board,int,int,int,const std::vector<std::array<double,2>>&);
public:
  const char* backendName() const;
  explicit Engine(size_t tableMiB=16);
  size_t tableBytes() const {return table.size()*sizeof(Entry);}
  void configure(bool tt=true,bool hints=true) {useTT=tt;orderingHints=hints;}
  Result search(Board b,int player,int depth,int selectedModel,double timeMs=0,uint64_t nodeLimit=0);
  Analysis analyze(Board b,int player,int depth,int selectedModel);
  // Qualification interface: fresh generation followed by arbitrary windows at
  // one declared depth. Not a playing API and never carries values across depth.
  std::vector<double> windows(Board b,int player,int depth,int selectedModel,const std::vector<std::array<double,2>>& ranges);
};
}
