#pragma once

#include <stdio.h>
#include <stdlib.h>
#include <math.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    int test_count;
    int failure_count;
    int ignore_count;
} UnityState;

static UnityState Unity = {0, 0, 0};

static inline void UNITY_BEGIN(void) {
    Unity.test_count = 0;
    Unity.failure_count = 0;
    Unity.ignore_count = 0;
    printf("\n-----------------------\n");
    printf("Starting Unity Tests...\n");
    printf("-----------------------\n");
}

static inline int UNITY_END(void) {
    printf("\n-----------------------\n");
    printf("%d Tests %d Failures %d Ignored\n", Unity.test_count, Unity.failure_count, Unity.ignore_count);
    if (Unity.failure_count == 0) {
        printf("OK\n");
        return 0;
    } else {
        printf("FAIL\n");
        return 1;
    }
}

extern void setUp(void);
extern void tearDown(void);

#define RUN_TEST(func) do { \
    Unity.test_count++; \
    setUp(); \
    int prev_fails = Unity.failure_count; \
    func(); \
    tearDown(); \
    if (Unity.failure_count == prev_fails) { \
        printf("PASS: %s\n", #func); \
    } else { \
        printf("FAIL: %s\n", #func); \
    } \
} while(0)

#define TEST_ASSERT_TRUE(cond) do { \
    if (!(cond)) { \
        Unity.failure_count++; \
        printf("  Assertion Failed: %s is not TRUE (%s:%d)\n", #cond, __FILE__, __LINE__); \
    } \
} while(0)

#define TEST_ASSERT_FALSE(cond) do { \
    if (cond) { \
        Unity.failure_count++; \
        printf("  Assertion Failed: %s is not FALSE (%s:%d)\n", #cond, __FILE__, __LINE__); \
    } \
} while(0)

#define TEST_ASSERT_EQUAL(expected, actual) do { \
    if ((expected) != (actual)) { \
        Unity.failure_count++; \
        printf("  Assertion Failed: %s != %s (%s:%d)\n", #expected, #actual, __FILE__, __LINE__); \
    } \
} while(0)

#define TEST_ASSERT_FLOAT_WITHIN(delta, expected, actual) do { \
    if (fabsf((float)(expected) - (float)(actual)) > (float)(delta)) { \
        Unity.failure_count++; \
        printf("  Assertion Failed: |%s - %s| > %f (expected: %f, actual: %f) (%s:%d)\n", \
            #expected, #actual, (float)(delta), (float)(expected), (float)(actual), __FILE__, __LINE__); \
    } \
} while(0)

#define TEST_ASSERT_GREATER_THAN(threshold, actual) do { \
    if (!((actual) > (threshold))) { \
        Unity.failure_count++; \
        printf("  Assertion Failed: %s <= %s (%f <= %f) (%s:%d)\n", \
            #actual, #threshold, (float)(actual), (float)(threshold), __FILE__, __LINE__); \
    } \
} while(0)

#define TEST_ASSERT_GREATER_OR_EQUAL(threshold, actual) do { \
    if (!((actual) >= (threshold))) { \
        Unity.failure_count++; \
        printf("  Assertion Failed: %s < %s (%s:%d)\n", #actual, #threshold, __FILE__, __LINE__); \
    } \
} while(0)

#define TEST_ASSERT_LESS_OR_EQUAL(threshold, actual) do { \
    if (!((actual) <= (threshold))) { \
        Unity.failure_count++; \
        printf("  Assertion Failed: %s > %s (%s:%d)\n", #actual, #threshold, __FILE__, __LINE__); \
    } \
} while(0)

#define TEST_ASSERT_NOT_NULL(ptr) do { \
    if ((ptr) == NULL) { \
        Unity.failure_count++; \
        printf("  Assertion Failed: %s is NULL (%s:%d)\n", #ptr, __FILE__, __LINE__); \
    } \
} while(0)

#ifdef __cplusplus
}
#endif

