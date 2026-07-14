'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  getMockBalances, 
  resetMockBalances,
  DEFAULT_BALANCES,
  getWalletBalances,
  getNetwork,
  setNetwork,
  NetworkType,
  getXlmPriceInUsd
} from '@/lib/stellar';
import { Wallet, RefreshCw, Check, Info, Coins, Menu, X, Sun, Moon, Bell, MessageSquare, Send, Loader2, ShoppingBag, ChevronLeft } from 'lucide-react';
import { 
  getNotifications, 
  markAllNotificationsAsRead, 
  clearNotifications, 
  NotificationItem 
} from '@/lib/notifications';
import { motion, AnimatePresence } from 'framer-motion';
import WalletConnectionModal from './WalletConnectionModal';

export default function Header() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('earnly_theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || 'dark';
    setTheme(initialTheme);
    if (initialTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('earnly_theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetworkState] = useState<NetworkType>('simulation');
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [walletDetails, setWalletDetails] = useState<{ xlm: number; usdc: number } | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileConnectOpen, setMobileConnectOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletTypeState, setWalletTypeState] = useState<string>('freighter');
  const [xlmPrice, setXlmPrice] = useState<number>(0.11);

  // Notifications states
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; title: string; type: string }>>([]);

  // Chat States
  const [chatOpen, setChatOpen] = useState(false);
  const [chats, setChats] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatsLoading, setChatsLoading] = useState(true);
  const [selectedBuyer, setSelectedBuyer] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [lastReadTime, setLastReadTime] = useState<number>(0);

  const getMyAddress = () => {
    if (address) return address;
    if (typeof window !== 'undefined') {
      let guestAddr = localStorage.getItem('earnly_guest_chat_address');
      if (!guestAddr) {
        guestAddr = `Guest_${Math.random().toString(36).substring(2, 6)}`;
        localStorage.setItem('earnly_guest_chat_address', guestAddr);
      }
      return guestAddr;
    }
    return '';
  };

  const fetchChats = async () => {
    const userAddr = getMyAddress();
    if (!userAddr) return;
    try {
      const res = await fetch(`/api/chats?address=${userAddr}`);
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch (err) {
      console.error('Error fetching global chats:', err);
    } finally {
      setChatsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLastReadTime(Number(localStorage.getItem('earnly_last_chat_read_time') || 0));
    }
  }, [chatOpen]);

  const getUnreadChatCount = () => {
    const myAddr = getMyAddress().toLowerCase();
    return chats.filter(
      c => c.sender && c.sender.toLowerCase() !== myAddr && new Date(c.timestamp).getTime() > lastReadTime
    ).length;
  };

  const toggleChatConsole = () => {
    const nextState = !chatOpen;
    setChatOpen(nextState);
    if (nextState) {
      const now = Date.now();
      setLastReadTime(now);
      localStorage.setItem('earnly_last_chat_read_time', String(now));
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || selectedProjectId === null || !selectedBuyer) return;

    const myAddress = getMyAddress();
    const activeThread = chats.find(c => c.projectId === selectedProjectId && c.buyerAddress === selectedBuyer);
    const creatorAddress = activeThread?.projectDetails?.creatorAddress || '';
    const isCreator = myAddress.toLowerCase() === creatorAddress.toLowerCase();

    const originalInput = chatInput;
    setChatInput('');

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: myAddress,
          message: originalInput,
          isCreator,
          buyerAddress: selectedBuyer
        })
      });

      if (res.ok) {
        fetchChats();
      } else {
        setChatInput(originalInput);
        alert('Failed to send message.');
      }
    } catch (err) {
      setChatInput(originalInput);
      console.error('Error sending message:', err);
    }
  };

  const getInboxThreads = () => {
    const threadsMap: Record<string, {
      projectId: number;
      buyerAddress: string;
      lastMessage: any;
      projectDetails: any;
    }> = {};

    chats.forEach((chat) => {
      if (!chat.buyerAddress) return;
      const key = `${chat.projectId}-${chat.buyerAddress}`;
      if (!threadsMap[key] || new Date(chat.timestamp) > new Date(threadsMap[key].lastMessage.timestamp)) {
        threadsMap[key] = {
          projectId: chat.projectId,
          buyerAddress: chat.buyerAddress,
          lastMessage: chat,
          projectDetails: chat.projectDetails
        };
      }
    });

    return Object.values(threadsMap).sort(
      (a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
    );
  };

  useEffect(() => {
    fetchChats();
    const interval = setInterval(fetchChats, 5000);
    return () => clearInterval(interval);
  }, [address]);

  useEffect(() => {
    const handleOpenGlobalChat = (e: Event) => {
      const customEvent = e as CustomEvent<{ projectId: number; buyerAddress: string }>;
      const { projectId, buyerAddress } = customEvent.detail;
      
      setSelectedProjectId(projectId);
      setSelectedBuyer(buyerAddress);
      setChatOpen(true);
      
      const now = Date.now();
      setLastReadTime(now);
      localStorage.setItem('earnly_last_chat_read_time', String(now));
    };

    window.addEventListener('openGlobalChat', handleOpenGlobalChat);
    return () => window.removeEventListener('openGlobalChat', handleOpenGlobalChat);
  }, []);

  const fetchWalletDetails = async (addr: string | null) => {
    if (!addr) return;
    try {
      setLoadingBalance(true);
      const details = await getWalletBalances(addr);
      setWalletDetails(details);
      if (details && details.xlm > 0) {
        setXlmPrice(details.usdc / details.xlm);
      }
    } catch (err) {
      console.error('Error loading wallet details in header:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    // Initial load
    const activeNet = getNetwork();
    setNetworkState(activeNet);
    
    const savedAddr = localStorage.getItem('earnly_wallet_address');
    if (savedAddr) {
      setAddress(savedAddr);
      fetchWalletDetails(savedAddr);
    }

    const loadPrice = async () => {
      try {
        const livePrice = await getXlmPriceInUsd();
        setXlmPrice(livePrice);
      } catch {}
    };
    loadPrice();
    
    const savedType = localStorage.getItem('earnly_wallet_type') || 'freighter';
    setWalletTypeState(savedType);

    const initBalances = async () => {
      const mockBals = await getMockBalances();
      setBalances(mockBals);
    };
    initBalances();

    // Load initial notifications
    const allNotifs = getNotifications();
    setNotifications(allNotifs);
    setUnreadCount(allNotifs.filter(n => !n.read).length);

    // Custom event listener for new notifications
    const handleNewNotif = (e: Event) => {
      const customEvent = e as CustomEvent<NotificationItem>;
      const notif = customEvent.detail;
      
      // Update notifications list
      setNotifications(prev => [notif, ...prev.slice(0, 49)]);
      setUnreadCount(prev => prev + 1);

      // Add floating toast
      const toastId = Math.random().toString();
      setToasts(prev => [...prev, {
        id: toastId,
        title: notif.type.toUpperCase().replace('_', ' '),
        message: notif.message,
        type: notif.type
      }]);

      // Remove toast after 5 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);
    };

    const handleNotifsUpdated = () => {
      const allNotifs = getNotifications();
      setNotifications(allNotifs);
      setUnreadCount(allNotifs.filter(n => !n.read).length);
    };

    const handleWalletChange = () => {
      const savedAddr = localStorage.getItem('earnly_wallet_address');
      setAddress(savedAddr);
      const savedType = localStorage.getItem('earnly_wallet_type') || 'freighter';
      setWalletTypeState(savedType);
      if (savedAddr) {
        fetchWalletDetails(savedAddr);
      } else {
        setWalletDetails(null);
      }
    };

    window.addEventListener('earnly_new_notification', handleNewNotif);
    window.addEventListener('earnly_notifications_updated', handleNotifsUpdated);
    window.addEventListener('walletChange', handleWalletChange);

    return () => {
      window.removeEventListener('earnly_new_notification', handleNewNotif);
      window.removeEventListener('earnly_notifications_updated', handleNotifsUpdated);
      window.removeEventListener('walletChange', handleWalletChange);
    };
  }, []);

  const handleNetworkConnect = async (net: NetworkType) => {
    setNetwork(net);
    setNetworkState(net);
    
    if (net !== 'simulation') {
      localStorage.setItem('earnly_network', net);
      // Disconnect active wallet first to avoid wrong addresses across networks
      setAddress(null);
      localStorage.removeItem('earnly_wallet_address');
      localStorage.removeItem('earnly_wallet_type');
      localStorage.removeItem('earnly_secret_key');
      setDropdownOpen(false);
      setIsWalletModalOpen(true);
    } else {
      const defaultAddr = 'GB_CONTRIBUTOR_1_STW_NORTHGATE';
      setAddress(defaultAddr);
      localStorage.setItem('earnly_wallet_address', defaultAddr);
      localStorage.setItem('earnly_wallet_type', 'simulation');
      fetchWalletDetails(defaultAddr);
      setDropdownOpen(false);
      window.location.reload();
    }
  };

  const handleNetworkChange = async (net: NetworkType) => {
    setNetwork(net);
    setNetworkState(net);
    if (net !== 'simulation') {
      localStorage.setItem('earnly_network', net);
      setAddress(null);
      localStorage.removeItem('earnly_wallet_address');
      localStorage.removeItem('earnly_wallet_type');
      localStorage.removeItem('earnly_secret_key');
      setDropdownOpen(false);
      setIsWalletModalOpen(true);
    } else {
      const defaultAddr = 'GB_CONTRIBUTOR_1_STW_NORTHGATE';
      setAddress(defaultAddr);
      localStorage.setItem('earnly_wallet_address', defaultAddr);
      localStorage.setItem('earnly_wallet_type', 'simulation');
      window.location.reload();
    }
  };


  const handleConnectClick = () => {
    const net = getNetwork();
    if (net !== 'simulation') {
      setIsWalletModalOpen(true);
    } else {
      toggleDropdown();
    }
  };

  const selectMockWallet = (addr: string) => {
    setAddress(addr);
    localStorage.setItem('earnly_wallet_address', addr);
    setDropdownOpen(false);
    window.dispatchEvent(new Event('walletChange')); // Notify pages
    fetchWalletDetails(addr);
  };

  const handleResetBalances = async () => {
    resetMockBalances();
    const mockBals = await getMockBalances();
    setBalances(mockBals);
    window.dispatchEvent(new Event('walletChange'));
    if (address) fetchWalletDetails(address);
  };

  const toggleDropdown = () => {
    const nextState = !dropdownOpen;
    setDropdownOpen(nextState);
    if (nextState && address) {
      fetchWalletDetails(address);
    }
  };

  const getFriendlyName = (addr: string | null) => {
    if (!addr) return 'Not Connected';
    if (addr === 'GB_CREATOR_ADDRESS_STW_NORTHGATE') return 'Creator (GB_CREATOR)';
    if (addr === 'GB_CONTRIBUTOR_1_STW_NORTHGATE') return 'Backer 1 (GB_BACKER_1)';
    if (addr === 'GB_CONTRIBUTOR_2_STW_NORTHGATE') return 'Backer 2 (GB_BACKER_2)';
    if (addr === 'GB_GUEST_ADDRESS_STW_NORTHGATE') return 'Guest (GB_GUEST)';
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full glass-nav px-3 sm:px-4 md:px-8 py-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 font-bold text-lg sm:text-xl tracking-tight text-white hover:opacity-95 transition flex-shrink-0">
          <img 
            src={theme === 'dark' ? "/Logo.png" : "/Logo2.png"} 
            alt="Earnly Logo" 
            className="w-7 h-7 sm:w-8 sm:h-8 object-contain hover:scale-105 transition duration-300" 
          />
          <span className="hidden sm:inline">Earnly <span className="text-indigo-400">Creative</span></span>
          <span className="sm:hidden text-sm">Earnly <span className="text-indigo-400">Creative</span></span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === '/' 
                ? 'bg-zinc-800 text-white' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/projects"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === '/projects' || pathname?.startsWith('/project/')
                ? 'bg-zinc-800 text-white' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            Explore Projects
          </Link>
          <Link
            href="/create"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === '/create' 
                ? 'bg-zinc-800 text-white' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            Start Project
          </Link>
          <Link
            href="/profile"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === '/profile' || pathname?.startsWith('/profile/')
                ? 'bg-zinc-800 text-white' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            My Profile
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition flex items-center justify-center shrink-0"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition duration-300" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-400 hover:-rotate-12 transition duration-300" />
          )}
        </button>

        {/* Notification Bell Button */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              setDropdownOpen(false);
              if (!notifOpen) {
                // When opening, mark notifications as read after a short delay
                setTimeout(() => {
                  markAllNotificationsAsRead();
                  setUnreadCount(0);
                }, 1000);
              }
            }}
            className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition flex items-center justify-center shrink-0 relative animate-reveal-up"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {address && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border border-zinc-950 animate-pulse font-mono">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="fixed right-2 left-2 sm:left-auto sm:absolute sm:right-0 mt-2 w-80 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-4 flex flex-col gap-3 z-50 animate-reveal-up max-h-[80vh]">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <Bell className="w-3.5 h-3.5 text-indigo-400" /> Notifications
                </h4>
                {address && notifications.length > 0 && (
                  <button
                    onClick={() => {
                      clearNotifications();
                      setNotifications([]);
                      setUnreadCount(0);
                    }}
                    className="text-[10px] text-zinc-500 hover:text-rose-400 transition font-bold"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto max-h-[40vh] no-scrollbar">
                {!address ? (
                  <div className="text-center py-8 text-zinc-500 text-xs font-medium font-sans flex flex-col items-center gap-2">
                    <Info className="w-5 h-5 text-zinc-650" />
                    Connect your wallet to see recent alerts.
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-6 text-zinc-500 text-xs font-medium font-sans">
                    No transactions or alerts recorded.
                  </div>
                ) : (
                  notifications.slice(0, 5).map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 rounded-lg border text-xs flex flex-col gap-1 transition ${
                        notif.read
                          ? 'bg-zinc-950/20 border-zinc-850 text-zinc-500'
                          : 'bg-indigo-950/10 border-indigo-500/20 text-zinc-200'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-indigo-400 font-mono">
                          {notif.type.replace('_', ' ')}
                        </span>
                        <span className="text-[9px] text-zinc-500 font-mono">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="leading-relaxed font-sans text-left">{notif.message}</p>
                      {notif.amount !== undefined && notif.amount > 0 && (
                        <div className="flex items-center gap-2 text-[10px] font-mono font-bold">
                          <span className="text-zinc-400">{notif.amount.toFixed(2)} USDC</span>
                          {notif.xlmAmount !== undefined && notif.xlmAmount > 0 && (
                            <>
                              <span className="text-zinc-600">→</span>
                              <span className="text-indigo-400">{notif.xlmAmount.toFixed(2)} XLM</span>
                            </>
                          )}
                        </div>
                      )}
                      <span className="text-[9px] text-zinc-500 font-mono truncate text-left">
                        Project: {notif.projectTitle}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {address && notifications.length > 0 && (
                <div className="pt-2 border-t border-zinc-850/60 mt-1 flex justify-center">
                  <Link
                    href="/profile?tab=transaction-history"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-indigo-950/20 w-full justify-center"
                  >
                    View All Transactions
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Icon Button */}
        <button
          onClick={toggleChatConsole}
          className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition flex items-center justify-center shrink-0 relative animate-reveal-up"
          title="Chat Console"
        >
          <MessageSquare className="w-4 h-4" />
          {getUnreadChatCount() > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border border-zinc-950 animate-pulse font-mono bg-indigo-600">
              {getUnreadChatCount()}
            </span>
          )}
        </button>

        {/* Account Details & Switcher */}
        <div className="relative">
          {address ? (
            <button
              onClick={toggleDropdown}
              className="flex items-center gap-1 sm:gap-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs md:text-sm text-zinc-200 transition"
            >
              <Wallet className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="max-w-[60px] sm:max-w-[140px] truncate">{getFriendlyName(address)}</span>
              {network === 'simulation' ? (
                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] px-1.5 py-0.2 rounded font-mono">SIM</span>
              ) : network === 'testnet' ? (
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] px-1.5 py-0.2 rounded font-mono">TEST</span>
              ) : (
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-1.5 py-0.2 rounded font-mono">MAIN</span>
              )}
            </button>
          ) : (
            <button
              onClick={handleConnectClick}
              className="flex items-center gap-1.5 bg-indigo-650 hover:bg-indigo-750 border border-indigo-500/20 px-4 py-2 rounded-lg text-xs md:text-sm font-semibold text-white transition glow-primary"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Connect Wallet</span>
            </button>
          )}

          {dropdownOpen && (
            <div className="fixed right-2 left-2 sm:left-auto sm:absolute sm:right-0 mt-2 sm:w-80 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-4 flex flex-col gap-3 z-50 animate-reveal-up max-h-[80vh] overflow-y-auto">
              {!address ? (
                /* Connect network options popup */
                <>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    Select Network
                  </h4>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleNetworkConnect('testnet')}
                      className="flex items-center gap-3 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 p-3 rounded-xl text-xs font-semibold text-zinc-200 transition text-left"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                      <div className="flex flex-col min-w-0">
                        <span>Connect Testnet</span>
                        <span className="text-[10px] text-zinc-500 font-normal">Stellar Testnet (Freighter)</span>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => handleNetworkConnect('mainnet')}
                      className="flex items-center gap-3 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 p-3 rounded-xl text-xs font-semibold text-zinc-200 transition text-left"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                      <div className="flex flex-col min-w-0">
                        <span>Connect Mainnet</span>
                        <span className="text-[10px] text-zinc-500 font-normal">Stellar Mainnet (Freighter)</span>
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                /* Connected wallet details, balance details, reset balances, disconnect */
                <>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                      Current Wallet Account
                    </h4>
                    <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 text-xs font-mono text-zinc-300 break-all mb-1">
                      {address}
                    </div>
                  </div>

                  {/* Wallet Balances Card */}
                  <div className="bg-zinc-950/80 border border-zinc-850 rounded-xl p-3.5 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs border-b border-zinc-900 pb-2">
                      <span className="text-zinc-500 font-semibold uppercase flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5 text-indigo-400" /> Wallet Assets
                      </span>
                      <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded font-mono">
                        {network.toUpperCase()}
                      </span>
                    </div>
                    
                    {loadingBalance ? (
                      <div className="flex items-center justify-center py-4 gap-2 text-zinc-550 text-xs">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading balances...
                      </div>
                    ) : walletDetails ? (
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="text-xs text-zinc-350 font-bold">Stellar (XLM)</span>
                          </div>
                          <span className="text-xs text-white font-mono font-bold">{walletDetails.xlm} XLM</span>
                        </div>
                        
                        <div className="flex items-center justify-between border-t border-zinc-900/40 pt-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-xs text-zinc-350 font-bold">USD Coin (USDC)</span>
                          </div>
                          <span className="text-xs text-emerald-400 font-mono font-bold">${walletDetails.usdc} USDC</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                            <span className="text-xs text-zinc-350 font-bold">Tether (USDT)</span>
                          </div>
                          <span className="text-xs text-teal-400 font-mono font-bold">${walletDetails.usdc} USDT</span>
                        </div>

                        <div className="text-[9px] text-zinc-555 border-t border-zinc-900/60 pt-2 flex items-center justify-between font-mono">
                          <span>Rate: 1 XLM ≈ {xlmPrice.toFixed(4)} USD</span>
                          <span>Fee: 0 XLM (Free)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-zinc-550 text-xs py-2 text-center">No balance data available</div>
                    )}
                  </div>

                  {network === 'simulation' ? (
                    <>
                      <div className="border-t border-zinc-800 my-1"></div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                            Switch Simulation Account
                          </h4>
                          <button 
                            onClick={handleResetBalances}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
                            title="Reset Balances"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Reset
                          </button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {Object.keys(DEFAULT_BALANCES).map((walletAddr) => (
                            <button
                              key={walletAddr}
                              onClick={() => selectMockWallet(walletAddr)}
                              className={`flex items-center justify-between text-left p-2 rounded-lg text-xs transition ${
                                address === walletAddr 
                                  ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-300' 
                                  : 'bg-zinc-950/40 border border-transparent hover:border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-semibold text-zinc-300">
                                  {walletAddr === 'GB_CREATOR_ADDRESS_STW_NORTHGATE' ? 'Compliance Creator' :
                                   walletAddr === 'GB_CONTRIBUTOR_1_STW_NORTHGATE' ? 'Honored Backer 1' :
                                   walletAddr === 'GB_CONTRIBUTOR_2_STW_NORTHGATE' ? 'Honored Backer 2' : 'External Guest'}
                                </span>
                                <span className="text-[10px] opacity-60 font-mono">{walletAddr.slice(0, 8)}...</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-zinc-300">{(balances[walletAddr] ?? 0).toFixed(2)} USDC</span>
                                {address === walletAddr && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2 text-xs text-zinc-400">
                      <div className="flex items-start gap-2 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80">
                        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <p>
                          Connected to <strong>Stellar {network === 'mainnet' ? 'Mainnet' : 'Testnet'}</strong> via {
                            walletTypeState === 'manual' ? 'Secret Key import' :
                            walletTypeState === 'kit' ? 'Wallets Kit' : 'Freighter wallet'
                          }.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-zinc-850/60 my-1"></div>

                  {/* Switch network and disconnect buttons */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase px-1">Switch Network</span>
                    <div className="grid grid-cols-2 gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-900 text-xs">
                      <button
                        onClick={() => handleNetworkChange('testnet')}
                        className={`py-1 rounded text-center font-semibold transition ${
                          network === 'testnet' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : 'text-zinc-550 hover:text-zinc-300'
                        }`}
                      >
                        Testnet
                      </button>
                      <button
                        onClick={() => handleNetworkChange('mainnet')}
                        className={`py-1 rounded text-center font-semibold transition ${
                          network === 'mainnet' ? 'bg-indigo-650/20 text-indigo-400 border border-indigo-500/20' : 'text-zinc-550 hover:text-zinc-300'
                        }`}
                      >
                        Mainnet
                      </button>
                    </div>

                    <Link
                      href="/wallet"
                      onClick={() => setDropdownOpen(false)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2.5 rounded-lg text-xs mt-3 mb-1.5 transition text-center flex items-center justify-center gap-1.5 shadow-md shadow-indigo-650/15"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Lihat Lumen Wallet</span>
                    </Link>

                    <button
                      onClick={() => {
                        setAddress(null);
                        localStorage.removeItem('earnly_wallet_address');
                        setNetwork('simulation');
                        setDropdownOpen(false);
                        window.location.reload();
                      }}
                      className="w-full bg-zinc-950 hover:bg-zinc-800/60 border border-zinc-850 text-rose-450 hover:text-rose-450 font-bold p-2.5 rounded-lg text-xs mt-1 transition text-center"
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Hamburger Menu Button (Mobile only) */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white md:hidden transition"
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-zinc-950 border-b border-zinc-900 p-4 flex flex-col gap-4 md:hidden z-40 shadow-xl animate-fade-in max-h-[70vh] overflow-y-auto">
          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                pathname === '/' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/projects"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                pathname === '/projects' || pathname?.startsWith('/project/') ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Explore Projects
            </Link>
            <Link
              href="/create"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                pathname === '/create' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Start Project
            </Link>
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                pathname === '/profile' || pathname?.startsWith('/profile/') ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              My Profile
            </Link>
          </nav>

          <div className="border-t border-zinc-900 my-1"></div>

          {address ? (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold px-3">
                Connected Wallet ({network.toUpperCase()})
              </span>
              <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-lg text-xs font-mono text-zinc-300 break-all">
                {address}
              </div>
              <Link
                href="/wallet"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full bg-indigo-650 hover:bg-indigo-750 text-white font-bold py-2.5 rounded-lg text-xs transition text-center flex items-center justify-center gap-1.5 shadow-md shadow-indigo-650/10"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Lihat Lumen Wallet</span>
              </Link>

              <button
                onClick={() => {
                  setAddress(null);
                  localStorage.removeItem('earnly_wallet_address');
                  setNetwork('simulation');
                  setMobileMenuOpen(false);
                  window.location.reload();
                }}
                className="w-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-rose-400 font-bold py-2.5 rounded-lg text-xs transition text-center"
              >
                Disconnect Wallet
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setMobileConnectOpen(!mobileConnectOpen)}
                className="flex items-center justify-center gap-1.5 bg-indigo-650 hover:bg-indigo-750 border border-indigo-500/20 px-4 py-2.5 rounded-lg text-xs font-semibold text-white transition w-full"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Connect Wallet</span>
              </button>
              
              {mobileConnectOpen && (
                <div className="grid grid-cols-2 gap-2 text-xs mt-1 animate-reveal-up">
                  <button
                    onClick={() => {
                      handleNetworkConnect('testnet');
                      setMobileMenuOpen(false);
                      setMobileConnectOpen(false);
                    }}
                    className="bg-zinc-900 border border-zinc-800 hover:border-zinc-750 text-zinc-200 py-2.5 rounded-lg font-bold text-center transition flex flex-col items-center justify-center gap-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>Testnet</span>
                  </button>
                  <button
                    onClick={() => {
                      handleNetworkConnect('mainnet');
                      setMobileMenuOpen(false);
                      setMobileConnectOpen(false);
                    }}
                    className="bg-zinc-900 border border-zinc-800 hover:border-zinc-750 text-zinc-200 py-2.5 rounded-lg font-bold text-center transition flex flex-col items-center justify-center gap-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Mainnet</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Global Transaction Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
              className="pointer-events-auto bg-zinc-950/95 border border-indigo-500/35 p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.55)] flex items-start gap-3 w-full backdrop-blur-md glow-indigo"
            >
              <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl shrink-0">
                <Coins className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider font-mono">
                  {toast.title}
                </span>
                <p className="text-xs text-white leading-relaxed font-sans text-left">{toast.message}</p>
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-zinc-500 hover:text-zinc-300 transition p-1 pointer-events-auto"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </header>

      {/* Global Live Chat Drawer (ZeusX Style) */}
      <AnimatePresence>
        {chatOpen && (
          <>
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatOpen(false)}
              className="fixed inset-0 bg-black z-[9990] backdrop-blur-sm"
            />

            {/* Chat Container Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm md:max-w-3xl bg-zinc-950 border-l border-zinc-850 shadow-2xl z-[9991] flex flex-col overflow-hidden text-white"
            >
              {/* Header */}
              <div className="p-4 border-b border-zinc-855 flex items-center justify-between bg-zinc-900/40 shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs font-black uppercase tracking-wider font-mono">Chat</span>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1.5 hover:bg-zinc-850 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body: Split View on MD/LG, Stacked on Mobile */}
              <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-zinc-850/60 overflow-hidden">
                {/* Left Panel: Inbox / Conversations List */}
                <div className={`w-full md:w-[260px] flex flex-col bg-zinc-950 ${selectedProjectId !== null ? 'hidden md:flex' : 'flex'}`}>
                  <div className="p-3 border-b border-zinc-900/50 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Inbox Threads</span>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar p-2 flex flex-col gap-1 max-h-[calc(100vh-120px)]">
                    {chatsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                      </div>
                    ) : getInboxThreads().length === 0 ? (
                      <div className="text-center py-16 text-zinc-650 text-xs italic font-sans">
                        No messages yet.
                      </div>
                    ) : (
                      getInboxThreads().map((thread) => {
                        const isSeller = thread.projectDetails?.creatorAddress && thread.projectDetails.creatorAddress.toLowerCase() === getMyAddress().toLowerCase();
                        const partnerLabel = isSeller
                          ? (thread.buyerAddress && thread.buyerAddress.startsWith('Guest_') ? `Guest (${thread.buyerAddress.split('_')[1]})` : getFriendlyName(thread.buyerAddress))
                          : `Seller (${getFriendlyName(thread.projectDetails?.creatorAddress)})`;

                        const isActive = selectedProjectId === thread.projectId && selectedBuyer && thread.buyerAddress && selectedBuyer.toLowerCase() === thread.buyerAddress.toLowerCase();
                        const time = new Date(thread.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                          <button
                            key={`${thread.projectId}-${thread.buyerAddress}`}
                            onClick={() => {
                              setSelectedProjectId(thread.projectId);
                              setSelectedBuyer(thread.buyerAddress);
                              setChatInput('');
                            }}
                            className={`w-full text-left p-3 rounded-xl transition flex flex-col gap-1.5 border cursor-pointer ${
                              isActive
                                ? 'bg-indigo-600/15 border-indigo-500/30 text-white'
                                : 'hover:bg-zinc-900/40 border-transparent text-zinc-400'
                            }`}
                          >
                            <div className="flex justify-between items-center w-full">
                              <span className="text-xs font-bold truncate pr-2 max-w-[130px]">
                                {partnerLabel}
                              </span>
                              <span className="text-[9px] text-zinc-600 font-mono shrink-0">{time}</span>
                            </div>

                            {/* Item Reference Card inside sidebar thread */}
                            {thread.projectDetails && (
                              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-zinc-950/80 border border-zinc-900 w-full">
                                <div className="w-6 h-6 rounded bg-zinc-900 flex items-center justify-center text-[10px] text-indigo-400 font-bold uppercase overflow-hidden shrink-0">
                                  {thread.projectDetails.imageUrl ? (
                                    <img src={thread.projectDetails.imageUrl.split(',')[0]} className="w-full h-full object-cover" />
                                  ) : (
                                    <ShoppingBag className="w-3.5 h-3.5 text-zinc-500" />
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0 leading-tight">
                                  <span className="text-[10px] font-bold text-zinc-300 truncate w-full">{thread.projectDetails.title}</span>
                                  <span className="text-[9px] text-indigo-400 font-mono font-bold">{thread.projectDetails.price} USDC</span>
                                </div>
                              </div>
                            )}

                            <span className="text-[10px] text-zinc-500 truncate w-full font-sans leading-relaxed">
                              {thread.lastMessage.message}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Panel: Conversation Feed */}
                <div className={`flex-1 flex flex-col bg-zinc-950/40 ${selectedProjectId === null ? 'hidden md:flex' : 'flex'}`}>
                  {selectedProjectId !== null && selectedBuyer ? (
                    <>
                      {/* Thread Header with back option on mobile */}
                      <div className="p-3.5 border-b border-zinc-900 flex items-center gap-3 bg-zinc-900/20 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedProjectId(null);
                            setSelectedBuyer('');
                          }}
                          className="md:hidden p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        
                        {/* Reference Item Top Header ("menandakan item") */}
                        {(() => {
                          const activeThread = chats.find(c => c.projectId === selectedProjectId && c.buyerAddress === selectedBuyer);
                          if (!activeThread?.projectDetails) return null;
                          return (
                            <div className="flex items-center gap-3 w-full min-w-0">
                              <div className="w-9 h-9 rounded bg-zinc-955 border border-zinc-900 flex items-center justify-center shrink-0 overflow-hidden">
                                {activeThread.projectDetails.imageUrl ? (
                                  <img src={activeThread.projectDetails.imageUrl.split(',')[0]} className="w-full h-full object-cover" />
                                ) : (
                                  <ShoppingBag className="w-4 h-4 text-indigo-450" />
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-none">{activeThread.projectDetails.title}</span>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-450 leading-none">
                                  <span className="text-indigo-400 font-mono font-bold">{activeThread.projectDetails.price} USDC</span>
                                  <span>•</span>
                                  <span>To: {selectedBuyer.startsWith('Guest_') ? `Guest (${selectedBuyer.split('_')[1]})` : getFriendlyName(selectedBuyer)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Chat Messages */}
                      <div className="flex-1 p-4 flex flex-col gap-3.5 overflow-y-auto no-scrollbar font-sans max-h-[calc(100vh-180px)]">
                        {chats
                          .filter((c) => c.projectId === selectedProjectId && c.buyerAddress.toLowerCase() === selectedBuyer.toLowerCase())
                          .map((chat) => {
                            const isSenderMe = chat.sender.toLowerCase() === getMyAddress().toLowerCase();
                            const time = new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            return (
                              <div
                                key={chat.id}
                                className={`flex flex-col gap-1 max-w-[85%] ${
                                  isSenderMe ? 'self-end items-end' : 'self-start items-start'
                                }`}
                              >
                                <span className="text-[8px] text-zinc-500 px-1 uppercase font-bold tracking-wider">
                                  {isSenderMe ? 'You' : chat.isCreator ? 'Seller' : 'Buyer'}
                                </span>
                                <div
                                  className={`p-3 rounded-2xl text-xs break-words font-sans leading-relaxed shadow-sm ${
                                    isSenderMe
                                      ? 'bg-indigo-600 text-white rounded-tr-none border border-indigo-500/20'
                                      : 'bg-zinc-900/80 text-zinc-350 border border-zinc-850 rounded-tl-none'
                                  }`}
                                >
                                  {chat.message}
                                </div>
                                <span className="text-[9px] text-zinc-650 font-mono px-1">{time}</span>
                              </div>
                            );
                          })}
                      </div>

                      {/* Input */}
                      <form onSubmit={handleSendChat} className="p-4 border-t border-zinc-850 bg-zinc-950/20 flex gap-2 items-center font-sans shrink-0">
                        <input
                          type="text"
                          placeholder="Type your message..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          className="flex-1 bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-indigo-650 text-zinc-200 text-xs rounded-xl p-3 outline-none transition font-medium"
                          maxLength={500}
                        />
                        <button
                          type="submit"
                          disabled={!chatInput.trim()}
                          className="p-3 bg-indigo-600 hover:bg-indigo-750 disabled:bg-zinc-900 disabled:text-zinc-700 text-white rounded-xl transition duration-300 shadow-md flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-2.5">
                      <MessageSquare className="w-10 h-10 text-zinc-755 animate-pulse" />
                      <h4 className="text-xs font-bold text-zinc-450 uppercase tracking-wider">Inbox Thread</h4>
                      <p className="text-xs text-zinc-600 max-w-[240px] font-sans">
                        Select an active thread from the sidebar inbox list to view chat and reply.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <WalletConnectionModal 
        isOpen={isWalletModalOpen} 
        onClose={() => setIsWalletModalOpen(false)} 
      />
    </>
);
}
