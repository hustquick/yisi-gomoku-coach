#ifndef RapfiBridge_h
#define RapfiBridge_h

#ifdef __cplusplus
extern "C" {
#endif

const char *rf_initialize(const char *config_path);
const char *rf_analyze(const char *commands);
void rf_stop(void);

#ifdef __cplusplus
}
#endif

#endif

