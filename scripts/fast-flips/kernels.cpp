#include "candidates.hpp"
// Separate translation unit, no LTO, identical external-call measurement boundary.
using flip_experiment::Bits;
extern "C" {
#define KERNEL(N) Bits kernel##N(Bits a,Bits b,int q){return flip_experiment::calculate<N>(a,b,q);}
KERNEL(0) KERNEL(1) KERNEL(2) KERNEL(3) KERNEL(4)
}
