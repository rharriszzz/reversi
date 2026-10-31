// Diagnostic-only complete playing/all-move workloads; never a timing build.
#include "engine.hpp"
#include <iostream>
#include <iomanip>
#include <ctime>
#include <string>
using namespace reversi;
int main(int argc,char**argv) {
 if(argc!=8)return 2;
 const Board b{std::stoull(argv[2],nullptr,16),std::stoull(argv[3],nullptr,16)};
 const int p=std::stoi(argv[4]),depth=std::stoi(argv[5]);
 const double seconds=std::stod(argv[6]);const int model=std::stoi(argv[7]);
 Engine e(16);e.configure(true,false);uint64_t searches=0,nodes=0;double checksum=0;
 std::cout<<"READY\n"<<std::flush;const auto start=Clock::now();const auto cpu=std::clock();
 do {
  const auto r=std::string(argv[1])=="coach"?e.analyze(b,p,depth,model).summary:e.search(b,p,depth,model);
  searches++;nodes+=r.stats.nodes;checksum+=r.score;
 }while(std::chrono::duration<double>(Clock::now()-start).count()<seconds);
 std::cout<<std::setprecision(17)<<"{\"searches\":"<<searches<<",\"nodes\":"<<nodes<<",\"checksum\":"<<checksum
  <<",\"wallSeconds\":"<<std::chrono::duration<double>(Clock::now()-start).count()<<",\"cpuSeconds\":"<<double(std::clock()-cpu)/CLOCKS_PER_SEC
  <<",\"tableBytes\":"<<e.tableBytes()<<",\"exclusiveNs\":[";
 for(int i=0;i<Profile::Count;i++)std::cout<<(i?",":"")<<profile.ns[i];std::cout<<"],\"spanCalls\":[";
 for(int i=0;i<Profile::Count;i++)std::cout<<(i?",":"")<<profile.calls[i];std::cout<<"]}\n";
}
