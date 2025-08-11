import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory } from "./token_backend.did.js";

// Hardcode the correct canister ID for local development
const BACKEND_CANISTER_ID = "uxrrr-q7777-77774-qaaaq-cai";

// Add unique timestamp for debugging and cache busting
const BUILD_TIMESTAMP = Date.now() + Math.random();
console.log(
  "=== CANISTER.JS LOADED - VERSION 5.0 - STANDARD AGENT ONLY ===",
  BUILD_TIMESTAMP
);
console.log("BACKEND_CANISTER_ID constant:", BACKEND_CANISTER_ID);
console.log("Using standard DFINITY agent for all environments");

// Create canister actor using standard DFINITY agent
export const createCanisterActor = async (identity) => {
  console.log(
    "=== CREATING STANDARD AGENT ACTOR - VERSION 5.0 ===",
    BUILD_TIMESTAMP
  );
  console.log("Identity provided:", !!identity);
  console.log("Identity principal:", identity?.getPrincipal?.()?.toText?.());

  if (!identity) {
    throw new Error("Identity is required to create canister actor");
  }

  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.includes("localhost");

  // For localhost, use the current window location to avoid CORS issues
  const host = isLocalhost ? window.location.origin : "https://ic0.app";

  console.log("Window location:", window.location.hostname);
  console.log("Is localhost:", isLocalhost);
  console.log("Using host:", host);
  console.log("Backend canister ID:", BACKEND_CANISTER_ID);

  try {
    console.log("Creating standard agent for all environments");

    const agent = new HttpAgent({
      host: host,
      identity: identity,
    });

    // For local development, we need to fetch the root key
    if (isLocalhost) {
      console.log("Fetching root key for local development...");
      await agent.fetchRootKey();
      console.log("Root key fetched successfully");
    }

    const actor = Actor.createActor(idlFactory, {
      agent,
      canisterId: BACKEND_CANISTER_ID,
    });

    console.log("Standard agent actor created successfully:", actor);
    return actor;
  } catch (error) {
    console.error("Failed to create standard agent actor:", error);
    throw error;
  }
};

// Utility functions for principal conversion
export const principalToString = (principal) => {
  if (!principal) return "";
  try {
    if (typeof principal === "string") return principal;
    if (principal && typeof principal.toText === "function") {
      return principal.toText();
    }
    return principal.toString();
  } catch (error) {
    console.error("Error converting principal to string:", error);
    return "";
  }
};

export const stringToPrincipal = (principalString) => {
  if (!principalString) return null;
  try {
    console.log("Converting string to principal:", principalString);
    const principal = Principal.fromText(principalString);
    console.log("Successfully converted to principal:", principal);
    return principal;
  } catch (error) {
    console.error("Error converting string to principal:", error);
    console.error("Input string was:", principalString);
    return null;
  }
};

// Utility functions for BigInt conversion
export const bigIntToNumber = (bigIntValue) => {
  if (bigIntValue === null || bigIntValue === undefined) return 0;
  try {
    return Number(bigIntValue);
  } catch (error) {
    console.error("Error converting BigInt to number:", error);
    return 0;
  }
};

export const numberToBigInt = (numberValue) => {
  if (numberValue === null || numberValue === undefined) return BigInt(0);
  try {
    return BigInt(numberValue);
  } catch (error) {
    console.error("Error converting number to BigInt:", error);
    return BigInt(0);
  }
};

// Safe canister call wrapper with error handling
export const safeCanisterCall = async (
  canisterCall,
  errorMessage = "Canister call failed"
) => {
  try {
    const result = await canisterCall();
    return { success: true, data: result };
  } catch (error) {
    console.error("Canister call error:", error);
    return { success: false, error: error.message || errorMessage };
  }
};
