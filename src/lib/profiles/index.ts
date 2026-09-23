export {
  isPasscodeSupported,
  isValidPasscode,
  hashPasscode,
  verifyPasscode,
  PasscodeUnsupportedError,
  PASSCODE_MIN_LENGTH,
  PASSCODE_MAX_LENGTH,
} from "./passcode";
export type { Passcode } from "./passcode";

export {
  readRegistry,
  writeRegistry,
  initialRegistry,
  newProfile,
  findProfile,
  activeProfile,
  activeDbName,
  dbNameFor,
  isNameTaken,
  addProfile,
  renameProfile,
  removeProfile,
  setPasscode,
  switchTo,
  isUnlocked,
  markUnlocked,
  clearUnlocked,
  profileSchema,
  registrySchema,
  LEGACY_PROFILE_ID,
  MAX_PROFILES,
  REGISTRY_STORAGE_KEY,
  UNLOCKED_SESSION_KEY,
} from "./registry";
export type { Profile, ProfileRegistry } from "./registry";
