export { googleClaimsSchema, checkClaims, displayName, CLAIMS_PROBLEMS, GOOGLE_ISSUERS } from "./claims";
export type { GoogleClaims, ClaimsProblem } from "./claims";

export {
  googleClientId,
  isGoogleConfigured,
  readCredential,
  loadGoogleScript,
  googleAccounts,
  forgetGoogleSession,
  hasGoogleConsent,
  hasSkippedSignIn,
  setSkippedSignIn,
  setGoogleConsent,
  GOOGLE_DISCLOSURE,
} from "./google";
export type { GoogleIdentity, GoogleResult } from "./google";
