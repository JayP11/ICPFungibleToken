import React, { useState, useEffect } from 'react';
import { tokenService } from './icp';
import { 
  Wallet, 
  Send, 
  Plus, 
  Shield, 
  RefreshCw, 
  LogIn, 
  LogOut,
  Copy,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [balance, setBalance] = useState('0');
  const [principal, setPrincipal] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [approveAmount, setApproveAmount] = useState('');
  const [approveSpender, setApproveSpender] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      const authStatus = await tokenService.initialize();
      setIsAuthenticated(authStatus);
      
      if (authStatus) {
        await loadTokenData();
        setPrincipal(tokenService.getPrincipal());
      }
    } catch (error) {
      console.error('Initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTokenData = async () => {
    try {
      const info = await tokenService.getTokenInfo();
      setTokenInfo(info);
      
      const userPrincipal = tokenService.getPrincipal();
      if (userPrincipal) {
        const userBalance = await tokenService.getBalance(userPrincipal);
        setBalance(userBalance.toString());
      }
    } catch (error) {
      console.error('Failed to load token data:', error);
    }
  };

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      await tokenService.login();
      setIsAuthenticated(true);
      setPrincipal(tokenService.getPrincipal());
      await loadTokenData();
      showMessage('success', 'Successfully logged in!');
    } catch (error) {
      showMessage('error', 'Login failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await tokenService.logout();
      setIsAuthenticated(false);
      setPrincipal('');
      setTokenInfo(null);
      setBalance('0');
      showMessage('success', 'Successfully logged out!');
    } catch (error) {
      showMessage('error', 'Logout failed: ' + error.message);
    }
  };

  const handleTransfer = async () => {
    if (!transferTo || !transferAmount) {
      showMessage('error', 'Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);
      await tokenService.transfer(transferTo, transferAmount);
      await loadTokenData();
      setTransferTo('');
      setTransferAmount('');
      showMessage('success', 'Transfer successful!');
    } catch (error) {
      showMessage('error', 'Transfer failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMint = async () => {
    if (!mintAmount) {
      showMessage('error', 'Please enter an amount');
      return;
    }

    try {
      setIsLoading(true);
      await tokenService.mint(mintAmount);
      await loadTokenData();
      setMintAmount('');
      showMessage('success', 'Tokens minted successfully!');
    } catch (error) {
      showMessage('error', 'Minting failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approveSpender || !approveAmount) {
      showMessage('error', 'Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);
      await tokenService.approve(approveSpender, approveAmount);
      setApproveSpender('');
      setApproveAmount('');
      showMessage('success', 'Approval successful!');
    } catch (error) {
      showMessage('error', 'Approval failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyPrincipal = () => {
    navigator.clipboard.writeText(principal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Wallet className="h-8 w-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">ICP Token Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Principal:</span>
                    <div className="flex items-center space-x-1">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {principal.slice(0, 8)}...{principal.slice(-8)}
                      </code>
                      <button
                        onClick={copyPrincipal}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleLogin}
                  className="btn-primary flex items-center space-x-2"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Connect Wallet</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-center space-x-2 ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {!isAuthenticated ? (
          /* Login Screen */
          <div className="text-center py-12">
            <Wallet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to ICP Token</h2>
            <p className="text-gray-600 mb-8">Connect your Internet Identity to start managing your tokens</p>
            <button
              onClick={handleLogin}
              className="btn-primary text-lg px-8 py-3"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          /* Dashboard */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Token Info Card */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Token Information
              </h3>
              {tokenInfo && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium">{tokenInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Symbol:</span>
                    <span className="font-medium">{tokenInfo.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Decimals:</span>
                    <span className="font-medium">{tokenInfo.decimals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Supply:</span>
                    <span className="font-medium">{tokenInfo.totalSupply.toString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Your Balance:</span>
                    <span className="font-medium text-primary-600">{balance}</span>
                  </div>
                </div>
              )}
              <button
                onClick={loadTokenData}
                className="btn-secondary w-full mt-4 flex items-center justify-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Transfer Card */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Send className="h-5 w-5 mr-2" />
                Transfer Tokens
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Principal
                  </label>
                  <input
                    type="text"
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    placeholder="Enter principal ID"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="input-field"
                  />
                </div>
                <button
                  onClick={handleTransfer}
                  disabled={isLoading}
                  className="btn-primary w-full"
                >
                  {isLoading ? 'Transferring...' : 'Transfer'}
                </button>
              </div>
            </div>

            {/* Mint Card */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Plus className="h-5 w-5 mr-2" />
                Mint Tokens
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    placeholder="Enter amount to mint"
                    className="input-field"
                  />
                </div>
                <button
                  onClick={handleMint}
                  disabled={isLoading}
                  className="btn-primary w-full"
                >
                  {isLoading ? 'Minting...' : 'Mint Tokens'}
                </button>
              </div>
            </div>

            {/* Approve Card */}
            <div className="card lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Approve Spending
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Spender Principal
                  </label>
                  <input
                    type="text"
                    value={approveSpender}
                    onChange={(e) => setApproveSpender(e.target.value)}
                    placeholder="Enter spender principal"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={approveAmount}
                    onChange={(e) => setApproveAmount(e.target.value)}
                    placeholder="Enter amount to approve"
                    className="input-field"
                  />
                </div>
              </div>
              <button
                onClick={handleApprove}
                disabled={isLoading}
                className="btn-primary w-full mt-4"
              >
                {isLoading ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App; 