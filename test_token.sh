#!/bin/bash

# Test script for ICP Fungible Token
# Make sure dfx is running and the token canister is deployed

echo "🧪 Testing ICP Fungible Token"
echo "=============================="

# Get canister ID
CANISTER_ID=$(dfx canister id token)
echo "Token Canister ID: $CANISTER_ID"
echo ""

# Test basic token information
echo "📋 Token Information:"
echo "Name: $(dfx canister call token icrc1_name)"
echo "Symbol: $(dfx canister call token icrc1_symbol)"
echo "Decimals: $(dfx canister call token icrc1_decimals)"
echo "Fee: $(dfx canister call token icrc1_fee)"
echo "Total Supply: $(dfx canister call token icrc1_total_supply)"
echo ""

# Test supported standards
echo "📚 Supported Standards:"
dfx canister call token icrc1_supported_standards
echo ""

# Test metadata
echo "📊 Metadata:"
dfx canister call token icrc1_metadata
echo ""

# Get current user principal
CURRENT_PRINCIPAL=$(dfx identity get-principal)
echo "Current Principal: $CURRENT_PRINCIPAL"
echo ""

# Test balance before minting
echo "💰 Balance before minting:"
dfx canister call token icrc1_balance_of "(record { owner = principal \"$CURRENT_PRINCIPAL\"; subaccount = null })"
echo ""

# Test minting
echo "🪙 Minting 1000 tokens:"
dfx canister call token icrc1_mint "(opt record { to = null; memo = null; created_at_time = null; amount = 1000 })"
echo ""

# Test balance after minting
echo "💰 Balance after minting:"
dfx canister call token icrc1_balance_of "(record { owner = principal \"$CURRENT_PRINCIPAL\"; subaccount = null })"
echo ""

# Test total supply after minting
echo "📈 Total supply after minting:"
dfx canister call token icrc1_total_supply
echo ""

echo "✅ Basic tests completed!"
echo ""
echo "To test transfers, you'll need another principal ID."
echo "You can create a new identity with: dfx identity new test_user"
echo "Then switch to it with: dfx identity use test_user"
echo ""
echo "To test ICRC-2 functionality (approve/transferFrom), use the commands in the README.md" 