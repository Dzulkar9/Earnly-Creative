'use client';

import { useState, useCallback, useEffect } from 'react';
import { Lock, Wallet, AlertCircle, Sparkles, Copy, Check, Eye, EyeOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GeneratedKeypair {
  publicKey: string;
  secretKey: string;
  funded: boolean;
}

interface WalletConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletConnectionModal({ isOpen, onClose }: WalletConnectionModalProps) {
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSecretKeyForm, setShowSecretKeyForm] = useState(false);
  const [generatedKeypair, setGeneratedKeypair] = useState<GeneratedKeypair | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  // Esc/click outside handling
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      alert('Copied to clipboard!');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      alert('Failed to copy to clipboard');
    }
  }, []);

  // Generate new testnet keypair
  const generateTestnetKeypair = useCallback(async () => {
    try {
      setIsGenerating(true);
      setGeneratedKeypair(null);

      const { Keypair } = await import('@stellar/stellar-sdk');
      const keypair = Keypair.random();
      const publicKey = keypair.publicKey();
      const secretKey = keypair.secret();

      setGeneratedKeypair({ publicKey, secretKey, funded: false });

      // Fund via Friendbot
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
      );

      if (!response.ok) {
        throw new Error('Friendbot funding failed. Try again later.');
      }

      setGeneratedKeypair({ publicKey, secretKey, funded: true });
      alert('Testnet account created & funded with 10,000 XLM successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate keypair';
      alert(message);
      console.error('Keypair generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // Connect with generated keypair
  const connectWithGenerated = useCallback(() => {
    if (!generatedKeypair) return;
    localStorage.setItem('earnly_wallet_address', generatedKeypair.publicKey);
    localStorage.setItem('earnly_wallet_type', 'manual');
    localStorage.setItem('earnly_secret_key', generatedKeypair.secretKey);
    
    window.dispatchEvent(new Event('walletChange'));
    setGeneratedKeypair(null);
    alert('Wallet connected successfully!');
    onClose();
  }, [generatedKeypair, onClose]);

  // Connect with StellarWalletsKit
  const connectStellarWallet = useCallback(async () => {
    try {
      setIsLoading(true);

      const { StellarWalletsKit, Networks } = await import('@creit.tech/stellar-wallets-kit');
      const { defaultModules } = await import('@creit.tech/stellar-wallets-kit/modules/utils');
      
      const activeNet = localStorage.getItem('earnly_network') || 'simulation';
      
      try {
        StellarWalletsKit.init({
          modules: defaultModules(),
          network: activeNet === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,
        });
      } catch {
        // Safe to ignore if already initialized
      }

      const { address } = await StellarWalletsKit.authModal();

      if (address) {
        localStorage.setItem('earnly_wallet_address', address);
        localStorage.setItem('earnly_wallet_type', 'kit');
        localStorage.removeItem('earnly_secret_key');
        
        window.dispatchEvent(new Event('walletChange'));
        alert('Wallet connected successfully!');
        onClose();
      }
    } catch (err) {
      const errMessage = (err && typeof err === 'object' && 'message' in err) ? String((err as Record<string, unknown>).message) : '';
      if (errMessage === 'The user closed the modal.') {
        return;
      }
      const message = err instanceof Error ? err.message : (errMessage || 'Failed to connect wallet');
      alert(message);
      console.error('StellarWalletsKit connection error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [onClose]);

  // Manual secret key connection
  const connectWithSecretKey = useCallback(async () => {
    try {
      setIsLoading(true);

      if (!secretKeyInput.trim()) {
        alert('Please enter a secret key');
        return;
      }

      const { StrKey, Keypair } = await import('@stellar/stellar-sdk');

      if (!StrKey.isValidEd25519SecretSeed(secretKeyInput.trim())) {
        alert('Invalid secret key format. Please enter a valid Stellar secret key.');
        return;
      }

      const keypair = Keypair.fromSecret(secretKeyInput.trim());
      const publicKey = keypair.publicKey();

      localStorage.setItem('earnly_wallet_address', publicKey);
      localStorage.setItem('earnly_wallet_type', 'manual');
      localStorage.setItem('earnly_secret_key', secretKeyInput.trim());
      
      window.dispatchEvent(new Event('walletChange'));
      setSecretKeyInput('');
      setShowSecretKeyForm(false);
      alert('Wallet connected successfully!');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      alert(message);
      console.error('Secret key connection error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [secretKeyInput, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 overflow-hidden"
          >
            {/* Background Glows */}
            <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-48 h-48 rounded-full bg-teal-500/5 blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-400" />
                Connect Your Wallet
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Generated Keypair Screen */}
            {generatedKeypair ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                  <Sparkles className="h-4 w-4" />
                  <span>Testnet Account Generated!</span>
                </div>

                {/* Public Key */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Public Key (Address)
                  </label>
                  <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                    <code className="flex-1 text-xs font-mono text-zinc-300 break-all select-all pr-2">
                      {generatedKeypair.publicKey}
                    </code>
                    <button
                      className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded"
                      onClick={() => copyToClipboard(generatedKeypair.publicKey, 'public')}
                    >
                      {copiedField === 'public' ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Secret Key */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Secret Key
                  </label>
                  <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                    <code className="flex-1 text-xs font-mono text-zinc-300 break-all select-all pr-2">
                      {showSecret ? generatedKeypair.secretKey : 'S' + '•'.repeat(54)}
                    </code>
                    <button
                      className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded"
                      onClick={() => copyToClipboard(generatedKeypair.secretKey, 'secret')}
                    >
                      {copiedField === 'secret' ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 text-xs py-1">
                  {generatedKeypair.funded ? (
                    <>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="text-emerald-400 font-semibold">
                        Funded successfully with 10,000 XLM (Testnet)
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                      <span className="text-amber-400 font-semibold animate-pulse">
                        Funding account via Friendbot...
                      </span>
                    </>
                  )}
                </div>

                {/* Safety Warning */}
                <div className="bg-amber-950/20 border border-amber-900/30 p-3 rounded-lg flex items-start gap-2 text-xs text-amber-200/80">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <p>
                    <strong>Save your secret key!</strong> It will not be shown again. You need this to import this account on other platforms or browsers.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={connectWithGenerated}
                    disabled={!generatedKeypair.funded}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatedKeypair.funded ? 'Connect Wallet' : 'Waiting for Funding...'}
                  </button>
                  <button
                    onClick={() => setGeneratedKeypair(null)}
                    className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold py-2.5 px-4 rounded-xl text-sm transition"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Generate Keypair - Primary/Easiest Option */}
                <button
                  onClick={generateTestnetKeypair}
                  disabled={isGenerating || isLoading}
                  className="w-full flex items-center justify-between bg-gradient-to-r from-emerald-600/10 to-teal-600/10 hover:from-emerald-600/20 hover:to-teal-600/20 border border-emerald-500/20 hover:border-emerald-500/40 p-4 rounded-xl text-left transition duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Generate Testnet Account</h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Create keypair & fund with 10k free testnet XLM
                      </p>
                    </div>
                  </div>
                </button>

                {/* 2. Connect via Web3 Wallet (StellarWalletsKit) */}
                <button
                  onClick={connectStellarWallet}
                  disabled={isGenerating || isLoading}
                  className="w-full flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 hover:border-indigo-500/30 p-4 rounded-xl text-left transition duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400 shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Connect Web3 Wallet</h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Freighter, xBull, Lobstr, Hana, Albedo
                      </p>
                    </div>
                  </div>
                </button>

                {/* 3. Import Secret Key */}
                {!showSecretKeyForm ? (
                  <button
                    onClick={() => setShowSecretKeyForm(true)}
                    disabled={isGenerating || isLoading}
                    className="w-full flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 p-4 rounded-xl text-left transition duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-800/40 flex items-center justify-center text-zinc-400 shrink-0">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Import Secret Key</h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Paste your existing Stellar secret key
                        </p>
                      </div>
                    </div>
                  </button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-zinc-900 border border-zinc-850 p-4 rounded-xl space-y-3"
                  >
                    <h4 className="text-xs font-bold text-zinc-300">Enter Secret Key (starts with S)</h4>
                    <input
                      type="password"
                      placeholder="SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                      value={secretKeyInput}
                      onChange={(e) => setSecretKeyInput(e.target.value)}
                      disabled={isLoading}
                      className="w-full bg-zinc-900 border border-zinc-800 text-white font-mono text-xs rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 transition"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={connectWithSecretKey}
                        disabled={isLoading}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition"
                      >
                        {isLoading ? 'Connecting...' : 'Connect'}
                      </button>
                      <button
                        onClick={() => {
                          setShowSecretKeyForm(false);
                          setSecretKeyInput('');
                        }}
                        disabled={isLoading}
                        className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold py-2 px-3 rounded-lg text-xs transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Footer Disclaimer */}
                <p className="text-[10px] text-zinc-500 text-center mt-2 leading-relaxed">
                  By connecting your wallet, you consent to off-chain caching of on-chain states and agree to terms.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
