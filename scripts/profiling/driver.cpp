// Experiment-only fixed-work harness. No production engine instrumentation.
// IP collection reads ARM_THREAD_STATE64 only: no stack memory or unwind.
#include "engine.hpp"
#include <mach/mach.h>
#include <mach/arm/thread_status.h>
#include <mach-o/dyld.h>
#include <dlfcn.h>
#include <map>
#include <os/signpost.h>
#include <atomic>
#include <thread>
#include <iostream>
#include <iomanip>
#include <fstream>
#include <ctime>
#include <vector>
#include <stdexcept>
using namespace reversi;
struct Point {double seconds; uint64_t pc;};
double threadCpu() { timespec t{};clock_gettime(CLOCK_THREAD_CPUTIME_ID,&t);return t.tv_sec+t.tv_nsec*1e-9; }
struct Totals {Counters c;double checksum=0;bool exact=true;int completedDepth=0;};
Result one(Engine& e,Board b,int p,int depth,int model,bool coach) {
 return coach?e.analyze(b,p,depth,model).summary:e.search(b,p,depth,model);
}
__attribute__((noinline)) Totals runFixed(Engine& e,Board b,int p,int depth,int model,bool coach,int repeats,bool evaluation=false) {
 Totals t;
 if(evaluation) {
  const Bits ownMoves=legal(p==1?b.black:b.white,p==1?b.white:b.black);
  // External production evaluate, no LTO; one block = 4096 evaluations.
  for(int i=0;i<repeats;i++) for(int j=0;j<4096;j++) t.checksum+=evaluate(b,p,model,ownMoves);
  t.c.evaluations=uint64_t(repeats)*4096;t.exact=false;return t;
 }
 for(int i=0;i<repeats;i++) {
  const Result r=one(e,b,p,depth,model,coach);t.checksum+=r.score;t.exact=t.exact&&r.exact;t.completedDepth=r.depth;
  // Explicit fields avoid layout/type-punning assumptions.
#define ADD(x) t.c.x+=r.stats.x
  ADD(nodes);ADD(evaluations);ADD(probes);ADD(hits);ADD(boundHits);ADD(collisions);ADD(replacements);ADD(cutoffs);ADD(ttCutoffs);ADD(horizonHits);ADD(stores);ADD(rejectedStores);ADD(firstMoveCutoffs);
#undef ADD
 }
 return t;
}
int main(int argc,char** argv) {
 if(argc!=11){std::cerr<<"mode blackHex whiteHex player depth model repeats warmups ipIntervalUs rawPath\n";return 2;}
 try {
  Board b{std::stoull(argv[2],nullptr,16),std::stoull(argv[3],nullptr,16)};
  const int p=std::stoi(argv[4]),depth=std::stoi(argv[5]),model=std::stoi(argv[6]),repeats=std::stoi(argv[7]),warmups=std::stoi(argv[8]),interval=std::stoi(argv[9]);
  if(repeats<1||warmups<0||interval<0||interval>1000000)throw std::runtime_error("Invalid work limits");
  const bool evaluation=std::string(argv[1])=="evaluate";
  const bool coach=std::string(argv[1])=="coach";Engine e(16);e.configure(true,false);
  runFixed(e,b,p,depth,model,coach,warmups,evaluation);
  std::atomic<bool> active{false},done{false};std::vector<Point> points;points.reserve(interval?100000:0);
  uint64_t failures=0,attempts=0;double collectorCpu=0;const thread_t target=mach_thread_self();
  auto epoch=Clock::now();std::thread sampler;
  if(interval) sampler=std::thread([&]{
   while(!active.load(std::memory_order_acquire)&&!done.load())std::this_thread::yield();
   const double cpu=threadCpu();
   while(!done.load(std::memory_order_acquire)) {
    std::this_thread::sleep_for(std::chrono::microseconds(interval));if(done.load())break;
    attempts++;const auto suspended=thread_suspend(target);
    if(suspended!=KERN_SUCCESS){failures++;continue;}
    arm_thread_state64_t state{};mach_msg_type_number_t count=ARM_THREAD_STATE64_COUNT;
    const auto status=thread_get_state(target,ARM_THREAD_STATE64,reinterpret_cast<thread_state_t>(&state),&count);
    const double timestamp=std::chrono::duration<double>(Clock::now()-epoch).count();
    const uint64_t pc=status==KERN_SUCCESS?arm_thread_state64_get_pc(state):0;
    if(thread_resume(target)!=KERN_SUCCESS)std::terminate();
    if(status==KERN_SUCCESS&&points.size()<100000)points.push_back({timestamp,pc});else failures++;
   }
   collectorCpu=threadCpu()-cpu;
  });
  const auto log=os_log_create("org.reversi.profiling","PointsOfInterest");
  os_signpost_interval_begin(log,OS_SIGNPOST_ID_EXCLUSIVE,"FixedWork","%s","");
  epoch=Clock::now();const auto start=epoch;const double cpu=threadCpu(),process=double(std::clock())/CLOCKS_PER_SEC;
  active.store(true,std::memory_order_release);const Totals t=runFixed(e,b,p,depth,model,coach,repeats,evaluation);
  const double workloadCpu=threadCpu()-cpu,processCpu=double(std::clock())/CLOCKS_PER_SEC-process;
  const double wall=std::chrono::duration<double>(Clock::now()-start).count();done.store(true,std::memory_order_release);
  os_signpost_interval_end(log,OS_SIGNPOST_ID_EXCLUSIVE,"FixedWork","%s","");
  if(sampler.joinable())sampler.join();mach_port_deallocate(mach_task_self(),target);
  if(interval){std::ofstream raw(argv[10]);raw<<std::setprecision(17)<<"{\"loadAddress\":\"0x"<<std::hex<<reinterpret_cast<uintptr_t>(_dyld_get_image_header(0))<<std::dec<<"\",\"points\":[";
   for(size_t i=0;i<points.size();i++)raw<<(i?",":"")<<"["<<points[i].seconds<<",\"0x"<<std::hex<<points[i].pc<<std::dec<<"\"]";
   // Resolve module membership after clocks stop; source symbolization is offline.
   raw<<"],\"addresses\":[";std::map<uint64_t,bool> unique;for(const auto& point:points)unique[point.pc]=true;bool comma=false;
   for(const auto& entry:unique){Dl_info info{};dladdr(reinterpret_cast<void*>(entry.first),&info);raw<<(comma?",":"")<<"[\"0x"<<std::hex<<entry.first<<"\",\""<<(info.dli_fname?info.dli_fname:"unknown")<<"\",\"0x"<<reinterpret_cast<uintptr_t>(info.dli_fbase)<<"\"]"<<std::dec;comma=true;}
   raw<<"]}\n";}
  std::cout<<std::setprecision(17)<<"{\"loadAddress\":\"0x"<<std::hex<<reinterpret_cast<uintptr_t>(_dyld_get_image_header(0))<<std::dec<<"\",\"workStartMonotonicNs\":"<<std::chrono::duration_cast<std::chrono::nanoseconds>(start.time_since_epoch()).count()<<",\"wallSeconds\":"<<wall<<",\"workloadCpuSeconds\":"<<workloadCpu<<",\"processCpuSeconds\":"<<processCpu<<",\"collectorThreadCpuSeconds\":"<<collectorCpu<<",\"ipAttempts\":"<<attempts<<",\"ipFailures\":"<<failures<<",\"ipSamples\":"<<points.size()<<",\"repeats\":"<<repeats<<",\"checksum\":"<<t.checksum<<",\"exact\":"<<(t.exact?"true":"false")<<",\"depth\":"<<t.completedDepth<<",\"tableBytes\":"<<e.tableBytes()<<",\"metrics\":{";
#define PRINT(x) std::cout<<"\"" #x "\":"<<t.c.x<<","
  PRINT(nodes);PRINT(evaluations);PRINT(probes);PRINT(hits);PRINT(boundHits);PRINT(collisions);PRINT(replacements);PRINT(cutoffs);PRINT(ttCutoffs);PRINT(horizonHits);PRINT(stores);PRINT(rejectedStores);
#undef PRINT
  std::cout<<"\"firstMoveCutoffs\":"<<t.c.firstMoveCutoffs<<"}}\n";
 }catch(const std::exception& x){std::cerr<<x.what()<<"\n";return 1;}
}
