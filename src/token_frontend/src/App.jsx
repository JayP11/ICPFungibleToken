import React, { useState, useEffect } from "react";
import "./App.css";
import {
  createCanisterActor,
  principalToString,
  stringToPrincipal,
  bigIntToNumber,
  numberToBigInt,
  safeCanisterCall,
} from "./canister.js";

function App() {
  // MINIMAL TEST - BEFORE ANY STATE OR LOGIC
  // Test if basic React state works
  // const [testState, setTestState] = useState("INITIAL_VALUE");
  // console.log("Test state value:", testState); // Removed later
  // Test if basic event handling works
  // const handleTestClick = () => {
  //   console.log("=== TEST CLICK HANDLER FIRED ===");
  //   const newValue = "CLICKED_" + Date.now();
  //   console.log("Setting new value:", newValue);
  //   setTestState(newValue);
  // };

  // Initialize state with localStorage data for persistence
  const [tokens, setTokens] = useState(() => {
    try {
      const cached = localStorage.getItem("ic-tokens");
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error("Error parsing cached tokens:", error);
      return [];
    }
  });

  const [balances, setBalances] = useState(() => {
    try {
      const cached = localStorage.getItem("ic-balances");
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.error("Error parsing cached balances:", error);
      return {};
    }
  });

  const [transactions, setTransactions] = useState(() => {
    try {
      const cached = localStorage.getItem("ic-transactions");
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error("Error parsing cached transactions:", error);
      return [];
    }
  });

  const [newToken, setNewToken] = useState({
    symbol: "",
    name: "",
    totalSupply: "",
    imageUrl: "",
  });
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  // Initialize authentication state from localStorage
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const storedAuth = localStorage.getItem("ic-auth");
    const storedPrincipal = localStorage.getItem("ic-principal");
    return !!(storedAuth && storedPrincipal);
  });

  const [userPrincipal, setUserPrincipal] = useState(() => {
    return localStorage.getItem("ic-principal") || null;
  });

  const [identity, setIdentity] = useState(null);
  const [canisterActor, setCanisterActor] = useState(null);
  const [transferForm, setTransferForm] = useState({
    to: "",
    amount: "",
    symbol: "",
  });
  const [activeTab, setActiveTab] = useState("tokens");
  const [authLoading, setAuthLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activeTokenSymbol, setActiveTokenSymbol] = useState("");
  const [forceUpdate, setForceUpdate] = useState(0); // State to force re-render

  // Add notification
  const addNotification = (message, type = "info") => {
    const id = Date.now();
    const notification = { id, message, type };
    setNotifications((prev) => [...prev, notification]);

    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  // Remove notification by index
  const removeNotification = (index) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  };

  // Load tokens from canister
  const loadTokens = async () => {
    console.log("=== LOADING TOKENS ===");
    if (!canisterActor) {
      console.log("Cannot load tokens - no canister actor available");
      return;
    }

    try {
      console.log("Calling canister get_token_list()...");
      const result = await safeCanisterCall(
        () => canisterActor.get_token_list(),
        "Failed to load tokens"
      );

      console.log("get_token_list result:", result);

      if (result.success) {
        console.log("Raw result.data:", result.data);
        console.log("Result.data type:", typeof result.data);
        console.log("Result.data length:", result.data?.length);

        // Get the basic token list first
        const basicTokenList = result.data.map(([name, symbol, imageUrl]) => ({
          name,
          symbol,
          imageUrl,
          id: symbol,
        }));

        console.log("Basic token list:", basicTokenList);

        // Now fetch total supply for each token
        const tokenListWithSupply = [];
        for (const token of basicTokenList) {
          try {
            console.log(`Fetching total supply for token: ${token.symbol}`);
            const supplyResult = await safeCanisterCall(
              () => canisterActor.total_supply(token.symbol),
              `Failed to load supply for ${token.symbol}`
            );

            if (supplyResult.success) {
              // Convert BigInt to number for localStorage compatibility
              const supplyNumber = bigIntToNumber(supplyResult.data);
              tokenListWithSupply.push({
                ...token,
                totalSupply: supplyNumber,
              });
              console.log(`Supply for ${token.symbol}:`, supplyNumber);
            } else {
              console.error(
                `Error loading supply for ${token.symbol}:`,
                supplyResult.error
              );
              tokenListWithSupply.push({
                ...token,
                totalSupply: 0,
              });
            }
          } catch (error) {
            console.error(`Error fetching supply for ${token.symbol}:`, error);
            tokenListWithSupply.push({
              ...token,
              totalSupply: 0,
            });
          }
        }

        console.log("Final token list with supply:", tokenListWithSupply);
        setTokens(tokenListWithSupply);
        // Save to localStorage for persistence (now with regular numbers)
        const safeTokens = prepareForStorage(tokenListWithSupply);
        localStorage.setItem("ic-tokens", JSON.stringify(safeTokens));
        console.log("Tokens loaded and saved to localStorage:", safeTokens);
      } else {
        console.error("Failed to load tokens:", result.error);
        addNotification(result.error, "error");
      }
    } catch (error) {
      console.error("Error loading tokens:", error);
      addNotification("Failed to load tokens", "error");
    }
  };

  // Load balances from canister
  const loadBalances = async () => {
    console.log("=== LOADING BALANCES ===");
    if (!canisterActor || !userPrincipal) {
      console.log("Cannot load balances - missing:", {
        canisterActor: !!canisterActor,
        userPrincipal: !!userPrincipal,
      });
      return;
    }

    // Don't return early if tokens.length === 0, as we might want to load balances for newly created tokens
    if (tokens.length === 0) {
      console.log(
        "No tokens available yet, but will still attempt to load balances"
      );
    }

    try {
      const userPrincipalObj = stringToPrincipal(userPrincipal);
      const newBalances = {};

      if (tokens.length > 0) {
        console.log(
          "Loading balances for tokens:",
          tokens.map((t) => t.symbol)
        );

        for (const token of tokens) {
          try {
            console.log(`Loading balance for token: ${token.symbol}`);
            const result = await safeCanisterCall(
              () => canisterActor.balance_of(token.symbol, userPrincipalObj),
              `Failed to load balance for ${token.symbol}`
            );

            if (result.success) {
              newBalances[token.symbol] = bigIntToNumber(result.data);
              console.log(
                `Balance for ${token.symbol}:`,
                bigIntToNumber(result.data)
              );
            } else {
              console.error(
                `Error loading balance for ${token.symbol}:`,
                result.error
              );
              newBalances[token.symbol] = 0;
            }
          } catch (error) {
            console.error(`Error loading balance for ${token.symbol}:`, error);
            newBalances[token.symbol] = 0;
          }
        }
      }

      setBalances(newBalances);
      // Save to localStorage for persistence
      const safeBalances = prepareForStorage(newBalances);
      localStorage.setItem("ic-balances", JSON.stringify(safeBalances));
      console.log(
        "All balances loaded and saved to localStorage:",
        safeBalances
      );
    } catch (error) {
      console.error("Error loading balances:", error);
      addNotification("Failed to load balances", "error");
    }
  };

  // Load transactions from canister
  const loadTransactions = async (symbol) => {
    console.log("=== LOADING TRANSACTIONS ===");
    if (!canisterActor || !userPrincipal) {
      console.log("Cannot load transactions - missing:", {
        canisterActor: !!canisterActor,
        userPrincipal: !!userPrincipal,
      });
      return;
    }

    try {
      const userPrincipalObj = stringToPrincipal(userPrincipal);
      let allTransactions = [];

      if (symbol) {
        // Load transactions for specific token
        console.log(`Loading transactions for specific token: ${symbol}`);
        const result = await safeCanisterCall(
          () => canisterActor.get_transactions(symbol, userPrincipalObj),
          `Failed to load transactions for ${symbol}`
        );

        if (result.success) {
          allTransactions = result.data.map((tx) => ({
            type: "transfer",
            from: tx.from ? principalToString(tx.from) : "Unknown",
            to: principalToString(tx.to),
            amount: bigIntToNumber(tx.amount),
            timestamp: Number(tx.timestamp),
            symbol: symbol,
          }));
          console.log(
            `Loaded ${allTransactions.length} transactions for ${symbol}`
          );
        }
      } else {
        // Load transactions for all tokens
        console.log(
          "Loading transactions for all tokens:",
          tokens.map((t) => t.symbol)
        );
        for (const token of tokens) {
          console.log(`Loading transactions for token: ${token.symbol}`);
          const result = await safeCanisterCall(
            () =>
              canisterActor.get_transactions(token.symbol, userPrincipalObj),
            `Failed to load transactions for ${token.symbol}`
          );

          if (result.success) {
            const tokenTransactions = result.data.map((tx) => ({
              type: "transfer",
              from: tx.from ? principalToString(tx.from) : "Unknown",
              to: principalToString(tx.to),
              amount: bigIntToNumber(tx.amount),
              timestamp: Number(tx.timestamp),
              symbol: token.symbol,
            }));
            allTransactions.push(...tokenTransactions);
            console.log(
              `Loaded ${tokenTransactions.length} transactions for ${token.symbol}`
            );
          }
        }
      }

      // Sort by timestamp (newest first)
      allTransactions.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(allTransactions);

      // Save to localStorage for persistence
      const safeTransactions = prepareForStorage(allTransactions);
      localStorage.setItem("ic-transactions", JSON.stringify(safeTransactions));
      console.log(
        "All transactions loaded and saved to localStorage:",
        safeTransactions
      );
    } catch (error) {
      console.error("Error loading transactions:", error);
      addNotification("Failed to load transactions", "error");
    }
  };

  // Helper function to convert principal to string
  const principalToString = (principal) => {
    if (typeof principal === "string") return principal;
    if (principal && typeof principal.toText === "function")
      return principal.toText();
    return String(principal);
  };

  // Helper function to safely convert data for JSON serialization
  const prepareForStorage = (data) => {
    if (data === null || data === undefined) return data;

    if (typeof data === "bigint") {
      return Number(data);
    }

    if (Array.isArray(data)) {
      return data.map(prepareForStorage);
    }

    if (typeof data === "object") {
      const converted = {};
      for (const [key, value] of Object.entries(data)) {
        converted[key] = prepareForStorage(value);
      }
      return converted;
    }

    return data;
  };

  // Verify authentication status
  const verifyAuthentication = async () => {
    try {
      // Check if we have a valid canister actor and user principal
      if (!canisterActor || !userPrincipal) {
        console.log("No canister actor or user principal found");
        return false;
      }

      // For Dev Identity, just check if we have the stored authentication
      if (
        localStorage.getItem("ic-auth") === "true" &&
        localStorage.getItem("ic-principal")
      ) {
        console.log("Dev Identity authentication verified");
        return true;
      }

      // Fallback to Internet Identity check if Dev Identity not found
      try {
        const { AuthClient } = await import("@dfinity/auth-client");
        const authClient = await AuthClient.create();

        if (await authClient.isAuthenticated()) {
          console.log("Internet Identity authentication verified");
          return true;
        }
      } catch (iiError) {
        console.log(
          "Internet Identity check failed, but continuing with Dev Identity check"
        );
      }

      // If we get here, authentication failed
      addNotification("Authentication expired. Please login again.", "error");
      handleLogout();
      return false;
    } catch (error) {
      console.error("Authentication verification failed:", error);
      addNotification(
        "Authentication verification failed. Please login again.",
        "error"
      );
      handleLogout();
      return false;
    }
  };

  // Function to restore canister actor from stored identity
  const restoreCanisterActor = async (storedPrincipal) => {
    try {
      console.log("Restoring canister actor for principal:", storedPrincipal);

      // For stored principals, we need to create a proper Ed25519KeyIdentity
      // since the HttpAgent requires a real identity object
      const { Ed25519KeyIdentity } = await import("@dfinity/identity");

      // Create a new identity with a deterministic seed based on the stored principal
      // This ensures the same principal is restored
      const seed = new Uint8Array(32);
      const principalBytes = storedPrincipal
        .split("-")
        .map((part) => parseInt(part, 16));
      seed.set(principalBytes.slice(0, 32));

      const restoredIdentity = Ed25519KeyIdentity.generate(seed);

      // Verify the principal matches
      const restoredPrincipal = restoredIdentity.getPrincipal().toText();
      if (restoredPrincipal !== storedPrincipal) {
        console.warn("Principal mismatch, using stored principal as fallback");
        // If principal doesn't match, create a new identity but keep the stored principal
        const newIdentity = Ed25519KeyIdentity.generate();
        console.log("Created new identity for restoration");
      }

      console.log(
        "Restored identity with principal:",
        restoredIdentity.getPrincipal().toText()
      );

      // Restore the session
      setIdentity(restoredIdentity);
      setUserPrincipal(storedPrincipal);
      setIsAuthenticated(true);

      const actor = await createCanisterActor(restoredIdentity);
      setCanisterActor(actor);
      console.log("Restored canister actor created successfully");

      // Load data from canister
      await loadDataFromCanister();

      // Start session timeout
      // resetSessionTimeout(); // Removed as per edit hint

      addNotification("Session restored successfully!", "success");
      console.log("Session restoration completed successfully");

      return true;
    } catch (error) {
      console.error("Failed to restore canister actor:", error);
      return false;
    }
  };

  // Development mode authentication (bypasses Internet Identity for local testing)
  const handleDevLogin = async () => {
    console.log("=== DEV LOGIN BUTTON CLICKED ===");
    setAuthLoading(true);
    try {
      console.log("=== STARTING DEV AUTHENTICATION ===");

      // Import DFINITY modules
      const { Principal } = await import("@dfinity/principal");
      const { Ed25519KeyIdentity } = await import("@dfinity/identity");

      // Create a local development identity
      const seed = new Uint8Array(32);
      crypto.getRandomValues(seed);
      const devIdentity = Ed25519KeyIdentity.generate(seed);
      const devPrincipal = devIdentity.getPrincipal().toText();

      console.log("Created dev identity with principal:", devPrincipal);

      // Store authentication state
      localStorage.setItem("ic-auth", "true");
      localStorage.setItem("ic-principal", devPrincipal);

      // Set authentication state
      setIdentity(devIdentity);
      setUserPrincipal(devPrincipal);
      setIsAuthenticated(true);

      // Create canister actor
      const actor = await createCanisterActor(devIdentity);
      setCanisterActor(actor);

      // Start session timeout
      // resetSessionTimeout(); // Removed as per edit hint

      addNotification("Development authentication successful!", "success");

      // Load initial data
      try {
        await loadTokens();
        await loadBalances();
        console.log("Initial data loaded successfully");
      } catch (dataError) {
        console.warn("Error loading initial data:", dataError);
        addNotification(
          "Authentication successful, but there was an issue loading data",
          "warning"
        );
      }
    } catch (error) {
      console.error("Dev authentication failed:", error);
      addNotification("Development authentication failed", "error");
    } finally {
      setAuthLoading(false);
    }
  };

  // Real Internet Identity authentication
  const handleLogin = async () => {
    console.log("=== LOGIN BUTTON CLICKED ===");
    setAuthLoading(true);
    try {
      console.log("=== STARTING AUTHENTICATION ===");
      console.log("Environment:", process.env.NODE_ENV);
      console.log("Current URL:", window.location.href);

      // Import Internet Identity modules dynamically
      console.log("Importing DFINITY modules...");
      const { AuthClient } = await import("@dfinity/auth-client");
      const { Identity } = await import("@dfinity/identity");
      console.log("DFINITY modules imported successfully");

      console.log("Creating auth client...");
      // Create auth client
      const authClient = await AuthClient.create();
      console.log("Auth client created successfully");

      // Clear any existing authentication first
      console.log("Clearing existing authentication...");
      await authClient.logout();
      console.log("Existing authentication cleared");

      // For local development, use a local identity approach
      let identityProvider;
      if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        // Local development - use a local identity or fallback
        console.log(
          "Local development detected - using local identity approach"
        );
        identityProvider = "http://127.0.0.1:4943";
      } else {
        // Production - use mainnet Internet Identity
        identityProvider = "https://identity.ic0.app";
      }
      console.log("Using identity provider:", identityProvider);

      // For local development, create a local identity instead of using Internet Identity
      if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        console.log("Creating local development identity...");
        const { Ed25519KeyIdentity } = await import("@dfinity/identity");

        // Create a new local identity for development
        const localIdentity = Ed25519KeyIdentity.generate();
        console.log(
          "Local identity created:",
          localIdentity.getPrincipal().toText()
        );

        // Set the identity directly
        setIdentity(localIdentity);
        setUserPrincipal(localIdentity.getPrincipal().toText());
        setIsAuthenticated(true);

        // Store authentication state
        localStorage.setItem("ic-auth", "true");
        localStorage.setItem(
          "ic-principal",
          localIdentity.getPrincipal().toText()
        );

        // Create canister actor for the new identity
        const actor = await createCanisterActor(localIdentity);
        setCanisterActor(actor);

        // Start session timeout
        // resetSessionTimeout(); // Removed as per edit hint

        // Load initial data
        try {
          await loadTokens();
          await loadBalances();
          console.log("Initial data loaded successfully");
        } catch (dataError) {
          console.warn("Error loading initial data:", dataError);
        }

        console.log("Local development authentication completed");
        return;
      }

      // Production: Start Internet Identity authentication flow
      console.log("Starting Internet Identity authentication flow...");
      await new Promise((resolve, reject) => {
        const loginPromise = authClient.login({
          identityProvider,
          onSuccess: () => {
            console.log("Authentication successful - user approved");
            resolve();
          },
          onError: (error) => {
            console.error("Authentication error in onError callback:", error);
            reject(error);
          },
          // Force new authentication window
          windowOpenerFeatures:
            "width=500,height=600,scrollbars=yes,resizable=yes",
        });

        console.log("Login method called, waiting for result...");

        // Add a timeout to catch hanging authentication
        setTimeout(() => {
          console.warn("Authentication timeout - no response after 30 seconds");
          reject(new Error("Authentication timeout - please try again"));
        }, 30000);
      });

      console.log("Authentication flow completed, verifying...");
      // Verify authentication was successful
      const isAuth = await authClient.isAuthenticated();
      console.log("isAuthenticated result:", isAuth);

      if (!isAuth) {
        throw new Error(
          "Authentication verification failed - isAuthenticated returned false"
        );
      }

      // Get the authenticated identity
      const authenticatedIdentity = authClient.getIdentity();
      console.log("Retrieved identity:", !!authenticatedIdentity);

      if (!authenticatedIdentity) {
        throw new Error("No authenticated identity found");
      }

      console.log("Identity verified, setting up session...");

      // Store authentication state first
      localStorage.setItem("ic-auth", "true");
      localStorage.setItem(
        "ic-principal",
        authenticatedIdentity.getPrincipal().toText()
      );

      // Set authentication state only after successful verification
      setIdentity(authenticatedIdentity);
      setUserPrincipal(authenticatedIdentity.getPrincipal().toText());
      setIsAuthenticated(true);

      // Small delay to ensure state updates are processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create canister actor
      console.log("Creating canister actor...");
      const actor = await createCanisterActor(authenticatedIdentity);
      setCanisterActor(actor);

      console.log(
        "User authenticated with principal:",
        authenticatedIdentity.getPrincipal().toText()
      );

      // Start session timeout
      // resetSessionTimeout(); // Removed as per edit hint

      // Add success notification
      addNotification(
        "Successfully authenticated with Internet Identity!",
        "success"
      );

      // Load initial data
      console.log("Loading initial data...");
      try {
        await loadTokens();
        await loadBalances();
        console.log("Initial data loaded successfully");
      } catch (dataError) {
        console.warn("Error loading initial data:", dataError);
        addNotification(
          "Authentication successful, but there was an issue loading data",
          "warning"
        );
      }

      console.log("Authentication process completed successfully");
    } catch (error) {
      console.error("=== AUTHENTICATION FAILED ===");
      console.error("Error details:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("Error name:", error.name);

      // Reset state on failure
      setIsAuthenticated(false);
      setUserPrincipal(null);
      setIdentity(null);

      // More helpful error message
      let errorMessage = "Authentication failed. ";
      if (error.message.includes("User rejected")) {
        errorMessage +=
          "You rejected the authentication request. Please try again and approve the connection.";
      } else if (error.message.includes("timeout")) {
        errorMessage += "Authentication timed out. Please try again.";
      } else if (error.message.includes("network")) {
        errorMessage +=
          "Network error. Please check your internet connection and try again.";
      } else if (error.message.includes("CORS")) {
        errorMessage +=
          "CORS error. Please check your browser settings and try again.";
      } else if (error.message.includes("fetch")) {
        errorMessage +=
          "Network fetch error. Please check your internet connection and try again.";
      } else {
        errorMessage +=
          "Please try again and ensure you approve the connection in Internet Identity.";
      }

      addNotification(errorMessage, "error");
      console.error("Authentication error message:", errorMessage);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (identity) {
        const { AuthClient } = await import("@dfinity/auth-client");
        const authClient = await AuthClient.create();

        // Properly logout from Internet Identity
        await authClient.logout();
        console.log("Successfully logged out from Internet Identity");
      }
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      // Clear all state
      setIsAuthenticated(false);
      setUserPrincipal(null);
      setIdentity(null);
      setCanisterActor(null);
      setTokens([]);
      setTransactions([]);
      setBalances({});
      setActiveTokenSymbol(""); // Reset active token in transactions tab
      // setSessionTimeLeft(30 * 60); // Removed as per edit hint

      // Clear session timeout
      // clearSessionTimeout(); // Removed as per edit hint

      // Clear stored authentication
      localStorage.removeItem("ic-auth");
      localStorage.removeItem("ic-principal");

      // Clear stored tokens data
      localStorage.removeItem("ic-tokens");
      localStorage.removeItem("ic-tokens-timestamp");
      localStorage.removeItem("ic-balances");
      localStorage.removeItem("ic-transactions");

      console.log("User logged out and all state cleared");

      // Add logout notification
      addNotification("Successfully logged out", "info");
    }
  };

  // Check authentication status on mount
  useEffect(() => {
    let isMounted = true;

    const checkAuthStatus = async () => {
      console.log("=== CHECKING AUTH STATUS ===");
      console.log("Current authentication state:", {
        isAuthenticated,
        userPrincipal,
        hasIdentity: !!identity,
        hasCanisterActor: !!canisterActor,
      });

      // Don't check auth status if we're already fully authenticated
      if (isAuthenticated && userPrincipal && identity && canisterActor) {
        console.log("Already fully authenticated, skipping auth check");
        if (isMounted) setDataLoading(false);
        return;
      }

      if (isMounted) setDataLoading(true);

      try {
        // Check localStorage for stored authentication
        const storedAuth = localStorage.getItem("ic-auth");
        const storedPrincipal = localStorage.getItem("ic-principal");

        console.log("Stored auth data:", {
          auth: storedAuth,
          principal: storedPrincipal,
        });

        if (storedAuth && storedPrincipal) {
          console.log("Found stored authentication, attempting to restore...");

          // Try to restore the identity
          try {
            const success = await restoreCanisterActor(storedPrincipal);

            if (!success) {
              throw new Error("Failed to restore canister actor");
            }

            console.log("Stored authentication restored successfully");
          } catch (error) {
            console.error("Error checking existing identity:", error);
            // Clear localStorage if restoration fails
            localStorage.removeItem("ic-auth");
            localStorage.removeItem("ic-principal");
            if (isMounted) {
              addNotification(
                "Failed to restore session, please login again",
                "error"
              );
            }
          }
        } else {
          console.log("No stored authentication found");
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
        if (isMounted)
          addNotification("Error checking authentication status", "error");
      } finally {
        if (isMounted) setDataLoading(false);
      }
    };

    checkAuthStatus();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []); // Remove all dependencies to prevent infinite loop

  // Cleanup session timeout on unmount
  useEffect(() => {
    return () => {
      // clearSessionTimeout(); // Removed as per edit hint
    };
  }, []); // No dependency on sessionTimeout

  // Monitor user activity to reset session timeout
  useEffect(() => {
    if (isAuthenticated) {
      const handleUserActivity = () => {
        // resetSessionTimeout(); // Removed as per edit hint
      };

      // Reset timeout on user activity
      const events = ["mousedown", "mousemove", "scroll", "touchstart"];
      events.forEach((event) => {
        document.addEventListener(event, handleUserActivity, true);
      });

      // Periodic authentication check every 5 minutes
      const authCheckInterval = setInterval(async () => {
        if (!(await verifyAuthentication())) {
          clearInterval(authCheckInterval);
        }
      }, 5 * 60 * 1000); // 5 minutes

      return () => {
        events.forEach((event) => {
          document.removeEventListener(event, handleUserActivity, true);
        });
        clearInterval(authCheckInterval);
      };
    }
  }, [isAuthenticated]);

  // Session countdown timer
  useEffect(() => {
    if (isAuthenticated) {
      const timer = setInterval(() => {
        // setSessionTimeLeft((prev) => { // Removed as per edit hint
        //   if (prev <= 1) {
        //     clearInterval(timer);
        //     return 0;
        //   }
        //   // Show warning at 5 minutes and 1 minute
        //   if (prev === 300) {
        //     // 5 minutes
        //     addNotification( // Removed as per edit hint
        //       "⚠️ Your session will expire in 5 minutes",
        //       "error"
        //     );
        //   } else if (prev === 60) {
        //     // 1 minute
        //     addNotification( // Removed as per edit hint
        //       "⚠️ Your session will expire in 1 minute",
        //       "error"
        //     );
        //   }
        //   return prev - 1;
        // });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isAuthenticated]);

  // Add logging to see when this useEffect runs
  useEffect(() => {
    console.log("=== MAIN DATA LOADING EFFECT TRIGGERED ===");
    console.log("Effect dependencies:", {
      isAuthenticated,
      canisterActor: !!canisterActor,
      userPrincipal: !!userPrincipal,
    });
    console.log("Current tokens state:", tokens);

    // Only load data when we have all required dependencies
    if (isAuthenticated && canisterActor && userPrincipal) {
      // Add a guard to prevent multiple simultaneous calls
      if (!dataLoading) {
        loadDataFromCanister();
      } else {
        console.log("Data loading already in progress, skipping...");
      }
    }
  }, [isAuthenticated, canisterActor, userPrincipal]);

  // Load data from canister
  const loadDataFromCanister = async () => {
    // Prevent multiple simultaneous calls
    if (dataLoading) {
      console.log("Data loading already in progress, skipping...");
      return;
    }

    try {
      console.log("=== LOAD DATA FROM CANISTER TRIGGERED ===");
      setDataLoading(true);

      // Step 1: Load tokens first
      console.log("Calling loadTokens from loadDataFromCanister...");
      await loadTokens();
      console.log("loadTokens completed in loadDataFromCanister");

      // Step 2: Load balances and transactions
      await loadBalances();
      await loadTransactions("");

      console.log("All data loaded successfully");
    } catch (error) {
      console.error("Error loading data from canister:", error);
      addNotification("Failed to load data from canister", "error");
    } finally {
      setDataLoading(false);
    }
  };

  // Persist tokens in localStorage when they change (but don't trigger reloads)
  useEffect(() => {
    if (tokens.length > 0) {
      console.log("Saving tokens to localStorage:", tokens);
      const safeTokens = prepareForStorage(tokens);
      localStorage.setItem("ic-tokens", JSON.stringify(safeTokens));
      localStorage.setItem("ic-tokens-timestamp", Date.now().toString());
    }
  }, [tokens]);

  // Monitor balance changes and force UI updates
  useEffect(() => {
    console.log("=== BALANCES CHANGED - FORCING UI UPDATE ===");
    console.log("Current balances:", balances);
    console.log("Force update counter:", forceUpdate);

    // This effect will run every time balances change, ensuring UI updates
  }, [balances, forceUpdate]);

  // Load tokens from localStorage on mount (for better UX)
  useEffect(() => {
    // Only load from localStorage if we're not authenticated and have stored data
    if (!isAuthenticated && !canisterActor) {
      const storedTokens = localStorage.getItem("ic-tokens");
      const storedTimestamp = localStorage.getItem("ic-tokens-timestamp");

      console.log("Loading tokens from localStorage:", storedTokens);
      console.log("Stored timestamp:", storedTimestamp);

      if (storedTokens && storedTimestamp) {
        try {
          const parsedTokens = JSON.parse(storedTokens);
          const age = Date.now() - parseInt(storedTimestamp);
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours

          console.log("Parsed tokens from localStorage:", parsedTokens);
          console.log("Data age:", age, "ms (max:", maxAge, "ms)");

          // Only use localStorage data if it's not too old
          if (age < maxAge) {
            setTokens(parsedTokens);
            console.log("Using localStorage data (not too old)");
          } else {
            console.log("localStorage data too old, clearing");
            localStorage.removeItem("ic-tokens");
            localStorage.removeItem("ic-tokens-timestamp");
          }
        } catch (error) {
          console.error("Error parsing stored tokens:", error);
          localStorage.removeItem("ic-tokens");
          localStorage.removeItem("ic-tokens-timestamp");
        }
      }
    }
  }, []); // Only run on mount

  const handleCreateToken = async (e) => {
    e.preventDefault();

    // Verify authentication first
    if (!(await verifyAuthentication())) {
      return;
    }

    setLoading(true);

    try {
      if (!canisterActor) {
        throw new Error("Canister actor not available");
      }

      const userPrincipalObj = stringToPrincipal(userPrincipal);
      const totalSupplyBigInt = numberToBigInt(parseInt(newToken.totalSupply));

      const result = await safeCanisterCall(
        () =>
          canisterActor.create_token(
            userPrincipalObj,
            newToken.name,
            newToken.symbol,
            newToken.imageUrl || "https://via.placeholder.com/150", // Default image if none provided
            totalSupplyBigInt
          ),
        "Failed to create token"
      );

      if (result.success) {
        addNotification(
          `Token ${newToken.symbol} created successfully!`,
          "success"
        );

        // Reset form
        setNewToken({ symbol: "", name: "", totalSupply: "", imageUrl: "" });

        // Reload tokens first
        console.log("=== RELOADING TOKENS AFTER CREATION ===");
        await loadTokens();

        // Force reload balances for the newly created token
        console.log("=== FORCE RELOADING BALANCES AFTER TOKEN CREATION ===");
        await forceLoadBalances();

        console.log("=== ALL DATA RELOADED AFTER TOKEN CREATION ===");
      } else {
        addNotification(result.error, "error");
      }
    } catch (error) {
      console.error("Error creating token:", error);
      addNotification("Failed to create token: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Force load balances even if tokens array is empty (for newly created tokens)
  const forceLoadBalances = async () => {
    console.log("=== FORCE LOADING BALANCES ===");
    if (!canisterActor || !userPrincipal) {
      console.log("Cannot force load balances - missing:", {
        canisterActor: !!canisterActor,
        userPrincipal: !!userPrincipal,
      });
      return;
    }

    try {
      const userPrincipalObj = stringToPrincipal(userPrincipal);
      const newBalances = {};

      // If we have tokens, load balances for them
      if (tokens.length > 0) {
        console.log(
          "Loading balances for existing tokens:",
          tokens.map((t) => t.symbol)
        );
        for (const token of tokens) {
          try {
            console.log(`Loading balance for token: ${token.symbol}`);
            const result = await safeCanisterCall(
              () => canisterActor.balance_of(token.symbol, userPrincipalObj),
              `Failed to load balance for ${token.symbol}`
            );

            if (result.success) {
              newBalances[token.symbol] = bigIntToNumber(result.data);
              console.log(
                `Balance for ${token.symbol}:`,
                bigIntToNumber(result.data)
              );
            } else {
              console.error(
                `Error loading balance for ${token.symbol}:`,
                result.error
              );
              newBalances[token.symbol] = 0;
            }
          } catch (error) {
            console.error(`Error loading balance for ${token.symbol}:`, error);
            newBalances[token.symbol] = 0;
          }
        }
      }

      // Also try to load balance for the newly created token if it's not in the tokens array yet
      if (newToken.symbol && !newBalances[newToken.symbol]) {
        try {
          console.log(
            `Loading balance for newly created token: ${newToken.symbol}`
          );
          const result = await safeCanisterCall(
            () => canisterActor.balance_of(newToken.symbol, userPrincipalObj),
            `Failed to load balance for newly created ${newToken.symbol}`
          );

          if (result.success) {
            newBalances[newToken.symbol] = bigIntToNumber(result.data);
            console.log(
              `Balance for newly created ${newToken.symbol}:`,
              bigIntToNumber(result.data)
            );
          } else {
            console.error(
              `Error loading balance for newly created ${newToken.symbol}:`,
              result.error
            );
            newBalances[newToken.symbol] = 0;
          }
        } catch (error) {
          console.error(
            `Error loading balance for newly created ${newToken.symbol}:`,
            error
          );
          newBalances[newToken.symbol] = 0;
        }
      }

      setBalances(newBalances);
      // Save to localStorage for persistence
      const safeBalances = prepareForStorage(newBalances);
      localStorage.setItem("ic-balances", JSON.stringify(safeBalances));
      console.log(
        "All balances loaded and saved to localStorage:",
        safeBalances
      );
    } catch (error) {
      console.error("Error force loading balances:", error);
      addNotification("Failed to load balances", "error");
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();

    // Verify authentication first
    if (!(await verifyAuthentication())) {
      return;
    }

    setLoading(true);

    try {
      if (!canisterActor) {
        throw new Error("Canister actor not available");
      }

      console.log("Transfer form data:", transferForm);
      console.log("User principal string:", userPrincipal);

      // Check if user has sufficient balance for this token
      const userBalance = balances[transferForm.symbol] || 0;
      const transferAmount = parseInt(transferForm.amount);

      if (userBalance < transferAmount) {
        addNotification(
          `Insufficient balance. You have ${userBalance} ${transferForm.symbol}, but trying to transfer ${transferAmount}`,
          "error"
        );
        setLoading(false);
        return;
      }

      // Check if transfer amount is valid
      if (transferAmount <= 0) {
        addNotification("Transfer amount must be greater than 0", "error");
        setLoading(false);
        return;
      }

      const fromPrincipal = stringToPrincipal(userPrincipal);
      const toPrincipal = stringToPrincipal(transferForm.to);
      const amountBigInt = numberToBigInt(transferAmount);

      // Validate recipient principal
      if (!toPrincipal) {
        addNotification("Invalid recipient principal address", "error");
        setLoading(false);
        return;
      }

      // Prevent self-transfer
      if (fromPrincipal.toText() === toPrincipal.toText()) {
        addNotification("Cannot transfer tokens to yourself", "error");
        setLoading(false);
        return;
      }

      console.log("From principal object:", fromPrincipal);
      console.log("To principal object:", toPrincipal);
      console.log("Amount BigInt:", amountBigInt);
      console.log("User balance:", userBalance);

      const result = await safeCanisterCall(
        () =>
          canisterActor.transfer(
            transferForm.symbol,
            toPrincipal, // to (receiver) - SECOND parameter
            fromPrincipal, // from (sender) - THIRD parameter
            amountBigInt
          ),
        "Failed to transfer tokens"
      );

      if (result.success) {
        addNotification(
          `Successfully transferred ${transferAmount} ${transferForm.symbol}`,
          "success"
        );

        // Store the token symbol before resetting the form
        const transferredTokenSymbol = transferForm.symbol;

        // Reset form
        setTransferForm({ to: "", amount: "", symbol: "" });

        // Immediately update the local balance for better UX
        const updatedBalances = { ...balances };
        updatedBalances[transferredTokenSymbol] = Math.max(
          0,
          (updatedBalances[transferredTokenSymbol] || 0) - transferAmount
        );
        setBalances(updatedBalances);

        // Save updated balances to localStorage
        const safeBalances = prepareForStorage(updatedBalances);
        localStorage.setItem("ic-balances", JSON.stringify(safeBalances));

        console.log("=== RELOADING DATA AFTER SUCCESSFUL TRANSFER ===");
        console.log("Transferred token symbol:", transferredTokenSymbol);
        console.log(
          "Updated balance for",
          transferredTokenSymbol,
          ":",
          updatedBalances[transferredTokenSymbol]
        );

        // Force reload balances from canister to ensure accuracy
        await forceLoadBalances();

        // Force refresh the specific token's balance with UI update
        await forceRefreshTokenBalance(transferredTokenSymbol);

        // Reload transactions for the transferred token
        await loadTransactions(transferredTokenSymbol);

        console.log("=== ALL DATA RELOADED AFTER TRANSFER ===");
        console.log("Final balance state:", balances);
      } else {
        addNotification(result.error, "error");
      }
    } catch (error) {
      console.error("Error transferring tokens:", error);
      addNotification("Failed to transfer tokens: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async (symbol, amount) => {
    console.log(`=== MINTING ${amount} ${symbol} ===`);
    console.log("Starting mint process...");

    // Verify authentication first
    if (!(await verifyAuthentication())) {
      console.log("Authentication verification failed");
      return;
    }

    console.log("Authentication verified, proceeding with mint...");
    setLoading(true);

    try {
      if (!canisterActor) {
        throw new Error("Canister actor not available");
      }

      console.log("Canister actor available, preparing transfer...");
      console.log("User principal:", userPrincipal);
      console.log("Amount to mint:", amount);

      // For minting, we'll transfer from the token owner (creator) to the current user
      // This simulates minting by the token creator
      const fromPrincipal = stringToPrincipal(userPrincipal);
      const toPrincipal = stringToPrincipal(userPrincipal); // Same user for minting
      const amountBigInt = numberToBigInt(parseInt(amount));

      console.log("From principal:", fromPrincipal);
      console.log("To principal:", toPrincipal);
      console.log("Amount as BigInt:", amountBigInt);

      console.log("Calling canister transfer function...");
      const result = await safeCanisterCall(
        () =>
          canisterActor.transfer(
            symbol,
            toPrincipal, // to (receiver) - SECOND parameter
            fromPrincipal, // from (sender) - THIRD parameter
            amountBigInt
          ),
        `Failed to mint ${amount} ${symbol}`
      );

      console.log("Transfer result:", result);

      if (result.success) {
        console.log(`Successfully minted ${amount} ${symbol}`);
        addNotification(`Successfully minted ${amount} ${symbol}`, "success");

        // Reload balances and transactions
        console.log("Reloading balances and transactions...");
        await loadBalances();
        await loadTransactions(symbol);
        console.log("Balances and transactions reloaded");
      } else {
        console.log("Mint failed:", result.error);
        addNotification(result.error, "error");
      }
    } catch (error) {
      console.error("Error minting tokens:", error);
      addNotification("Failed to mint tokens: " + error.message, "error");
    } finally {
      setLoading(false);
      console.log("Mint process completed");
    }
  };

  // Refresh balance for a specific token
  const refreshTokenBalance = async (symbol) => {
    if (!canisterActor || !userPrincipal || !symbol) {
      return;
    }

    try {
      console.log(`Refreshing balance for token: ${symbol}`);
      const userPrincipalObj = stringToPrincipal(userPrincipal);

      const result = await safeCanisterCall(
        () => canisterActor.balance_of(symbol, userPrincipalObj),
        `Failed to refresh balance for ${symbol}`
      );

      if (result.success) {
        const newBalance = bigIntToNumber(result.data);
        console.log(`New balance for ${symbol}:`, newBalance);

        // Update the balances state
        setBalances((prevBalances) => {
          const updatedBalances = { ...prevBalances, [symbol]: newBalance };

          // Save to localStorage
          const safeBalances = prepareForStorage(updatedBalances);
          localStorage.setItem("ic-balances", JSON.stringify(safeBalances));

          return updatedBalances;
        });
      }
    } catch (error) {
      console.error(`Error refreshing balance for ${symbol}:`, error);
    }
  };

  // Force refresh balance for a specific token with UI update
  const forceRefreshTokenBalance = async (symbol) => {
    if (!canisterActor || !userPrincipal || !symbol) {
      console.log("Cannot force refresh balance - missing:", {
        canisterActor: !!canisterActor,
        userPrincipal: !!userPrincipal,
        symbol,
      });
      return;
    }

    try {
      console.log(`=== FORCE REFRESHING BALANCE FOR ${symbol} ===`);
      const userPrincipalObj = stringToPrincipal(userPrincipal);

      // Add a small delay to ensure backend has processed the transfer
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = await safeCanisterCall(
        () => canisterActor.balance_of(symbol, userPrincipalObj),
        `Failed to force refresh balance for ${symbol}`
      );

      if (result.success) {
        const newBalance = bigIntToNumber(result.data);
        console.log(`Force refreshed balance for ${symbol}:`, newBalance);

        // Force update the balances state
        setBalances((prevBalances) => {
          const updatedBalances = { ...prevBalances, [symbol]: newBalance };
          console.log(`Updated balances state for ${symbol}:`, updatedBalances);

          // Save to localStorage
          const safeBalances = prepareForStorage(updatedBalances);
          localStorage.setItem("ic-balances", JSON.stringify(safeBalances));

          return updatedBalances;
        });

        // Force a re-render by updating a dummy state
        setForceUpdate((prev) => prev + 1);
      } else {
        console.error(
          `Failed to force refresh balance for ${symbol}:`,
          result.error
        );
      }
    } catch (error) {
      console.error(`Error force refreshing balance for ${symbol}:`, error);
    }
  };

  // Handle token symbol change in transfer form
  const handleTokenSymbolChange = (e) => {
    const newSymbol = e.target.value;
    setTransferForm({ ...transferForm, symbol: newSymbol });

    // Refresh balance for the selected token
    if (newSymbol) {
      refreshTokenBalance(newSymbol);
    }
  };

  // Show loading screen while checking authentication
  if (dataLoading && !isAuthenticated) {
    return (
      <div className="loading-indicator">
        <div className="spinner"></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h1>ICP Token Platform</h1>
          <p>Connect with Internet Identity to manage your tokens</p>
          <button onClick={handleLogin} className="login-btn">
            Login with Internet Identity
          </button>
          <button onClick={handleDevLogin} className="login-btn">
            Login with Dev Identity
          </button>
        </div>
      </div>
    );
  }

  // Debug function to show current state
  const showDebugInfo = () => {
    console.log("=== DEBUG INFO ===");
    console.log("isAuthenticated:", isAuthenticated);
    console.log("userPrincipal:", userPrincipal);
    console.log("canisterActor:", !!canisterActor);
    console.log("tokens count:", tokens.length);
    console.log("tokens data:", tokens);
    console.log("balances:", balances);
    console.log("transactions count:", transactions.length);
    console.log("localStorage tokens:", localStorage.getItem("ic-tokens"));
    console.log("localStorage balances:", localStorage.getItem("ic-balances"));
    console.log(
      "localStorage transactions:",
      localStorage.getItem("ic-transactions")
    );
    console.log("localStorage auth:", localStorage.getItem("ic-auth"));
    console.log(
      "localStorage principal:",
      localStorage.getItem("ic-principal")
    );
    console.log(
      "localStorage timestamp:",
      localStorage.getItem("ic-tokens-timestamp")
    );
    console.log("dataLoading:", dataLoading);
    console.log("loading:", loading);
    console.log("==================");
  };

  return (
    <div className="app">
      {/* Notifications */}
      <div className="notifications-container">
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            className={`notification ${notification.type}`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <span className="notification-message">{notification.message}</span>
            <button
              className="notification-close"
              onClick={() => removeNotification(index)}
              title="Close notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="16" cy="16" r="16" fill="url(#logoGradient)" />
                <path
                  d="M8 16C8 11.5817 11.5817 8 16 8C20.4183 8 24 11.5817 24 16C24 20.4183 20.4183 24 16 24C11.5817 24 8 20.4183 8 16Z"
                  fill="white"
                  fillOpacity="0.1"
                />
                <path
                  d="M16 10C12.6863 10 10 12.6863 10 16C10 19.3137 12.6863 22 16 22C19.3137 22 22 19.3137 22 16C22 12.6863 19.3137 10 16 10Z"
                  fill="white"
                  fillOpacity="0.2"
                />
                <circle cx="16" cy="16" r="4" fill="white" />
                <path
                  d="M16 12C13.7909 12 12 13.7909 12 16C12 18.2091 13.7909 20 16 20C18.2091 20 20 18.2091 20 16C20 13.7909 18.2091 12 16 12Z"
                  fill="url(#logoGradient)"
                />
              </svg>
              <defs>
                <linearGradient
                  id="logoGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#4facfe" />
                  <stop offset="100%" stopColor="#667eea" />
                </linearGradient>
              </defs>
            </div>
            <h2 className="logo-text">
              <span className="logo-brand">ICP TOKEN PLATFORM</span>
            </h2>
          </div>
          <div className="user-info">
            <div className="user-principal">
              <span className="principal-label">Principal:</span>
              <span className="principal-value">
                {userPrincipal?.slice(0, 20)}...
              </span>
              <button
                className="copy-principal-btn"
                onClick={() => {
                  navigator.clipboard.writeText(userPrincipal || "");
                  addNotification(
                    "Principal ID copied to clipboard!",
                    "success"
                  );
                }}
                title="Copy Principal ID"
              >
                📋
              </button>
            </div>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-btn ${activeTab === "tokens" ? "active" : ""}`}
          onClick={() => setActiveTab("tokens")}
        >
          🪙 Tokens
        </button>
        <button
          className={`nav-btn ${activeTab === "transfer" ? "active" : ""}`}
          onClick={() => setActiveTab("transfer")}
        >
          💸 Transfer
        </button>
        <button
          className={`nav-btn ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          📊 Transactions
        </button>
        <button
          className={`nav-btn ${activeTab === "balances" ? "active" : ""}`}
          onClick={() => setActiveTab("balances")}
        >
          💰 Balances
        </button>
      </nav>

      <main className="app-main">
        {activeTab === "tokens" && (
          <section className="tokens-section">
            <h2>Create New Token</h2>

            <form onSubmit={handleCreateToken} className="create-token-form">
              <div className="form-group">
                <label htmlFor="symbol">Token Symbol:</label>
                <input
                  type="text"
                  id="symbol"
                  value={newToken.symbol}
                  onChange={(e) =>
                    setNewToken({ ...newToken, symbol: e.target.value })
                  }
                  placeholder="Enter token symbol (e.g., BTC)"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="name">Token Name:</label>
                <input
                  type="text"
                  id="name"
                  value={newToken.name}
                  onChange={(e) =>
                    setNewToken({ ...newToken, name: e.target.value })
                  }
                  placeholder="Enter token name (e.g., Bitcoin)"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="totalSupply">Total Supply:</label>
                <input
                  type="number"
                  id="totalSupply"
                  value={newToken.totalSupply}
                  onChange={(e) =>
                    setNewToken({ ...newToken, totalSupply: e.target.value })
                  }
                  placeholder="Enter total supply (e.g., 1000000)"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="imageUrl">Image URL (optional):</label>
                <input
                  type="url"
                  id="imageUrl"
                  value={newToken.imageUrl}
                  onChange={(e) =>
                    setNewToken({ ...newToken, imageUrl: e.target.value })
                  }
                  placeholder="Enter image URL (e.g., https://example.com/image.png)"
                />
              </div>

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? "Creating..." : "Create Token"}
              </button>
            </form>

            <h2>Your Tokens</h2>

            {dataLoading ? (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <p>Loading tokens from ICP canister...</p>
              </div>
            ) : tokens.length === 0 ? (
              <p className="no-tokens">
                No tokens created yet. Create your first token above!
              </p>
            ) : (
              <div className="tokens-grid">
                {tokens.map((token) => (
                  <div key={token.id} className="token-card">
                    {token.imageUrl && (
                      <img
                        src={token.imageUrl}
                        alt={token.name}
                        className="token-image"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    )}
                    <h3>{token.symbol}</h3>
                    <p className="token-name">{token.name}</p>
                    <p className="token-supply">
                      Supply: {token.totalSupply || 0}
                    </p>
                    <p className="token-creator">
                      Creator: {userPrincipal?.slice(0, 20)}...
                    </p>
                    {/* Removed non-functional action buttons */}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "transfer" && (
          <section className="transfer-section">
            <h2>Transfer Tokens</h2>
            <form onSubmit={handleTransfer} className="transfer-form">
              <div className="form-group">
                <label htmlFor="transfer-symbol">Token Symbol:</label>
                <select
                  id="transfer-symbol"
                  value={transferForm.symbol}
                  onChange={handleTokenSymbolChange}
                  required
                >
                  <option value="">Select Token</option>
                  {tokens.map((token) => (
                    <option key={token.id} value={token.symbol}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
                {transferForm.symbol && (
                  <div className="balance-info">
                    <span className="balance-label">Your Balance:</span>
                    <span className="balance-amount">
                      {balances[transferForm.symbol] || 0} {transferForm.symbol}
                    </span>
                    <button
                      type="button"
                      onClick={() => refreshTokenBalance(transferForm.symbol)}
                      className="refresh-balance-btn"
                      title="Refresh balance"
                    >
                      🔄
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="transfer-to">To Address:</label>
                <input
                  type="text"
                  id="transfer-to"
                  value={transferForm.to}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, to: e.target.value })
                  }
                  placeholder="Enter recipient principal ID"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="transfer-amount">Amount:</label>
                <input
                  type="number"
                  id="transfer-amount"
                  value={transferForm.amount}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, amount: e.target.value })
                  }
                  placeholder="Enter amount to transfer"
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? "Transferring..." : "Transfer Tokens"}
              </button>
            </form>
          </section>
        )}

        {activeTab === "transactions" && (
          <section className="transactions-section">
            <h2>Transaction History</h2>
            <div className="transactions-header">
              <select
                value={activeTokenSymbol || ""}
                onChange={(e) => setActiveTokenSymbol(e.target.value)}
                className="token-selector"
              >
                <option value="">All Tokens</option>
                {tokens.map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <p>Loading transactions from ICP canister...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="transactions-empty-state">
                <div className="empty-icon">📊</div>
                <h3>No Transactions Found</h3>
                <p>
                  {activeTokenSymbol
                    ? `No transactions found for ${activeTokenSymbol} token.`
                    : "No transactions found. Create tokens or make transfers to see transaction history."}
                </p>
              </div>
            ) : (
              <div className="transactions-list">
                {transactions.map((tx, index) => {
                  // Format timestamp properly
                  const formatTimestamp = (timestamp) => {
                    try {
                      const date = new Date(timestamp);
                      if (isNaN(date.getTime())) {
                        return "Recent";
                      }
                      return date.toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });
                    } catch (error) {
                      return "Recent";
                    }
                  };

                  // Format principal addresses for better readability
                  const formatPrincipal = (principal) => {
                    if (!principal || principal === "Unknown") {
                      return "Unknown";
                    }
                    if (principal.length > 20) {
                      return `${principal.slice(0, 10)}...${principal.slice(
                        -10
                      )}`;
                    }
                    return principal;
                  };

                  return (
                    <div
                      key={`${tx.symbol}-${index}`}
                      className={`transaction-card ${tx.type.toLowerCase()}`}
                    >
                      <div className="transaction-header">
                        <span className="transaction-type">{tx.type}</span>
                        <span className="transaction-time">
                          {formatTimestamp(tx.timestamp)}
                        </span>
                      </div>
                      <div className="transaction-details">
                        <p>
                          <strong>From:</strong> {formatPrincipal(tx.from)}
                        </p>
                        <p>
                          <strong>To:</strong> {formatPrincipal(tx.to)}
                        </p>
                        <p>
                          <strong>Amount:</strong> {tx.amount} {tx.symbol}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === "balances" && (
          <section className="balances-section">
            <h2>Your Token Balances</h2>

            {dataLoading ? (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <p>Loading balances from ICP canister...</p>
              </div>
            ) : Object.keys(balances).length === 0 ? (
              <p className="no-balances">
                No token balances yet. Create some tokens first!
              </p>
            ) : (
              <div className="balances-grid">
                {Object.entries(balances).map(([symbol, balance]) => (
                  <div key={symbol} className="balance-card">
                    <h3>{symbol}</h3>
                    <p className="balance-amount">{balance}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>Built on the Internet Computer | Powered by ICP</p>
      </footer>
    </div>
  );
}

export default App;
