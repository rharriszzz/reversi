#include "engine.hpp"
#include <fstream>
#include <sstream>
#include <iostream>
#include <iomanip>
#include <stdexcept>
#include <memory>
#include <ctime>
#include <cmath>
using namespace reversi;
namespace {
Bits bits(const std::string& s) {
  if(s.empty()||s.size()>16||s.find_first_not_of("0123456789abcdefABCDEF")!=std::string::npos)throw std::runtime_error("Invalid bitboard");
  return std::stoull(s,nullptr,16);
}
std::string hex(Bits b) {std::ostringstream s;s<<std::hex<<b;return s.str();}
void counters(const Counters& c) {
  std::cout<<",\"nodes\":"<<c.nodes<<",\"evaluations\":"<<c.evaluations<<",\"ttProbes\":"<<c.probes<<",\"ttHits\":"<<c.hits<<",\"ttBoundHits\":"<<c.boundHits<<",\"ttCollisions\":"<<c.collisions<<",\"ttReplacements\":"<<c.replacements<<",\"cutoffs\":"<<c.cutoffs<<",\"ttCutoffs\":"<<c.ttCutoffs<<",\"ttStores\":"<<c.stores<<",\"ttRejectedStores\":"<<c.rejectedStores<<",\"firstMoveCutoffs\":"<<c.firstMoveCutoffs;
}
void result(const Result& r,int model) {
  std::cout<<",\"move\":";if(r.move<0)std::cout<<"null";else std::cout<<r.move;
  std::cout<<",\"score\":";if(r.hasScore)std::cout<<r.score;else std::cout<<"null";
  std::cout<<",\"depth\":"<<r.depth<<",\"exact\":"<<(r.exact?"true":"false")<<",\"timedOut\":"<<(r.timedOut?"true":"false")<<",\"elapsedMs\":"<<r.elapsedMs<<",\"cpuMs\":"<<r.cpuMs<<",\"tableBytes\":"<<r.tableBytes<<",\"generation\":"<<r.generation<<",\"modelIdentity\":\""<<modelIdentity(model)<<'"';counters(r.stats);
}
void end(std::istringstream& s) {std::string extra;if(s>>extra)throw std::runtime_error("Unexpected arguments");}
}
int main(int argc,char**argv) {
  std::cout<<std::setprecision(17);std::unique_ptr<Engine> engine;
  try {if(argc>2)throw std::runtime_error("Usage: reversi-native [TT MiB]");size_t mib=16;
    if(argc==2){std::string value=argv[1];if(value.empty()||value.find_first_not_of("0123456789")!=std::string::npos)throw std::runtime_error("Invalid TT size");mib=std::stoull(value);}
    engine=std::make_unique<Engine>(mib);
  }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
  std::string line;
  while(std::getline(std::cin,line)) {
    uint64_t id=0;std::ostringstream output;
    try {
      if(line.size()>8192)throw std::runtime_error("Request too long");
      std::istringstream in(line);std::string command;
      if(!(in>>id>>command))throw std::runtime_error("Expected request id and command");
      // Construct the entire reply before writing: errors cannot leave partial JSON.
      auto* prior=std::cout.rdbuf(output.rdbuf());
      try {
        std::cout<<"{\"id\":"<<id;
        if(command=="hello") {end(in);std::cout<<",\"protocol\":1,\"tableBytes\":"<<engine->tableBytes()<<",\"models\":[";for(int i=0;i<3;i++)std::cout<<(i?",":"")<<'"'<<modelIdentity(i)<<'"';std::cout<<"]";}
        else if(command=="profile") {end(in);std::cout<<",\"ns\":[";for(int i=0;i<Profile::Count;i++)std::cout<<(i?",":"")<<profile.ns[i];std::cout<<"],\"calls\":[";for(int i=0;i<Profile::Count;i++)std::cout<<(i?",":"")<<profile.calls[i];std::cout<<"]";}
        else {
          std::string black,white;int player,model;
          if(!(in>>black>>white>>player>>model))throw std::runtime_error("Expected black white player model");
          Board b{bits(black),bits(white)};
          if((b.black&b.white)||(player!=1&&player!=-1)||model<0||model>2)throw std::runtime_error("Invalid board/player/model");
          Bits moves=legal(player==1?b.black:b.white,player==1?b.white:b.black);
          if(command=="inspect") {
            end(in);auto f=features(b,player,moves);
            std::cout<<",\"evaluation\":"<<evaluate(b,player,model,moves)<<",\"terminalScore\":"<<terminal(b,player)<<",\"margin\":"<<(pop(b.black)-pop(b.white))*player<<",\"terminal\":"<<(!moves&&!legal(player==1?b.white:b.black,player==1?b.black:b.white)?"true":"false")<<",\"features\":[";
            for(int i=0;i<7;i++)std::cout<<(i?",":"")<<f[i];std::cout<<"],\"children\":[";bool comma=false;
            for(int q=0;q<64;q++)if(moves&(Bits(1)<<q)) {auto c=play(b,player,q);std::cout<<(comma?",":"")<<"{\"move\":"<<q<<",\"black\":\""<<hex(c.black)<<"\",\"white\":\""<<hex(c.white)<<"\"}";comma=true;}std::cout<<"]";
          }else if(command=="search") {
            int depth,tt,hints;double ms,deadlineUnixMs;uint64_t limit;
            if(!(in>>depth>>ms>>tt>>hints>>limit>>deadlineUnixMs)||(tt!=0&&tt!=1)||(hints!=0&&hints!=1))throw std::runtime_error("Invalid search options");end(in);
            if(!std::isfinite(deadlineUnixMs)||deadlineUnixMs<0)throw std::runtime_error("Invalid external deadline");
            if(ms>0&&deadlineUnixMs>0) {double now=std::chrono::duration<double,std::milli>(std::chrono::system_clock::now().time_since_epoch()).count();ms=std::min(ms,std::max(.000001,deadlineUnixMs-now));}
            engine->configure(tt,hints);result(engine->search(b,player,depth,model,ms,limit),model);
          }else if(command=="windows") {
            int depth,n,tt;if(!(in>>depth>>tt>>n)||n<1||n>32||(tt!=0&&tt!=1))throw std::runtime_error("Invalid windows");
            std::vector<std::array<double,2>> ranges(n);for(auto& w:ranges)if(!(in>>w[0]>>w[1]))throw std::runtime_error("Truncated windows");end(in);engine->configure(tt,true);
            auto values=engine->windows(b,player,depth,model,ranges);std::cout<<",\"values\":[";for(size_t i=0;i<values.size();i++)std::cout<<(i?",":"")<<values[i];std::cout<<"]";
          }else if(command=="evalbench") {
            int n;if(!(in>>n)||n<1||n>10000000)throw std::runtime_error("Invalid repeat count");end(in);auto start=Clock::now();auto cpu=std::clock();double checksum=0;
            for(int i=0;i<n;i++)checksum+=evaluate(b,player,model,legal(player==1?b.black:b.white,player==1?b.white:b.black));
            std::cout<<",\"checksum\":"<<checksum<<",\"evaluations\":"<<n<<",\"elapsedMs\":"<<std::chrono::duration<double,std::milli>(Clock::now()-start).count()<<",\"cpuMs\":"<<1000.*(std::clock()-cpu)/CLOCKS_PER_SEC;
          }else throw std::runtime_error("Unknown command");
        }
        std::cout<<"}\n";
      }catch(...){std::cout.rdbuf(prior);throw;}
      std::cout.rdbuf(prior);std::cout<<output.str()<<std::flush;
    }catch(const std::exception& e) {
      // All error messages are internal constant strings or numeric parse errors.
      std::cout<<"{\"id\":"<<id<<",\"error\":\""<<e.what()<<"\"}\n"<<std::flush;
    }
  }
}
