// Complete production searches; only outer work clocks and optional signposts.
#include "engine.hpp"
#include <ctime>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#ifdef __APPLE__
#include <os/signpost.h>
#include <mach-o/dyld.h>
#endif
using namespace reversi;
struct Position {Board board;int player,depth,model;};
void add(Counters& a,const Counters& b) {
#define ADD(x) a.x+=b.x
  ADD(nodes);ADD(evaluations);ADD(probes);ADD(hits);ADD(boundHits);ADD(collisions);ADD(replacements);ADD(cutoffs);ADD(ttCutoffs);ADD(horizonHits);ADD(stores);ADD(rejectedStores);ADD(firstMoveCutoffs);
#undef ADD
}
void print(const Counters& c) {
#define PRINT(x) std::cout<<"\"" #x "\":"<<c.x<<","
  PRINT(nodes);PRINT(evaluations);PRINT(probes);PRINT(hits);PRINT(boundHits);PRINT(collisions);PRINT(replacements);PRINT(cutoffs);PRINT(ttCutoffs);PRINT(horizonHits);PRINT(stores);PRINT(rejectedStores);
#undef PRINT
  std::cout<<"\"firstMoveCutoffs\":"<<c.firstMoveCutoffs;
}
int main(int argc,char** argv) {
  try {
    if(argc!=6)throw std::runtime_error("mode positions repeats warmups budgetMs");
    std::ifstream input(argv[2]);if(!input)throw std::runtime_error("Missing positions");
    std::vector<Position> positions;Position p;
    while(input>>std::hex>>p.board.black>>p.board.white>>std::dec>>p.player>>p.depth>>p.model)positions.push_back(p);
    if(positions.empty())throw std::runtime_error("Empty positions");
    const int repeats=std::stoi(argv[3]),warmups=std::stoi(argv[4]);const double budget=std::stod(argv[5]);
    if(repeats<1||warmups<0)throw std::runtime_error("Invalid repeats");
    Engine engine;engine.configure(true,false);const bool coach=std::string(argv[1])=="coach";
    auto one=[&](const Position& x){return coach?engine.analyze(x.board,x.player,x.depth,x.model).summary:engine.search(x.board,x.player,budget?0:x.depth,x.model,budget);};
    for(int i=0;i<warmups;i++)for(const auto& x:positions)one(x);
    Counters total{};double checksum=0;std::vector<Result> roots;roots.reserve(repeats*positions.size());
#ifdef __APPLE__
    auto log=os_log_create("org.reversi.profiling","PointsOfInterest");os_signpost_interval_begin(log,OS_SIGNPOST_ID_EXCLUSIVE,"FixedWork","%s","");
#endif
    timespec cpuStart{};clock_gettime(CLOCK_THREAD_CPUTIME_ID,&cpuStart);const auto processStart=std::clock();const auto start=Clock::now();
    for(int i=0;i<repeats;i++)for(const auto& x:positions){const Result r=one(x);roots.push_back(r);checksum+=r.score;add(total,r.stats);}
    const double wall=std::chrono::duration<double>(Clock::now()-start).count();
    timespec cpuEnd{};clock_gettime(CLOCK_THREAD_CPUTIME_ID,&cpuEnd);
    const double threadCpu=cpuEnd.tv_sec-cpuStart.tv_sec+(cpuEnd.tv_nsec-cpuStart.tv_nsec)*1e-9;
    const double processCpu=double(std::clock()-processStart)/CLOCKS_PER_SEC;
#ifdef __APPLE__
    os_signpost_interval_end(log,OS_SIGNPOST_ID_EXCLUSIVE,"FixedWork","%s","");
    std::cout<<"{\"loadAddress\":\"0x"<<std::hex<<reinterpret_cast<uintptr_t>(_dyld_get_image_header(0))<<std::dec<<"\",";
#else
    std::cout<<"{";
#endif
    std::cout<<std::setprecision(17)<<"\"wallSeconds\":"<<wall<<",\"workloadCpuSeconds\":"<<threadCpu<<",\"processCpuSeconds\":"<<processCpu<<",\"checksum\":"<<checksum<<",\"repeats\":"<<repeats<<",\"metrics\":{";print(total);
    std::cout<<"},\"roots\":[";
    for(size_t i=0;i<roots.size();i++){const auto& r=roots[i];std::cout<<(i?",":"")<<"{\"score\":"<<r.score<<",\"move\":"<<r.move<<",\"depth\":"<<r.depth<<",\"exact\":"<<(r.exact?"true":"false")<<",\"hasScore\":"<<(r.hasScore?"true":"false")<<",\"timedOut\":"<<(r.timedOut?"true":"false")<<",\"elapsedMs\":"<<r.elapsedMs<<",\"metrics\":{";print(r.stats);std::cout<<"}}";}
    std::cout<<"]}\n";
  }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
