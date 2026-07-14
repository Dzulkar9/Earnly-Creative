"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  Check, 
  Sparkles, 
  RefreshCw, 
  Send, 
  QrCode, 
  History, 
  Loader2, 
  ArrowLeft, 
  Globe 
} from 'lucide-react';
import { 
  getNetwork, 
  getWalletBalances, 
  fetchRecentPayments, 
  sendStellarPayment, 
  NetworkType,
  StellarTransaction 
} from '@/lib/stellar';
import WalletConnectionModal from '../components/WalletConnectionModal';

export default function WalletPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetworkState] = useState<NetworkType>('simulation');
  const [walletType, setWalletType] = useState<string>('freighter');
  const [balances, setBalances] = useState<{ xlm: number; usdc: number }>({ xlm: 0, usdc: 0 });
  const [loadingBalance, setLoadingBalance] = useState(false);
  
  // Tabs: 'dashboard' | 'send' | 'receive' | 'activity'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'send' | 'receive' | 'activity'>('dashboard');
  
  // Modals / Helpers
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Send Form State
  const [sendAsset, setSendAsset] = useState<'XLM' | 'USDC'>('XLM');
  const [sendDest, setSendDest] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendMemo, setSendMemo] = useState('');
  const [sending, setSending] = useState(false);
  
  // Activity / History State
  const [transactions, setTransactions] = useState<StellarTransaction[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  
  // Friendbot Funding State
  const [funding, setFunding] = useState(false);

  useEffect(() => {
    const handleWalletChange = () => {
      const savedAddr = localStorage.getItem('earnly_wallet_address');
      const savedType = localStorage.getItem('earnly_wallet_type') || 'freighter';
      const activeNet = getNetwork();
      
      setAddress(savedAddr);
      setWalletType(savedType);
      setNetworkState(activeNet);
    };
    
    // Sync browser-specific wallet data deferred to avoid SSR hydration mismatches
    const timer = setTimeout(handleWalletChange, 0);
    
    window.addEventListener('walletChange', handleWalletChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('walletChange', handleWalletChange);
    };
  }, []);

  // Fetch balances and activity asynchronously deferred to avoid synchronous cascading renders
  const loadBalances = async (addr: string) => {
    setLoadingBalance(true);
    try {
      const res = await getWalletBalances(addr);
      if (res) {
        setBalances(res);
      }
    } catch (e) {
      console.error("Failed to load balances:", e);
    } finally {
      setLoadingBalance(false);
    }
  };

  const loadActivity = async (addr: string, net: NetworkType) => {
    setLoadingActivity(true);
    try {
      const txs = await fetchRecentPayments(addr, net);
      setTransactions(txs);
    } catch (e) {
      console.error("Failed to load activity:", e);
    } finally {
      setLoadingActivity(false);
    }
  };

  // Fetch balances and activity asynchronously deferred to avoid synchronous cascading renders
  useEffect(() => {
    if (!address) return;

    let active = true;

    const loadData = async () => {
      if (!active) return;
      await loadBalances(address);
      if (active && activeTab === 'activity') {
        await loadActivity(address, network);
      }
    };

    // Defer to execution queue to satisfy React effect purity guidelines
    const timer = setTimeout(loadData, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [address, network, activeTab]);

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fund testnet account
  const handleFriendbotFund = async () => {
    if (!address || funding) return;
    setFunding(true);
    try {
      const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`);
      if (res.ok) {
        alert("Account funded successfully with 10,000 Testnet XLM!");
        loadBalances(address);
      } else {
        const err = await res.json();
        throw new Error(err.detail || "Friendbot server rejected funding request.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fund wallet";
      alert(msg);
    } finally {
      setFunding(false);
    }
  };

  // Send Payment Submit Handler
  const handleSendPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    if (!sendDest.trim() || !sendAmount.trim()) {
      alert("Please fill in recipient address and amount.");
      return;
    }
    
    // Simple checks
    if (!/^G[A-Z2-7]{55}$/.test(sendDest.trim())) {
      alert("Invalid Stellar recipient address format (must start with 'G' and be 56 characters long).");
      return;
    }
    const val = parseFloat(sendAmount);
    if (isNaN(val) || val <= 0) {
      alert("Amount must be a positive number.");
      return;
    }

    setSending(true);
    try {
      const hash = await sendStellarPayment(address, sendDest.trim(), sendAmount.trim(), sendAsset, sendMemo);
      alert(`Payment submitted successfully! Tx Hash: ${hash.slice(0, 8)}...${hash.slice(-8)}`);
      // Reset form
      setSendDest('');
      setSendAmount('');
      setSendMemo('');
      // Reload details
      loadBalances(address);
      setActiveTab('dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment execution failed";
      alert(msg);
    } finally {
      setSending(false);
    }
  };

  const getFriendlyNetworkName = () => {
    if (network === 'simulation') return 'Simulation Mode (Mocknet)';
    if (network === 'testnet') return 'Stellar Testnet';
    return 'Stellar Mainnet';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative pb-16">
      {/* Background radial overlays */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-[600px] h-[600px] rounded-full bg-teal-500/5 blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Header Breadcrumbs / Title */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link 
              href="/"
              className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg transition"
            >
              <ArrowLeft className="w-4 h-4 text-zinc-400" />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Lumen Wallet</h1>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>{getFriendlyNetworkName()}</span>
              </p>
            </div>
          </div>
          
          {address && (
            <button
              onClick={() => loadBalances(address)}
              disabled={loadingBalance}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBalance ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>

        {/* UNCONNECTED VIEW */}
        {!address ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 text-center max-w-md mx-auto my-12 shadow-xl backdrop-blur-md">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-indigo-500/20">
              <Wallet className="w-7 h-7 text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Connect Your Wallet</h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Connect via Stellar Wallets Kit, Freighter, or generate a testnet keypair to view balances, send payments, and trace transaction histories.
            </p>
            <button
              onClick={() => setIsWalletModalOpen(true)}
              className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg text-xs transition duration-200 shadow-md shadow-indigo-600/10"
            >
              Select Connection Method
            </button>
          </div>
        ) : (
          /* CONNECTED DASHBOARD */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* LEFT PROFILE CARD */}
            <div className="md:col-span-1 space-y-6">
              
              {/* Account Address Card */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-lg backdrop-blur-md">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Connected Wallet
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                    {walletType.toUpperCase()}
                  </span>
                </div>
                
                <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl font-mono text-[11px] text-zinc-350 break-all select-all flex items-start justify-between gap-2">
                  <span>{address}</span>
                  <button 
                    onClick={copyAddress}
                    className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded transition flex-shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                
                {network === 'testnet' && balances.xlm === 0 && (
                  <div className="mt-4 border border-indigo-500/20 bg-indigo-500/5 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-zinc-450 leading-relaxed mb-2.5">
                      Your testnet account is currently empty. Get free testnet XLM to pay for on-chain network fees.
                    </p>
                    <button
                      onClick={handleFriendbotFund}
                      disabled={funding}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-755 text-white font-bold rounded-lg text-[10px] transition"
                    >
                      {funding ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Funding Account...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-yellow-350" />
                          <span>Fund Account (10k XLM)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Sub-menu navigation links */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-2.5 shadow-lg backdrop-blur-md flex flex-row md:flex-col gap-1.5">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-850'}`}
                >
                  <Wallet className="w-4 h-4" />
                  <span className="hidden md:inline">Dashboard</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('send')}
                  className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${activeTab === 'send' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-850'}`}
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden md:inline">Send Assets</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('receive')}
                  className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${activeTab === 'receive' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-850'}`}
                >
                  <QrCode className="w-4 h-4" />
                  <span className="hidden md:inline">Receive Assets</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('activity')}
                  className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${activeTab === 'activity' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-850'}`}
                >
                  <History className="w-4 h-4" />
                  <span className="hidden md:inline">Activity History</span>
                </button>
              </div>

            </div>

            {/* RIGHT SUB-PAGE VIEWS */}
            <div className="md:col-span-2 space-y-6">
              
              {/* TAB 1: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  
                  {/* Balance Display */}
                  <div className="bg-zinc-900/80 border border-zinc-855 rounded-2xl p-6 md:p-8 shadow-lg relative overflow-hidden backdrop-blur-md">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-2xl pointer-events-none rounded-full" />
                    
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                      Total Estimated Value
                    </span>
                    
                    <div className="flex items-baseline gap-2 mb-6">
                      <span className="text-4xl md:text-5xl font-black font-mono tracking-tight text-white bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                        ${balances.usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-lg font-bold text-zinc-400">USD</span>
                    </div>

                    <div className="border-t border-zinc-850 pt-6 grid grid-cols-2 gap-4">
                      {/* Stellar (XLM) Balance */}
                      <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 flex flex-col">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">
                          Stellar Native (XLM)
                        </span>
                        <span className="text-lg font-extrabold font-mono text-white mb-0.5">
                          {balances.xlm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })}
                        </span>
                        <span className="text-xs text-zinc-500 font-semibold">
                          ≈ ${balances.usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </span>
                      </div>
                      
                      {/* USDC Balance */}
                      <div className="bg-zinc-955 p-4 rounded-xl border border-zinc-850 flex flex-col">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">
                          USD Coin (USDC)
                        </span>
                        <span className="text-lg font-extrabold font-mono text-white mb-0.5">
                          {balances.usdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-zinc-500 font-semibold">
                          ≈ ${(balances.usdc * 1.0).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 flex gap-3">
                      <button
                        onClick={() => setActiveTab('send')}
                        className="flex-1 flex items-center justify-center gap-2 h-11 bg-indigo-650 hover:bg-indigo-750 text-white font-bold rounded-xl text-xs transition duration-200 shadow-md shadow-indigo-650/15"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        <span>Send Assets</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('receive')}
                        className="flex-1 flex items-center justify-center gap-2 h-11 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 font-bold rounded-xl text-xs transition duration-200"
                      >
                        <ArrowDownLeft className="w-4 h-4" />
                        <span>Receive Assets</span>
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: SEND ASSETS */}
              {activeTab === 'send' && (
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-lg backdrop-blur-md">
                  <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
                    <Send className="w-4 h-4 text-indigo-400" />
                    <span>Send Payment</span>
                  </h3>
                  
                  <form onSubmit={handleSendPayment} className="space-y-4">
                    {/* Asset Selection */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Asset Type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSendAsset('XLM')}
                          className={`py-2 px-4 rounded-lg text-xs font-bold border transition ${sendAsset === 'XLM' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-zinc-950 border-zinc-850 text-zinc-450 hover:bg-zinc-900'}`}
                        >
                          XLM (Native)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSendAsset('USDC')}
                          className={`py-2 px-4 rounded-lg text-xs font-bold border transition ${sendAsset === 'USDC' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-zinc-950 border-zinc-850 text-zinc-450 hover:bg-zinc-900'}`}
                        >
                          USDC (Stellar Trustline)
                        </button>
                      </div>
                    </div>

                    {/* Destination Address */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Recipient Address
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. G..."
                        value={sendDest}
                        onChange={(e) => setSendDest(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 rounded-lg p-2.5 text-xs text-white font-mono placeholder-zinc-650 outline-none transition"
                        disabled={sending}
                      />
                    </div>

                    {/* Amount */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex justify-between">
                        <span>Amount</span>
                        <span className="text-zinc-600">
                          Max Available: {sendAsset === 'XLM' ? balances.xlm : balances.usdc} {sendAsset}
                        </span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-855 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 rounded-lg p-2.5 text-xs text-white font-mono placeholder-zinc-655 outline-none transition"
                        disabled={sending}
                      />
                    </div>

                    {/* Memo */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Memo (Optional)
                      </label>
                      <input
                        type="text"
                        maxLength={28}
                        placeholder="Text memo (max 28 chars)"
                        value={sendMemo}
                        onChange={(e) => setSendMemo(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 rounded-lg p-2.5 text-xs text-white placeholder-zinc-650 outline-none transition"
                        disabled={sending}
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={sending}
                      className="w-full flex items-center justify-center gap-2 h-11 bg-indigo-650 hover:bg-indigo-750 text-white font-bold rounded-lg text-xs transition duration-200 shadow-md shadow-indigo-650/15"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending Payment...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit Payment</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 3: RECEIVE ASSETS */}
              {activeTab === 'receive' && (
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-lg backdrop-blur-md text-center">
                  <h3 className="text-md font-bold text-white mb-5 flex items-center justify-center gap-2">
                    <QrCode className="w-4 h-4 text-indigo-400" />
                    <span>Receive Payments</span>
                  </h3>
                  
                  {/* QR Code Container */}
                  <div className="bg-white p-4 inline-block rounded-2xl border border-zinc-200 mb-6 shadow-md shadow-zinc-900/20">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(address || '')}`} 
                      alt="Wallet Address QR Code"
                      className="w-[180px] h-[180px] object-contain"
                    />
                  </div>

                  <p className="text-xs text-zinc-400 mb-3 px-8 leading-relaxed">
                    Scan this QR code or copy the address below to receive native XLM or trustline-enabled USDC payments from any Stellar wallet.
                  </p>

                  <div className="max-w-md mx-auto bg-zinc-955 border border-zinc-850 p-3 rounded-xl flex items-center justify-between gap-3 font-mono text-[11px] text-zinc-300 break-all select-all">
                    <span>{address}</span>
                    <button 
                      onClick={copyAddress}
                      className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-450 hover:text-white rounded transition flex-shrink-0"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: ACTIVITY HISTORY */}
              {activeTab === 'activity' && (
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-lg backdrop-blur-md">
                  <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-400" />
                    <span>Activity History</span>
                  </h3>

                  {loadingActivity ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                      <p className="text-xs text-zinc-500 animate-pulse">Loading transaction logs...</p>
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500 text-xs">
                      No recent transaction history recorded on this network.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((tx) => (
                        <div 
                          key={tx.id}
                          className="bg-zinc-950 border border-zinc-850 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-zinc-800 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === 'received' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-450 border border-rose-500/20'}`}>
                              {tx.type === 'received' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white capitalize">
                                {tx.type === 'received' ? 'Received Payment' : 'Sent Payment'}
                              </p>
                              <p className="text-[10px] text-zinc-550 font-mono mt-0.5">
                                {tx.type === 'received' ? 'From: ' : 'To: '}
                                {tx.counterparty && tx.counterparty.length > 16 
                                  ? `${tx.counterparty.slice(0, 8)}...${tx.counterparty.slice(-8)}`
                                  : (tx.counterparty || 'Unknown')}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className={`text-xs font-black font-mono ${tx.type === 'received' ? 'text-emerald-400' : 'text-zinc-200'}`}>
                              {tx.type === 'received' ? '+' : '-'}{parseFloat(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM
                            </p>
                            <p className="text-[9px] text-zinc-555 mt-0.5">
                              {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>
        )}

      </div>

      <WalletConnectionModal 
        isOpen={isWalletModalOpen} 
        onClose={() => setIsWalletModalOpen(false)} 
      />
    </div>
  );
}
