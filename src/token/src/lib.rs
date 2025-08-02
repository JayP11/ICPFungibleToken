use candid::{CandidType, Nat, Principal};
use ic_cdk::api::caller;
use ic_cdk_macros::*;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;

// Simple Account type
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Hash)]
struct Account {
    owner: Principal,
    subaccount: Option<Vec<u8>>,
}

// Token state
thread_local! {
    static STATE: RefCell<TokenState> = RefCell::new(TokenState::new());
}

#[derive(Clone)]
struct TokenState {
    name: String,
    symbol: String,
    decimals: u8,
    total_supply: Nat,
    balances: HashMap<Account, Nat>,
    allowances: HashMap<(Account, Principal), Nat>,
}

impl TokenState {
    fn new() -> Self {
        Self {
            name: "My Token".to_string(),
            symbol: "MTK".to_string(),
            decimals: 8,
            total_supply: Nat::from(0u64),
            balances: HashMap::new(),
            allowances: HashMap::new(),
        }
    }

    // ERC20-style functions
    fn balance_of(&self, account: &Account) -> Nat {
        self.balances.get(account).cloned().unwrap_or_else(|| Nat::from(0u64))
    }

    fn transfer(&mut self, from: &Account, to: &Account, amount: Nat) -> Result<(), String> {
        if self.balance_of(from) < amount {
            return Err("Insufficient balance".to_string());
        }

        let from_balance = self.balances.get(from).cloned().unwrap_or_else(|| Nat::from(0u64));
        let to_balance = self.balances.get(to).cloned().unwrap_or_else(|| Nat::from(0u64));

        self.balances.insert(from.clone(), from_balance - amount.clone());
        self.balances.insert(to.clone(), to_balance + amount);

        Ok(())
    }

    fn mint(&mut self, to: &Account, amount: Nat) {
        let current_balance = self.balance_of(to);
        self.balances.insert(to.clone(), current_balance + amount.clone());
        self.total_supply = self.total_supply.clone() + amount;
    }

    fn approve(&mut self, owner: &Account, spender: Principal, amount: Nat) {
        self.allowances.insert((owner.clone(), spender), amount);
    }

    fn allowance(&self, owner: &Account, spender: Principal) -> Nat {
        self.allowances.get(&(owner.clone(), spender)).cloned().unwrap_or_else(|| Nat::from(0u64))
    }

    fn transfer_from(&mut self, spender: &Account, from: &Account, to: &Account, amount: Nat) -> Result<(), String> {
        let allowance = self.allowance(from, spender.owner);
        if allowance < amount {
            return Err("Insufficient allowance".to_string());
        }

        if self.balance_of(from) < amount {
            return Err("Insufficient balance".to_string());
        }

        // Update allowance
        self.allowances.insert((from.clone(), spender.owner), allowance - amount.clone());

        // Transfer
        self.transfer(from, to, amount)?;

        Ok(())
    }
}

// ICRC-1 Interface (required for ICP compatibility)
#[query]
fn icrc1_name() -> String {
    STATE.with(|state| state.borrow().name.clone())
}

#[query]
fn icrc1_symbol() -> String {
    STATE.with(|state| state.borrow().symbol.clone())
}

#[query]
fn icrc1_decimals() -> u8 {
    STATE.with(|state| state.borrow().decimals)
}

#[query]
fn icrc1_fee() -> Nat {
    Nat::from(0u64) // No fees for simplicity
}

#[query]
fn icrc1_total_supply() -> Nat {
    STATE.with(|state| state.borrow().total_supply.clone())
}

#[query]
fn icrc1_balance_of(account: Account) -> Nat {
    STATE.with(|state| state.borrow().balance_of(&account))
}

#[query]
fn icrc1_supported_standards() -> Vec<Record> {
    vec![
        Record { name: "ICRC-1".to_string(), url: "https://github.com/dfinity/ICRC-1".to_string() },
        Record { name: "ICRC-2".to_string(), url: "https://github.com/dfinity/ICRC-2".to_string() },
    ]
}

#[query]
fn icrc1_metadata() -> Vec<(String, String)> {
    STATE.with(|state| {
        let state = state.borrow();
        vec![
            ("icrc1:name".to_string(), state.name.clone()),
            ("icrc1:symbol".to_string(), state.symbol.clone()),
            ("icrc1:decimals".to_string(), state.decimals.to_string()),
            ("icrc1:fee".to_string(), "0".to_string()),
        ]
    })
}

// Transfer function
#[update]
fn icrc1_transfer(arg: TransferArg) -> Result<Nat, String> {
    let from = Account { owner: caller(), subaccount: arg.from_subaccount };
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.transfer(&from, &arg.to, arg.amount)?;
        Ok(Nat::from(0u64))
    })
}

// Mint function
#[update]
fn icrc1_mint(arg: Option<MintArg>) -> Result<Nat, String> {
    let mint_arg = arg.ok_or("Mint arguments required")?;
    let to = mint_arg.to.unwrap_or_else(|| Account { owner: caller(), subaccount: None });
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.mint(&to, mint_arg.amount);
        Ok(Nat::from(0u64))
    })
}

// ICRC-2 Interface
#[query]
fn icrc2_allowance(arg: AllowanceArg) -> Allowance {
    STATE.with(|state| {
        let state = state.borrow();
        Allowance {
            allowance: state.allowance(&arg.account, arg.spender),
            expires_at: None,
        }
    })
}

#[update]
fn icrc2_approve(arg: ApproveArg) -> ApproveResult {
    let from = Account { owner: caller(), subaccount: arg.from_subaccount };
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.approve(&from, arg.spender, arg.amount);
        ApproveResult { ok: Some(Nat::from(0u64)), err: None }
    })
}

#[update]
fn icrc2_transfer_from(arg: TransferFromArg) -> TransferFromResult {
    let spender = Account { owner: caller(), subaccount: arg.spender_subaccount };
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        match state.transfer_from(&spender, &arg.from, &arg.to, arg.amount) {
            Ok(_) => TransferFromResult { ok: Some(Nat::from(0u64)), err: None },
            Err(e) => TransferFromResult { 
                ok: None, 
                err: Some(TransferFromError { 
                    generic_error: Some(GenericError { error_code: Nat::from(1u64), message: e }),
                    ..Default::default()
                })
            }
        }
    })
}

// Helper types for ICRC compatibility
#[derive(CandidType, Serialize, Deserialize, Clone)]
struct Record {
    name: String,
    url: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
struct TransferArg {
    from_subaccount: Option<Vec<u8>>,
    to: Account,
    amount: Nat,
    fee: Option<Nat>,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
struct MintArg {
    to: Option<Account>,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
    amount: Nat,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
struct ApproveArg {
    from_subaccount: Option<Vec<u8>>,
    spender: Principal,
    amount: Nat,
    expires_at: Option<u64>,
    fee: Option<Nat>,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
struct ApproveResult {
    ok: Option<Nat>,
    err: Option<ApproveError>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Default)]
struct ApproveError {
    bad_fee: Option<BadFee>,
    bad_burn: Option<BadBurn>,
    insufficient_funds: Option<InsufficientFunds>,
    too_old: Option<()>,
    created_in_future: Option<CreatedInFuture>,
    duplicate: Option<Duplicate>,
    temporarily_unavailable: Option<()>,
    generic_error: Option<GenericError>,
    allowance_changed: Option<AllowanceChanged>,
    expired: Option<Expired>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
struct TransferFromArg {
    spender_subaccount: Option<Vec<u8>>,
    from: Account,
    to: Account,
    amount: Nat,
    fee: Option<Nat>,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
struct TransferFromResult {
    ok: Option<Nat>,
    err: Option<TransferFromError>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Default)]
struct TransferFromError {
    bad_fee: Option<BadFee>,
    bad_burn: Option<BadBurn>,
    insufficient_funds: Option<InsufficientFunds>,
    too_old: Option<()>,
    created_in_future: Option<CreatedInFuture>,
    duplicate: Option<Duplicate>,
    temporarily_unavailable: Option<()>,
    generic_error: Option<GenericError>,
    allowance_changed: Option<AllowanceChanged>,
    expired: Option<Expired>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
struct AllowanceArg {
    account: Account,
    spender: Principal,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
struct Allowance {
    allowance: Nat,
    expires_at: Option<u64>,
}

// Error types
#[derive(CandidType, Serialize, Deserialize, Clone)]
struct BadFee { expected_fee: Nat }
#[derive(CandidType, Serialize, Deserialize, Clone)]
struct BadBurn { min_burn_amount: Nat }
#[derive(CandidType, Serialize, Deserialize, Clone)]
struct InsufficientFunds { balance: Nat }
#[derive(CandidType, Serialize, Deserialize, Clone)]
struct CreatedInFuture { ledger_time: u64 }
#[derive(CandidType, Serialize, Deserialize, Clone)]
struct Duplicate { duplicate_of: Nat }
#[derive(CandidType, Serialize, Deserialize, Clone)]
struct GenericError { error_code: Nat, message: String }
#[derive(CandidType, Serialize, Deserialize, Clone)]
struct AllowanceChanged { current_allowance: Nat }
#[derive(CandidType, Serialize, Deserialize, Clone)]
struct Expired { ledger_time: u64 }

#[init]
fn init() {
    // State is already initialized in thread_local!
} 