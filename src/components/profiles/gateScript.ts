import { REGISTRY_STORAGE_KEY, UNLOCKED_SESSION_KEY } from "@/lib/profiles";

/** Set on `<html>` while the app must stay hidden. Cleared by the gate once it decides. */
export const GATE_ATTRIBUTE = "data-gate";

/**
 * Runs before first paint, for the same reason the theme script does: to stop the wrong
 * thing appearing for a frame.
 *
 * Without it a locked profile would show the app shell until React hydrated and replaced
 * it. The prerendered HTML holds no learner data — every figure is read from IndexedDB
 * after mount — so nothing private leaks in that frame, but a lock that visibly flickers
 * open is not worth having.
 *
 * Kept in sync with the registry module by hand; both read the same two storage keys.
 */
export const GATE_INIT_SCRIPT = `(function(){try{
var r=JSON.parse(localStorage.getItem(${JSON.stringify(REGISTRY_STORAGE_KEY)})||"null");
if(!r||!Array.isArray(r.profiles)||r.profiles.length===0)return;
var p=null,i=0;for(;i<r.profiles.length;i++){if(r.profiles[i].id===r.activeId){p=r.profiles[i];break}}
var hide=p?(!!p.passcode&&sessionStorage.getItem(${JSON.stringify(UNLOCKED_SESSION_KEY)})!==p.id):true;
if(hide)document.documentElement.setAttribute(${JSON.stringify(GATE_ATTRIBUTE)},"1");
}catch(e){}})()`
  .split("\n")
  .join("");
