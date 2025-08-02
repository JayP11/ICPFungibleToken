import { Actor, HttpAgent } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { Principal } from '@dfinity/principal';

// Debug logging
const DEBUG = true;
function log(...args) {
  if (DEBUG) console.log('[TokenService]', ...args);
}

// Token canister ID (replace with your actual canister ID)
const TOKEN_CANISTER_ID = 'bkyz2-fmaaa-aaaaa-qaaaq-cai';

// Token interface (simplified for frontend)
const tokenInterface = {
  icrc1_name: () => [],
  icrc1_symbol: () => [],
  icrc1_decimals: () => [],
  icrc1_fee: () => [],
  icrc1_total_supply: () => [],
  icrc1_balance_of: (Account) => [],
  icrc1_transfer: (TransferArg) => [],
  icrc1_mint: (MintArg) => [],
  icrc2_approve: (ApproveArg) => [],
  icrc2_allowance: (AllowanceArg) => [],
  icrc2_transfer_from: (TransferFromArg) => [],
};

class TokenService {
  constructor() {
    this.agent = null;
    this.authClient = null;
    this.actor = null;
    this.isAuthenticated = false;
  }

  async initialize() {
    try {
      log('Initializing TokenService...');
      
      // Initialize auth client
      log('Creating AuthClient...');
      this.authClient = await AuthClient.create();
      log('AuthClient created successfully');
      
      // Check if user is already authenticated
      log('Checking authentication status...');
      const isAuthenticated = await this.authClient.isAuthenticated();
      log('Authentication status:', isAuthenticated);
      
      if (isAuthenticated) {
        log('User is authenticated, setting up agent...');
        await this.setupAgent();
      }
      
      return isAuthenticated;
    } catch (error) {
      console.error('Failed to initialize auth client:', error);
      return false;
    }
  }

  async login() {
    return new Promise((resolve, reject) => {
      try {
        log('Starting login process...');
        const identityProvider = 'https://identity.ic0.app';
        
        if (!this.authClient) {
          log('Error: AuthClient not initialized');
          reject(new Error('AuthClient not properly initialized'));
          return;
        }
        
        log('AuthClient found, checking login method...');
        if (typeof this.authClient.login !== 'function') {
          log('Error: login method is not a function');
          reject(new Error('AuthClient login method not available'));
          return;
        }
        
        log('Calling AuthClient.login...');
        this.authClient.login({
          identityProvider,
          onSuccess: async () => {
            try {
              log('Login successful, setting up agent...');
              await this.setupAgent();
              this.isAuthenticated = true;
              resolve(true);
            } catch (error) {
              log('Error in onSuccess:', error);
              reject(error);
            }
          },
          onError: (error) => {
            log('Login error:', error);
            reject(error);
          },
        });
      } catch (error) {
        log('Error in login method:', error);
        reject(error);
      }
    });
  }

  async logout() {
    await this.authClient.logout();
    this.agent = null;
    this.actor = null;
    this.isAuthenticated = false;
  }

  async setupAgent() {
    const identity = this.authClient.getIdentity();
    this.agent = new HttpAgent({ identity });
    
    // For local development
    if (process.env.NODE_ENV !== 'production') {
      this.agent.fetchRootKey().catch(console.error);
    }
    
    this.actor = Actor.createActor(tokenInterface, {
      agent: this.agent,
      canisterId: TOKEN_CANISTER_ID,
    });
  }

  // Token functions
  async getTokenInfo() {
    if (!this.actor) throw new Error('Not authenticated');
    
    const [name, symbol, decimals, fee, totalSupply] = await Promise.all([
      this.actor.icrc1_name(),
      this.actor.icrc1_symbol(),
      this.actor.icrc1_decimals(),
      this.actor.icrc1_fee(),
      this.actor.icrc1_total_supply(),
    ]);
    
    return { name, symbol, decimals, fee, totalSupply };
  }

  async getBalance(principal) {
    if (!this.actor) throw new Error('Not authenticated');
    
    const account = {
      owner: Principal.fromText(principal),
      subaccount: [],
    };
    
    return await this.actor.icrc1_balance_of(account);
  }

  async transfer(to, amount) {
    if (!this.actor) throw new Error('Not authenticated');
    
    const transferArg = {
      to: {
        owner: Principal.fromText(to),
        subaccount: [],
      },
      amount: BigInt(amount),
      fee: [],
      memo: [],
      created_at_time: [],
    };
    
    return await this.actor.icrc1_transfer(transferArg);
  }

  async mint(amount) {
    if (!this.actor) throw new Error('Not authenticated');
    
    const mintArg = {
      to: [],
      memo: [],
      created_at_time: [],
      amount: BigInt(amount),
    };
    
    return await this.actor.icrc1_mint([mintArg]);
  }

  async approve(spender, amount) {
    if (!this.actor) throw new Error('Not authenticated');
    
    const approveArg = {
      spender: Principal.fromText(spender),
      amount: BigInt(amount),
      expires_at: [],
      fee: [],
      memo: [],
      created_at_time: [],
    };
    
    return await this.actor.icrc2_approve(approveArg);
  }

  async getAllowance(owner, spender) {
    if (!this.actor) throw new Error('Not authenticated');
    
    const allowanceArg = {
      account: {
        owner: Principal.fromText(owner),
        subaccount: [],
      },
      spender: Principal.fromText(spender),
    };
    
    return await this.actor.icrc2_allowance(allowanceArg);
  }

  getPrincipal() {
    if (!this.authClient) return null;
    const identity = this.authClient.getIdentity();
    return identity.getPrincipal().toText();
  }
}

export const tokenService = new TokenService(); 