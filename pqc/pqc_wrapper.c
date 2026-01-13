#include <stdlib.h>
#include <string.h>
#include <oqs/oqs.h>
#include <emscripten.h>

// We use Kyber512
#define KEM_ALG_NAME "Kyber512"

// --- FIX: Get sizes dynamically instead of using hardcoded macros ---

EMSCRIPTEN_KEEPALIVE
int get_public_key_bytes() {
    OQS_KEM *kem = OQS_KEM_new(KEM_ALG_NAME);
    if (kem == NULL) return 0;
    int len = kem->length_public_key;
    OQS_KEM_free(kem);
    return len;
}

EMSCRIPTEN_KEEPALIVE
int get_secret_key_bytes() {
    OQS_KEM *kem = OQS_KEM_new(KEM_ALG_NAME);
    if (kem == NULL) return 0;
    int len = kem->length_secret_key;
    OQS_KEM_free(kem);
    return len;
}

EMSCRIPTEN_KEEPALIVE
int get_ciphertext_bytes() {
    OQS_KEM *kem = OQS_KEM_new(KEM_ALG_NAME);
    if (kem == NULL) return 0;
    int len = kem->length_ciphertext;
    OQS_KEM_free(kem);
    return len;
}

EMSCRIPTEN_KEEPALIVE
int get_shared_secret_bytes() {
    OQS_KEM *kem = OQS_KEM_new(KEM_ALG_NAME);
    if (kem == NULL) return 0;
    int len = kem->length_shared_secret;
    OQS_KEM_free(kem);
    return len;
}
// ------------------------------------------------------------------

// 1. Generate Keypair
// Puts Public Key in pk, Secret Key in sk
EMSCRIPTEN_KEEPALIVE
int generate_keypair(uint8_t *pk, uint8_t *sk) {
    OQS_KEM *kem = OQS_KEM_new(KEM_ALG_NAME);
    if (kem == NULL) return 1; // Error

    OQS_STATUS rc = OQS_KEM_keypair(kem, pk, sk);
    
    OQS_KEM_free(kem);
    return (rc == OQS_SUCCESS) ? 0 : 1;
}

// 2. Encapsulate
// Uses pk to generate a shared secret (ss) and ciphertext (ct)
EMSCRIPTEN_KEEPALIVE
int encapsulate(uint8_t *ct, uint8_t *ss, uint8_t *pk) {
    OQS_KEM *kem = OQS_KEM_new(KEM_ALG_NAME);
    if (kem == NULL) return 1;

    OQS_STATUS rc = OQS_KEM_encaps(kem, ct, ss, pk);

    OQS_KEM_free(kem);
    return (rc == OQS_SUCCESS) ? 0 : 1;
}

// 3. Decapsulate
// Uses sk and ct to recover the shared secret (ss)
EMSCRIPTEN_KEEPALIVE
int decapsulate(uint8_t *ss, uint8_t *ct, uint8_t *sk) {
    OQS_KEM *kem = OQS_KEM_new(KEM_ALG_NAME);
    if (kem == NULL) return 1;

    OQS_STATUS rc = OQS_KEM_decaps(kem, ss, ct, sk);

    OQS_KEM_free(kem);
    return (rc == OQS_SUCCESS) ? 0 : 1;
}