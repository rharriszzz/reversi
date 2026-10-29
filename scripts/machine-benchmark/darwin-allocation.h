/* Build-only portability adapter for pinned Edax on Darwin.
 * C17 aligned_alloc requires size to be a multiple of alignment. Edax's
 * hash-table padding violates that requirement; glibc accepts it, Darwin does
 * not. Round the allocation UP without changing the logical table or indexing.
 * Include stdlib before the macro so its declaration stays unmodified.
 */
#include <stdlib.h>
static inline void *reversi_aligned_alloc(size_t alignment, size_t size)
{
    if (!alignment || size > (size_t)-1 - (alignment - 1)) return NULL;
    return aligned_alloc(alignment, ((size + alignment - 1) / alignment) * alignment);
}
#define aligned_alloc(alignment, size) reversi_aligned_alloc((alignment), (size))
