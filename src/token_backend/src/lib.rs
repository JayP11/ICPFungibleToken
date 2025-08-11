use std::collections::HashMap;
use candid::{CandidType, Principal};





#[derive(Clone, Debug, CandidType)]
struct Transaction{
    from:Option<Principal>,
    to: Principal,
    amount:u64,
    timestamp:u64,
}

struct Token{
    name: String,
    symbol:String,
    image_url: String,
    total_supply:u64,
    owner:Principal,
    balances: HashMap<Principal, u64>,
    transaction: HashMap<Principal, Vec<Transaction>>,
}


static mut TOKENS: Option<HashMap<String, Token>> = None;

#[ic_cdk::init]
fn init(){
    ic_cdk::println!("init running");
    unsafe{
        TOKENS = Some(HashMap::new());
    }
}

#[ic_cdk::update]
fn create_token(token_owner:Principal, name:String, symbol: String, image_url:String,total_supply:u64)->bool{
    // let creater = ownerr;
    let token = Token{
        name,
        symbol:symbol.clone(),
        image_url,
        total_supply,
        owner:token_owner,
        balances:{
            let mut map = HashMap::new();
            map.insert(token_owner, total_supply);
            map
        },
        transaction:{
            let mut txs =  HashMap::new();
            txs.insert(
                token_owner,
                vec![Transaction{
                    from:None,
                    to:token_owner,
                    amount:total_supply,
                    timestamp:ic_cdk::api::time(),
                }],
            );
            ic_cdk::println!("complet minting");
            txs
        },
    };
    unsafe{
        // let tokens = TOKENS.as_mut().expect("errors gfkgjgerigjvng");
        // tokens.insert(symbol,token);
        if let Some(tokens) = TOKENS.as_mut() {
            tokens.insert(symbol, token);
            return true;
        } else {
            ic_cdk::println!("Failed to access TOKENS");
            return false;
        }

    }
}

#[ic_cdk::update]
fn transfer(symbol:String, to:Principal,from:Principal, amount: u64) ->bool{
    let sender = from;
    unsafe{
        let tokens = TOKENS.as_mut().unwrap();
        if let Some(token) = tokens.get_mut(&symbol){
            let sender_balance = token.balances.entry(sender).or_insert(0);
            if *sender_balance < amount{
                return false;
            }

            *sender_balance -= amount;
            let receiver_balance = token.balances.entry(to).or_insert(0);
            *receiver_balance +=amount;

            let tx = Transaction{
                from:Some(sender),
                to,
                amount,
                timestamp:ic_cdk::api::time(),
            };
            token.transaction.entry(sender).or_default().push(tx.clone());
            token.transaction.entry(to).or_default().push(tx);

            return true;
            
        }
    }
    false

}

#[ic_cdk::query]
fn balance_of(symbol: String, user:Principal) -> u64{
    unsafe{
        if let Some(token) = TOKENS.as_ref().unwrap().get(&symbol){
            return *token.balances.get(&user).unwrap_or(&0);
        }
    }
    0
}

#[ic_cdk::query]
fn total_supply(symbol:String)-> u64{
    unsafe{
        if let Some(token) = TOKENS.as_ref().unwrap().get(&symbol){
            return token.total_supply;
        }
    }
    0
}

#[ic_cdk::query]
fn get_token_list() -> Vec<(String,String,String)>{
    unsafe{
        TOKENS.as_ref().unwrap().iter().map(|(_,Token)|{
            (
                Token.name.clone(),
                Token.symbol.clone(),
                Token.image_url.clone(),
            )
        }).collect()
    }
}

#[ic_cdk::query]
fn get_transactions(symbol:String, user:Principal)-> Vec<Transaction>{
    unsafe{
        if let Some(token)= TOKENS.as_ref().unwrap().get(&symbol){
            return token.transaction.get(&user).cloned().unwrap_or_default();
        }
    }
    vec![]
}





ic_cdk::export_candid!();