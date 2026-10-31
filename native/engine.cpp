// Portable entry points and CPU selection are always compiled at baseline.
#define RV_ISA 0
#define RV_HELPERS cpu_portable
#include "engine-impl.inc"
#include <cstdlib>
#include <cstring>
namespace reversi {
Profile profile;
CpuFeatures cpuFeatures() {
  static const CpuFeatures detected=[] {
    CpuFeatures f;
#if defined(REVERSI_CPU_DISPATCH) && defined(__x86_64__) && defined(__GNUC__) && !defined(__EMSCRIPTEN__) && !defined(__APPLE__)
    __builtin_cpu_init();
    f.popcnt=__builtin_cpu_supports("popcnt");f.bmi1=__builtin_cpu_supports("bmi");
    f.bmi2=__builtin_cpu_supports("bmi2");f.lzcnt=__builtin_cpu_supports("lzcnt");
#endif
    return f;
  }();
  return detected;
}
static bool selectEnhanced() {
#ifdef REVERSI_CPU_DISPATCH
  const char* request=std::getenv("REVERSI_CPU_BACKEND");
  if(request && std::strcmp(request,"portable")==0)return false;
  if(request && std::strcmp(request,"auto")!=0 && std::strcmp(request,"enhanced")!=0)
    throw std::runtime_error("REVERSI_CPU_BACKEND must be auto, portable or enhanced");
  const bool supported=cpuFeatures().enhanced();
  if(request && std::strcmp(request,"enhanced")==0 && !supported)
    throw std::runtime_error("Enhanced CPU backend is unsupported on this processor");
  return supported;
#else
  return false;
#endif
}
Engine::Engine(size_t mib):enhancedBackend(selectEnhanced()) {
  if(mib>1024)throw std::runtime_error("TT must be 0..1024 MiB");
  size_t count=1,target=std::max(size_t(1),mib*1024*1024/sizeof(Entry));
  while(count<=target/2)count*=2;table.resize(count);
}

void Engine::nextGeneration() {if(++generation==0){std::fill(table.begin(),table.end(),Entry{});generation=1;}}
const char* modelIdentity(int model) {return frozen::identities[model];}
const char* Engine::backendName() const {return enhancedBackend?"x86-popcnt-bmi1-bmi2-lzcnt":"portable";}
int pop(Bits x) {return cpu_portable::pop(x);}
Bits legal(Bits a,Bits b) {return cpu_portable::legal(a,b);}
Bits flips(Bits a,Bits b,int q) {return cpu_portable::flips(a,b,q);}
Board play(Board b,int p,int q) {return cpu_portable::play(b,p,q);}
double terminal(Board b,int p) {return cpu_portable::terminal(b,p);}
std::array<double,7> features(Board b,int p,Bits m) {return cpu_portable::features(b,p,m);}
double evaluate(Board b,int p,int m,Bits moves) {return cpu_portable::evaluate(b,p,m,moves);}
double patterns(Board b,int phase) {return cpu_portable::patterns(b,phase);}
Result Engine::search(Board b,int p,int d,int m,double ms,uint64_t nodes) {
#ifdef REVERSI_CPU_DISPATCH
  if(enhancedBackend)return searchImpl<1>(b,p,d,m,ms,nodes);
#endif
  return searchImpl<0>(b,p,d,m,ms,nodes);
}
Analysis Engine::analyze(Board b,int p,int d,int m) {
#ifdef REVERSI_CPU_DISPATCH
  if(enhancedBackend)return analyzeImpl<1>(b,p,d,m);
#endif
  return analyzeImpl<0>(b,p,d,m);
}
std::vector<double> Engine::windows(Board b,int p,int d,int m,const std::vector<std::array<double,2>>& ranges) {
#ifdef REVERSI_CPU_DISPATCH
  if(enhancedBackend)return windowsImpl<1>(b,p,d,m,ranges);
#endif
  return windowsImpl<0>(b,p,d,m,ranges);
}
}
