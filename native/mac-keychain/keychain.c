// Edunex Plus's keychain helper, for macOS (docs/adr/0003-mac-keychain-helper.md).
//
// macOS lets an app back into a keychain entry without asking only while it's the exact build the
// Student allowed, unless Apple issued the app's certificate (it then goes by the developer's team).
// Every update of Edunex Plus is another build, so macOS asked for the Student's password after
// each one. This helper is the same build in every release: it keeps the one key the app's saved
// sign-ins are locked with ("Edunex Plus Vault" in the login keychain), and macOS, seeing the build
// it already knows, lets it in without asking.
//
// It answers only Edunex Plus itself: the process that started it must be the app, signed with the
// project's certificate. Anything else, Terminal included, gets nothing.
//
//   Edunex Plus Keychain key      prints the key (64 hex digits), making one the first time
//   Edunex Plus Keychain forget   deletes it
//
// Exits 0 when done, 64 for anything but those two, 77 when not started by Edunex Plus, 74 when the
// keychain refused or failed (its reason on stderr).
//
// Changing this file, or building it again, makes another build: every Student is asked for their
// password once more. Read scripts/build-keychain-helper.mjs first.
#include <CoreFoundation/CoreFoundation.h>
#include <Security/Security.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

#ifndef VAULT_SERVICE
#define VAULT_SERVICE "Edunex Plus Vault"
#endif
// The app, as its signature names it (`codesign -d -r-`): its identifier, and the project's certificate.
#ifndef APP_REQUIREMENT
#define APP_REQUIREMENT "identifier \"id.edunexplus.desktop\" and certificate root = H\"e49f5771b5ab0e7f802be8c19bddbc2e56c1d816\""
#endif

#define KEY_BYTES 32

/** Whether the process that started this one is Edunex Plus, signed with the project's certificate and still valid. */
static int asked_by_app(void) {
  pid_t parent = getppid();
  if (parent <= 1) return 0;
  CFNumberRef pid = CFNumberCreate(NULL, kCFNumberIntType, &parent);
  CFDictionaryRef attributes =
      CFDictionaryCreate(NULL, (const void **)&kSecGuestAttributePid, (const void **)&pid, 1, &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
  SecCodeRef code = NULL;
  SecRequirementRef requirement = NULL;
  int ok = SecCodeCopyGuestWithAttributes(NULL, attributes, kSecCSDefaultFlags, &code) == errSecSuccess &&
           SecRequirementCreateWithString(CFSTR(APP_REQUIREMENT), kSecCSDefaultFlags, &requirement) == errSecSuccess &&
           SecCodeCheckValidity(code, kSecCSDefaultFlags, requirement) == errSecSuccess;
  if (requirement) CFRelease(requirement);
  if (code) CFRelease(code);
  CFRelease(attributes);
  CFRelease(pid);
  // The same process all along: had it ended, this one would now belong to launchd.
  return ok && getppid() == parent;
}

/** The keychain entry, as a query to add to. */
static CFMutableDictionaryRef entry(void) {
  CFMutableDictionaryRef query = CFDictionaryCreateMutable(NULL, 0, &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
  CFDictionarySetValue(query, kSecClass, kSecClassGenericPassword);
  CFDictionarySetValue(query, kSecAttrService, CFSTR(VAULT_SERVICE));
  CFDictionarySetValue(query, kSecAttrAccount, CFSTR("key"));
  return query;
}

static OSStatus read_key(CFTypeRef *key) {
  CFMutableDictionaryRef query = entry();
  CFDictionarySetValue(query, kSecReturnData, kCFBooleanTrue);
  CFDictionarySetValue(query, kSecMatchLimit, kSecMatchLimitOne);
  OSStatus status = SecItemCopyMatching(query, key);
  CFRelease(query);
  return status;
}

/** A new random key, in an entry only this helper may read. */
static OSStatus make_key(void) {
  UInt8 bytes[KEY_BYTES];
  if (SecRandomCopyBytes(kSecRandomDefault, sizeof bytes, bytes) != errSecSuccess) return errSecAllocate;
  CFDataRef data = CFDataCreate(NULL, bytes, sizeof bytes);
  memset_s(bytes, sizeof bytes, 0, sizeof bytes);
  CFMutableDictionaryRef item = entry();
  CFDictionarySetValue(item, kSecValueData, data);
  CFDictionarySetValue(item, kSecAttrLabel, CFSTR(VAULT_SERVICE));
  CFDictionarySetValue(item, kSecAttrDescription, CFSTR("Edunex Plus: the key its saved sign-ins are locked with"));
  OSStatus status = SecItemAdd(item, NULL);
  CFRelease(item);
  CFRelease(data);
  // Another start of the app made it first: that one is read.
  return status == errSecDuplicateItem ? errSecSuccess : status;
}

static int print_key(void) {
  CFTypeRef key = NULL;
  OSStatus status = read_key(&key);
  if (status == errSecItemNotFound) {
    status = make_key();
    if (status == errSecSuccess) status = read_key(&key);
  }
  if (status != errSecSuccess) {
    fprintf(stderr, "keychain: %d\n", (int)status);
    return 74;
  }
  if (CFGetTypeID(key) != CFDataGetTypeID() || CFDataGetLength((CFDataRef)key) != KEY_BYTES) {
    fprintf(stderr, "keychain: the entry holds no key\n");
    CFRelease(key);
    return 74;
  }
  const UInt8 *bytes = CFDataGetBytePtr((CFDataRef)key);
  for (CFIndex i = 0; i < KEY_BYTES; i++) printf("%02x", bytes[i]);
  printf("\n");
  CFRelease(key);
  return fflush(stdout) == 0 ? 0 : 74;
}

static int forget_key(void) {
  CFMutableDictionaryRef query = entry();
  OSStatus status = SecItemDelete(query);
  CFRelease(query);
  if (status == errSecSuccess || status == errSecItemNotFound) return 0;
  fprintf(stderr, "keychain: %d\n", (int)status);
  return 74;
}

int main(int argc, char **argv) {
  int key = argc == 2 && strcmp(argv[1], "key") == 0;
  int forget = argc == 2 && strcmp(argv[1], "forget") == 0;
  if (!key && !forget) {
    fprintf(stderr, "usage: %s key|forget\n", argv[0]);
    return 64;
  }
  if (!asked_by_app()) {
    fprintf(stderr, "only Edunex Plus may ask\n");
    return 77;
  }
  return key ? print_key() : forget_key();
}
