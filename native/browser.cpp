// C ABI: owns one engine per handle. No stdin/stdout and no per-node JS calls.
#include "engine.hpp"
#include <sstream>
#include <iomanip>
#include <memory>
#include <stdexcept>
#include <cmath>
#ifndef REVERSI_BUILD_ID
#define REVERSI_BUILD_ID "development"
#endif
using namespace reversi;
struct Session { Engine engine; std::string reply; explicit Session(unsigned mib):engine(mib){} };
static void result(std::ostream& o,const Result& r,int model) {
 const auto& c=r.stats;
 o<<"{\"move\":"<<(r.move<0?"null":std::to_string(r.move))<<",\"score\":";
 if(r.hasScore)o<<r.score;else o<<"null";
 o<<",\"depth\":"<<r.depth<<",\"exact\":"<<(r.exact?"true":"false")<<",\"timedOut\":"<<(r.timedOut?"true":"false")
 <<",\"elapsedMs\":"<<r.elapsedMs<<",\"tableBytes\":"<<r.tableBytes<<",\"generation\":"<<r.generation<<",\"modelIdentity\":\""<<modelIdentity(model)<<"\""
 <<",\"nodes\":"<<c.nodes<<",\"evaluations\":"<<c.evaluations<<",\"ttProbes\":"<<c.probes<<",\"ttHits\":"<<c.hits<<",\"ttBoundHits\":"<<c.boundHits
 <<",\"ttCollisions\":"<<c.collisions<<",\"ttReplacements\":"<<c.replacements<<",\"ttCutoffs\":"<<c.ttCutoffs<<",\"cutoffs\":"<<c.cutoffs
 <<",\"ttStores\":"<<c.stores<<",\"ttRejectedStores\":"<<c.rejectedStores<<",\"firstMoveCutoffs\":"<<c.firstMoveCutoffs<<"}";
}
extern "C" {
const char* rv_build_id(){return REVERSI_BUILD_ID;}
int rv_abi(){return 1;}
const char* rv_identity(int model){return model>=0&&model<3?modelIdentity(model):"";}
Session* rv_create(unsigned mib){try{if(mib>32)return nullptr;return new Session(mib);}catch(...){return nullptr;}}
void rv_destroy(Session* s){delete s;}
// Bitboards are split into unsigned 32-bit halves to avoid JS i64 coercion.
// op: 0 inspect, 1 search, 2 all moves/PVs, 3 static throughput, 4 windows test.
const char* rv_query(Session* s,int op,uint32_t bl,uint32_t bh,uint32_t wl,uint32_t wh,int p,int model,int depth,double ms,double limit,int tt,int hints) {
 if(!s)return "{\"error\":{\"code\":\"LIFETIME\",\"message\":\"Closed engine\"}}";
 try {
  Board b{Bits(bl)|(Bits(bh)<<32),Bits(wl)|(Bits(wh)<<32)};
  if((b.black&b.white)||(p!=1&&p!=-1)||model<0||model>2||!std::isfinite(limit)||(op!=4&&limit<0)||limit>9007199254740991.0)throw std::runtime_error("Invalid query");
  s->engine.configure(tt!=0,hints!=0);std::ostringstream o;o<<std::setprecision(17);
  Bits own=p==1?b.black:b.white,opp=p==1?b.white:b.black,moves=legal(own,opp);
  if(op==0){auto f=features(b,p,moves);o<<"{\"evaluation\":"<<evaluate(b,p,model,moves)<<",\"terminalScore\":"<<terminal(b,p)<<",\"terminal\":"<<(!moves&&!legal(opp,own)?"true":"false")<<",\"features\":[";
   for(int j=0;j<7;j++)o<<(j?",":"")<<f[j];o<<"],\"children\":[";bool comma=false;
   for(int q=0;q<64;q++)if(moves&(Bits(1)<<q)){auto c=play(b,p,q);o<<(comma?",":"")<<"{\"move\":"<<q<<",\"black\":\""<<std::hex<<c.black<<"\",\"white\":\""<<c.white<<std::dec<<"\"}";comma=true;}o<<"]}";
  }else if(op==1)result(o,s->engine.search(b,p,depth,model,ms,uint64_t(limit)),model);
  else if(op==2){auto a=s->engine.analyze(b,p,depth,model);o<<"{\"summary\":";result(o,a.summary,model);o<<",\"results\":[";bool comma=false;
   for(const auto& row:a.moves){o<<(comma?",":"")<<"{\"search\":";result(o,row.result,model);o<<",\"pv\":[";for(size_t j=0;j<row.pv.size();j++)o<<(j?",":"")<<row.pv[j];o<<"]}";comma=true;}o<<"]}";
  }else if(op==3){if(depth<1||depth>10000000)throw std::runtime_error("Invalid repeat count");auto start=Clock::now();double sum=0;for(int j=0;j<depth;j++)sum+=evaluate(b,p,model,legal(own,opp));o<<"{\"checksum\":"<<sum<<",\"elapsedMs\":"<<std::chrono::duration<double,std::milli>(Clock::now()-start).count()<<",\"evaluations\":"<<depth<<"}";
  }else if(op==4){auto values=s->engine.windows(b,p,depth,model,{{ms,limit},{-1e9,1e9}});o<<"{\"values\":["<<values[0]<<","<<values[1]<<"]}";
  }else throw std::runtime_error("Unknown operation");
  s->reply=o.str();
 }catch(const std::exception& e){s->reply=std::string("{\"error\":{\"code\":\"ENGINE\",\"message\":\"")+e.what()+"\"}}";}
 return s->reply.c_str();
}
}
