// This translation unit must be compiled with the explicit enhanced flags.
#if !defined(REVERSI_CPU_DISPATCH) || !defined(__x86_64__) || !defined(__POPCNT__) || !defined(__BMI__) || !defined(__BMI2__) || !defined(__LZCNT__) || defined(__EMSCRIPTEN__) || defined(__APPLE__)
#error "Enhanced engine requires the qualified x86 target flags and dispatch build"
#endif
#define RV_ISA 1
#define RV_HELPERS cpu_enhanced
#include "engine-impl.inc"
