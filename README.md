# ICP Fungible Token

This project implements a fungible token on the Internet Computer Protocol (ICP) using the ICRC-1 and ICRC-2 standards.

## 🌐 Live Demo

**GitHub Pages**: [https://jayp11.github.io/ICPFungibleToken](https://jayp11.github.io/ICPFungibleToken)

The live demo showcases the token's frontend interface where you can interact with the ICP token directly in your browser.

## Features

- **ICRC-1 Compliant**: Implements the standard fungible token interface
- **ICRC-2 Support**: Includes approval and transferFrom functionality
- **Stable Storage**: Uses stable memory for persistent data storage
- **Configurable**: Token name, symbol, decimals, and fee can be customized
- **Minting**: Supports token minting functionality

## Token Details

- **Name**: My Token
- **Symbol**: MTK
- **Decimals**: 8
- **Fee**: 0.0001 tokens per transaction
- **Standard**: ICRC-1 & ICRC-2

## Prerequisites

1. **DFX**: Install the DFX SDK
   ```bash
   sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"
   ```

2. **Rust**: Install Rust and the wasm32 target
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup target add wasm32-unknown-unknown
   ```

## Deployment

### 1. Start Local Network
```bash
dfx start --background
```

### 2. Deploy the Token
```bash
dfx deploy
```

### 3. Get Canister ID
```bash
dfx canister id token
```

## Usage

### Query Functions

#### Get Token Information
```bash
# Get token name
dfx canister call token icrc1_name

# Get token symbol
dfx canister call token icrc1_symbol

# Get token decimals
dfx canister call token icrc1_decimals

# Get transaction fee
dfx canister call token icrc1_fee

# Get total supply
dfx canister call token icrc1_total_supply

# Get supported standards
dfx canister call token icrc1_supported_standards

# Get metadata
dfx canister call token icrc1_metadata
```

#### Check Balance
```bash
# Replace PRINCIPAL_ID with the actual principal ID
dfx canister call token icrc1_balance_of '(record { owner = principal "PRINCIPAL_ID"; subaccount = null })'
```

### Update Functions

#### Mint Tokens
```bash
# Mint 1000 tokens to caller
dfx canister call token icrc1_mint '(opt record { to = null; memo = null; created_at_time = null; amount = 1000 })'

# Mint to specific account
dfx canister call token icrc1_mint '(opt record { to = opt record { owner = principal "PRINCIPAL_ID"; subaccount = null }; memo = null; created_at_time = null; amount = 1000 })'
```

#### Transfer Tokens
```bash
# Transfer tokens to another account
dfx canister call token icrc1_transfer '(record { from_subaccount = null; to = record { owner = principal "RECIPIENT_PRINCIPAL"; subaccount = null }; amount = 100; fee = null; memo = null; created_at_time = null })'
```

#### Approve Spending
```bash
# Approve another principal to spend tokens
dfx canister call token icrc2_approve '(record { from_subaccount = null; spender = principal "SPENDER_PRINCIPAL"; amount = 500; expires_at = null; fee = null; memo = null; created_at_time = null })'
```

#### Check Allowance
```bash
# Check allowance for a spender
dfx canister call token icrc2_allowance '(record { account = record { owner = principal "OWNER_PRINCIPAL"; subaccount = null }; spender = principal "SPENDER_PRINCIPAL" })'
```

#### Transfer From (ICRC-2)
```bash
# Transfer tokens on behalf of another account
dfx canister call token icrc2_transfer_from '(record { spender_subaccount = null; from = record { owner = principal "FROM_PRINCIPAL"; subaccount = null }; to = record { owner = principal "TO_PRINCIPAL"; subaccount = null }; amount = 50; fee = null; memo = null; created_at_time = null })'
```

## Project Structure

```
TokenCreation/
├── dfx.json              # DFX configuration
├── Cargo.toml            # Workspace Cargo configuration
├── .github/workflows/    # GitHub Actions workflows
├── src/
│   ├── frontend/         # React frontend application
│   │   ├── src/          # React source code
│   │   ├── public/       # Static assets
│   │   └── package.json  # Frontend dependencies
│   └── token/
│       ├── Cargo.toml    # Token canister dependencies
│       ├── token.did     # Candid interface definition
│       └── src/
│           └── lib.rs    # Main token implementation
└── README.md             # This file
```

## Customization

To customize the token, modify the `init()` function in `src/token/src/lib.rs`:

```rust
Metadata {
    name: "Your Token Name".to_string(),
    symbol: "SYMBOL".to_string(),
    decimals: 8,
    fee: Nat::from(10000u64), // Adjust fee as needed
    logo: Some("https://your-logo-url.com".to_string()),
    description: Some("Your token description".to_string()),
    url: Some("https://your-token-url.com".to_string()),
    metadata: None,
}
```

## Testing

### Local Testing
1. Deploy to local network
2. Use the provided commands to test all functionality
3. Check balances and transfers work correctly

### Mainnet Deployment
1. Ensure you have sufficient cycles
2. Deploy to mainnet using `dfx deploy --network ic`
3. Register the canister with the IC registry if needed

## Security Considerations

- The current implementation includes basic security measures
- Consider adding access control for minting
- Implement proper error handling for production use
- Add transaction logging for audit purposes

## Troubleshooting

### Common Issues

1. **Build Errors**: Ensure Rust and wasm32 target are installed
2. **Deployment Failures**: Check that DFX is running and you have sufficient cycles
3. **Function Call Errors**: Verify principal IDs are correct and accounts exist

### Getting Help

- Check the [Internet Computer documentation](https://internetcomputer.org/docs)
- Review the [ICRC-1 specification](https://github.com/dfinity/ICRC-1)
- Consult the [DFX documentation](https://internetcomputer.org/docs/current/developer-docs/setup/install/)

## Deployment

### GitHub Pages

This project is automatically deployed to GitHub Pages. The deployment process:

1. **Automatic Deployment**: Every push to the `main` branch triggers an automatic deployment
2. **Manual Deployment**: You can also deploy manually by running:
   ```bash
   cd src/frontend
   npm run deploy
   ```

### Local Development

To run the frontend locally:
```bash
cd src/frontend
npm start
```

## License

This project is provided as-is for educational and development purposes.
