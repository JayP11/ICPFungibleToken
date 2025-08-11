export const idlFactory = ({ IDL }) => {
  const Transaction = IDL.Record({
    to: IDL.Principal,
    from: IDL.Opt(IDL.Principal),
    timestamp: IDL.Nat64,
    amount: IDL.Nat64,
  });

  return IDL.Service({
    balance_of: IDL.Func([IDL.Text, IDL.Principal], [IDL.Nat64], ["query"]),
    create_token: IDL.Func(
      [IDL.Principal, IDL.Text, IDL.Text, IDL.Text, IDL.Nat64],
      [IDL.Bool],
      []
    ),
    get_token_list: IDL.Func(
      [],
      [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text, IDL.Text))],
      ["query"]
    ),
    get_transactions: IDL.Func(
      [IDL.Text, IDL.Principal],
      [IDL.Vec(Transaction)],
      ["query"]
    ),
    total_supply: IDL.Func([IDL.Text], [IDL.Nat64], ["query"]),
    transfer: IDL.Func(
      [IDL.Text, IDL.Principal, IDL.Principal, IDL.Nat64],
      [IDL.Bool],
      []
    ),
  });
};

export const canisterId = (() => {
  // Check if we're running on localhost (development)
  if (typeof window !== "undefined") {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.includes("localhost");

    if (isLocalhost) {
      return "u6s2n-gx777-77774-qaaba-cai";
    }
  }

  // Fallback for production or when window is not available
  return (
    process.env.VITE_TOKEN_BACKEND_CANISTER_ID || "u6s2n-gx777-77774-qaaba-cai"
  );
})();
