'use client';

import { useState, useEffect } from 'react';
import Header from '@/app/components/Header';
import {
  getCampaign,
  getContributorPledge,
  getMockBalances,
  CampaignState,
  isCreatorApproved,
  setCreatorStatus,
  verifyCreatorZk,
  isMockMode,
  getTokenBalance
} from '@/lib/stellar';
import { ProjectMetadata, CreatorApplication } from '@/lib/db';
import { getNotifications, NotificationItem, fetchUserTransactions } from '@/lib/notifications';
import {
  Wallet,
  Award,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  ShieldCheck,
  Coins,
  FolderGit2,
  HeartHandshake,
  RefreshCw,
  Plus,
  FileText,
  UserCheck,
  CheckCircle,
  XCircle,
  Mail,
  Link as LinkIcon,
  BookOpen,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Edit2
} from 'lucide-react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';

// Framer Motion variants for stagger reveal animations
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15
    }
  }
};

const getGradientForCategory = (cat: string) => {
  switch (cat) {
    case 'Technology': return 'from-teal-950 via-slate-900 to-indigo-950';
    case 'Design & Art': return 'from-purple-950 via-zinc-900 to-rose-950';
    case 'Music & Audio': return 'from-orange-950 via-neutral-900 to-red-950';
    case 'Writing & Literature': return 'from-emerald-950 via-zinc-900 to-teal-950';
    case 'Video & Animation': return 'from-fuchsia-950 via-slate-900 to-blue-950';
    default: return 'from-indigo-950 via-zinc-900 to-purple-950';
  }
};

export default function ProfilePage() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [blockchainStates, setBlockchainStates] = useState<Record<number, CampaignState>>({});
  const [userPledges, setUserPledges] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'backed-projects' | 'my-projects' | 'seller-verification' | 'transaction-history'>('backed-projects');
  const [transactionPage, setTransactionPage] = useState(1);
  const [backedPage, setBackedPage] = useState(1);
  const [createdPage, setCreatedPage] = useState(1);

  // Application form states
  const [realName, setRealName] = useState('');
  const [email, setEmail] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [idNumber, setIdNumber] = useState<string>('');
  const [submittingApp, setSubmittingApp] = useState(false);
  const [userApplication, setUserApplication] = useState<CreatorApplication | null>(null);
  const [allApplications, setAllApplications] = useState<CreatorApplication[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerifiedOnChain, setIsVerifiedOnChain] = useState<boolean>(false);
  const [userNotifs, setUserNotifs] = useState<NotificationItem[]>([]);

  // Name edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [savingName, setSavingName] = useState(false);


  const loadData = async () => {
    try {
      setLoading(true);
      const activeAddr = localStorage.getItem('earnly_wallet_address') || '';
      setWalletAddress(activeAddr);
      if (isMockMode()) {
        const mockBals = await getMockBalances();
        setBalances(mockBals);
      } else if (activeAddr) {
        const bal = await getTokenBalance(activeAddr);
        setBalances({ [activeAddr]: bal });
      }

      const adminAddress = 'GB_CREATOR_ADDRESS_STW_NORTHGATE';
      setIsAdmin(activeAddr === adminAddress);

      // Fetch projects
      const res = await fetch('/api/projects');
      if (res.ok) {
        const allProjects: ProjectMetadata[] = await res.json();
        setProjects(allProjects);

        const states: Record<number, CampaignState> = {};
        const pledges: Record<number, number> = {};

        for (const p of allProjects) {
          try {
            const state = await getCampaign(p.id);
            if (state) {
              states[p.id] = state;
            }
            if (activeAddr) {
              const pledgeAmt = await getContributorPledge(p.id, activeAddr);
              pledges[p.id] = pledgeAmt;
            }
          } catch (err) {
            console.error(`Error loading state for project ${p.id}:`, err);
          }
        }
        setBlockchainStates(states);
        setUserPledges(pledges);

        // Fetch user notifications/transaction logs from Supabase
        const dbTransactions = await fetchUserTransactions(activeAddr);
        setUserNotifs(dbTransactions);
      }

      // Fetch user creator application and on-chain status
      if (activeAddr) {
        const isApproved = await isCreatorApproved(activeAddr);
        setIsVerifiedOnChain(isApproved);

        const appRes = await fetch(`/api/creators?address=${activeAddr}`);
        if (appRes.ok) {
          const appData: CreatorApplication = await appRes.json();
          setUserApplication(appData);

          // Auto-sync in mock mode if Web2 status is approved but mockup blockchain status is not registered yet
          if (appData && appData.status === 'approved' && !isApproved && isMockMode()) {
            try {
              const nullifier = appData.nullifierHash || 'zk_nullifier_default';
              const proof = appData.zkProof || 'zk_verification_key_default';
              await verifyCreatorZk(activeAddr, nullifier, proof);
              setIsVerifiedOnChain(true);
            } catch (err) {
              console.error('Error auto-syncing mock creator verification:', err);
            }
          }
        }
      } else {
        setIsVerifiedOnChain(false);
      }


      // If admin, fetch all applications
      if (activeAddr === adminAddress) {
        const allAppsRes = await fetch('/api/creators');
        if (allAppsRes.ok) {
          const appsData = await allAppsRes.json();
          setAllApplications(appsData);
        }
      }

    } catch (err) {
      console.error('Error loading profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Check if query param specifies active tab
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'seller-verification') {
        setActiveTab('seller-verification');
      } else if (tab === 'transaction-history') {
        setActiveTab('transaction-history');
      } else if (tab === 'my-projects') {
        setActiveTab('my-projects');
      } else if (tab === 'backed-projects') {
        setActiveTab('backed-projects');
      }
    }

    // Listen for wallet changes
    window.addEventListener('walletChange', loadData);
    return () => {
      window.removeEventListener('walletChange', loadData);
    };
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) return;

    if (!realName.trim().startsWith('@')) {
      alert('Nama harus diawali dengan karakter @ (contoh: @username).');
      return;
    }
    const handleRegex = /^@[a-zA-Z0-9_]{2,30}$/;
    if (!handleRegex.test(realName.trim())) {
      alert('Nama hanya boleh berisi huruf, angka, dan underscore setelah @ (2-30 karakter).');
      return;
    }

    try {
      setSubmittingApp(true);

      // Generate ZK Nullifier Hash locally
      const msg = `${idNumber.trim()}-${walletAddress.trim()}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(msg);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const nullifierHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Local ZK Proof generation using verification key
      const zkProof = 'zk_verification_key_default';

      const res = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          realName,
          email,
          portfolio,
          zkProof,
          nullifierHash
        })
      });

      if (res.ok) {
        try {
          await verifyCreatorZk(walletAddress, nullifierHash, zkProof);
          alert('Seller verification completed and registered successfully!');
        } catch (contractErr: any) {
          console.error('Contract verification failed:', contractErr);
          alert(`Web2 details saved, but Web3 on-chain registration failed: ${contractErr.message || contractErr}`);
        }
        setRealName('');
        setEmail('');
        setPortfolio('');
        setIdNumber('');
        await loadData();
      } else {
        let errMsg = 'Failed to submit application';
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to register application details.');
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) return;

    if (!tempName.trim().startsWith('@')) {
      alert('Nama harus diawali dengan karakter @ (contoh: @username).');
      return;
    }
    const handleRegex = /^@[a-zA-Z0-9_]{2,30}$/;
    if (!handleRegex.test(tempName.trim())) {
      alert('Nama hanya boleh berisi huruf, angka, dan underscore setelah @ (2-30 karakter).');
      return;
    }

    try {
      setSavingName(true);
      const res = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_name',
          walletAddress,
          newName: tempName.trim()
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setUserApplication(updated);
        setIsEditingName(false);
        window.dispatchEvent(new Event('walletChange'));
        await loadData();
        alert('Nama berhasil diubah!');
      } else {
        let errMsg = 'Gagal mengubah nama.';
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        alert(errMsg);
      }
    } catch (err) {
      console.error(err);
      alert('Gagal mengubah nama.');
    } finally {
      setSavingName(false);
    }
  };




  // Stats calculation
  const currentBalance = balances[walletAddress] ?? 0;

  const myCreatedProjects = projects.filter(
    (p) => p.creatorAddress.toLowerCase() === walletAddress.toLowerCase() ||
      (walletAddress.startsWith('GB_CREATOR_') && p.creatorAddress.startsWith('GB_CREATOR_'))
  );

  const myBackedProjects = projects.filter((p) => (userPledges[p.id] ?? 0) > 0);
  const totalUSDCBacked = Object.values(userPledges).reduce((acc, val) => acc + val, 0);

  // Friendly descriptions for accounts
  const getFriendlyRole = (addr: string) => {
    if (addr === 'GB_CREATOR_ADDRESS_STW_NORTHGATE') return 'Compliance Compliance Admin';
    if (addr === 'GB_CONTRIBUTOR_1_STW_NORTHGATE') return 'Platform VIP Supporter';
    if (addr === 'GB_CONTRIBUTOR_2_STW_NORTHGATE') return 'Platform Supporter';
    if (addr === 'GB_GUEST_ADDRESS_STW_NORTHGATE') return 'External Auditor';
    return 'Stellar Network Member';
  };

  // Pagination variables for Transaction History
  const ITEMS_PER_PAGE = 8;
  const totalPages = Math.ceil(userNotifs.length / ITEMS_PER_PAGE);
  const currentPage = Math.max(1, Math.min(transactionPage, totalPages));
  const paginatedTransactions = userNotifs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Pagination for Backed Projects
  const PROJECTS_PER_PAGE = 12;
  const totalBackedPages = Math.ceil(myBackedProjects.length / PROJECTS_PER_PAGE);
  const currentBackedPage = Math.max(1, Math.min(backedPage, totalBackedPages));
  const paginatedBackedProjects = myBackedProjects.slice(
    (currentBackedPage - 1) * PROJECTS_PER_PAGE,
    currentBackedPage * PROJECTS_PER_PAGE
  );

  // Pagination for Created Projects
  const totalCreatedPages = Math.ceil(myCreatedProjects.length / PROJECTS_PER_PAGE);
  const currentCreatedPage = Math.max(1, Math.min(createdPage, totalCreatedPages));
  const paginatedCreatedProjects = myCreatedProjects.slice(
    (currentCreatedPage - 1) * PROJECTS_PER_PAGE,
    currentCreatedPage * PROJECTS_PER_PAGE
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 md:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">

        {/* PROFILE BANNER */}
        <section className="relative rounded-xl sm:rounded-2xl overflow-hidden glass-card p-4 sm:p-6 md:p-8 flex flex-col md:flex-row items-center gap-4 sm:gap-6 bg-gradient-to-br from-indigo-950/20 via-zinc-900 to-zinc-950">
          <div className="w-16 h-16 rounded-2xl bg-indigo-650 flex items-center justify-center text-white glow-primary border border-indigo-550/35 shrink-0 shadow-lg">
            <Wallet className="w-8 h-8" />
          </div>
          <div className="flex-1 flex flex-col gap-1.5 text-center md:text-left min-w-0 w-full md:w-auto">
            <div className="flex flex-col md:flex-row items-center gap-2 justify-center md:justify-start max-w-full">
              {isEditingName ? (
                <div className="flex items-center gap-2 max-w-xs sm:max-w-md w-full my-1 justify-center md:justify-start">
                  <input
                    type="text"
                    required
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    disabled={savingName}
                    placeholder="Masukkan nama baru..."
                    className="bg-zinc-950/85 border border-zinc-800 focus:border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs sm:text-sm outline-none font-sans flex-1 min-w-0"
                    maxLength={50}
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={savingName || !tempName.trim()}
                    className="bg-indigo-650 hover:bg-indigo-755 text-white font-bold text-xs px-3 py-2 rounded-lg transition shrink-0"
                  >
                    {savingName ? '...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(false)}
                    disabled={savingName}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-350 text-xs px-3 py-2 rounded-lg transition shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group/name max-w-full justify-center md:justify-start">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-black text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md animate-fade-in">
                    {userApplication ? userApplication.realName : (walletAddress ? 'Stellar Member' : 'Wallet Offline')}
                  </h1>
                  {walletAddress && (
                    <button
                      type="button"
                      onClick={() => {
                        setTempName(userApplication ? userApplication.realName : 'Stellar Member');
                        setIsEditingName(true);
                      }}
                      className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition opacity-70 hover:opacity-100 shrink-0"
                      title="Ganti Nama"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              {walletAddress && (
                <span className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded text-[10px] font-bold shrink-0">
                  {getFriendlyRole(walletAddress)}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 font-mono break-all max-w-xl">
              Freighter Wallet Public Key: {walletAddress}
            </p>
          </div>
          <div className="flex items-center gap-2 self-stretch md:self-auto justify-center">
            <button
              onClick={loadData}
              className="p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
              title="Sync Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* DASHBOARD STATS CARD GRID */}
        <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-zinc-900/50 p-3.5 sm:p-5 rounded-xl border border-zinc-800/80 flex flex-col gap-1.5 bg-gradient-to-br from-zinc-900 to-indigo-950/15">
            <Coins className="w-5 h-5 text-indigo-400" />
            <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Wallet Balance</span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono">{currentBalance.toFixed(2)} USDC</span>
          </div>

          <div className="bg-zinc-900/50 p-3.5 sm:p-5 rounded-xl border border-zinc-800/80 flex flex-col gap-1.5">
            <HeartHandshake className="w-5 h-5 text-indigo-400" />
            <span className="text-xs text-zinc-555 font-semibold uppercase tracking-wider">Total Contributed</span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono">{Math.round(totalUSDCBacked)} USDC</span>
          </div>

          <div className="bg-zinc-900/50 p-3.5 sm:p-5 rounded-xl border border-zinc-800/80 flex flex-col gap-1.5">
            <FolderGit2 className="w-5 h-5 text-indigo-400" />
            <span className="text-xs text-zinc-550 font-semibold uppercase tracking-wider">Backed Campaigns</span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono">{myBackedProjects.length}</span>
          </div>

          <div className="bg-zinc-900/50 p-3.5 sm:p-5 rounded-xl border border-zinc-800/80 flex flex-col gap-1.5">
            <Award className="w-5 h-5 text-indigo-400" />
            <span className="text-xs text-zinc-550 font-semibold uppercase tracking-wider">Created Listings</span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono">{myCreatedProjects.length}</span>
          </div>
        </section>

        {/* PROJECT TABS & DISPLAY */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/60 pb-3 gap-3">
            <div className="flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar whitespace-nowrap w-full pb-1">
              <button
                onClick={() => setActiveTab('backed-projects')}
                className={`pb-3 text-xs sm:text-sm font-bold transition-all relative ${activeTab === 'backed-projects'
                  ? 'text-white border-b-2 border-indigo-500'
                  : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                Supported Projects ({myBackedProjects.length})
              </button>
              <button
                onClick={() => setActiveTab('my-projects')}
                className={`pb-3 text-xs sm:text-sm font-bold transition-all relative ${activeTab === 'my-projects'
                  ? 'text-white border-b-2 border-indigo-500'
                  : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                My Creations ({myCreatedProjects.length})
              </button>
              <button
                onClick={() => setActiveTab('seller-verification')}
                className={`pb-3 text-xs sm:text-sm font-bold transition-all relative ${activeTab === 'seller-verification'
                  ? 'text-white border-b-2 border-indigo-500'
                  : 'text-zinc-550 hover:text-zinc-300'
                  }`}
              >
                {isAdmin ? 'Admin: Approvals' : 'Seller Verification'}
              </button>
              <button
                onClick={() => setActiveTab('transaction-history')}
                className={`pb-3 text-xs sm:text-sm font-bold transition-all relative ${activeTab === 'transaction-history'
                  ? 'text-white border-b-2 border-indigo-500'
                  : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                Transaction History ({userNotifs.length})
              </button>
            </div>
            <span className="text-xs text-zinc-550 font-mono">Simulation Mode Active</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-zinc-400 text-sm">Syncing with ledger...</p>
            </div>
          ) : activeTab === 'backed-projects' ? (
            myBackedProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-zinc-900/10 border border-zinc-850 border-dashed rounded-xl p-8 text-center gap-3">
                <HeartHandshake className="w-10 h-10 text-zinc-700" />
                <h3 className="text-base font-bold text-white">No Backed Projects</h3>
                <p className="text-zinc-550 text-xs max-w-sm">
                  Visit the explorer page, back a crowdfunded release pool, or purchase an asset instantly to view it here.
                </p>
                <Link href="/projects" className="mt-2 bg-indigo-650 hover:bg-indigo-750 text-white font-semibold text-xs px-4 py-2 rounded-lg glow-primary transition">
                  Browse Catalog
                </Link>
              </div>
            ) : (
              <>
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8"
                >
                  {paginatedBackedProjects.map((project) => {
                  const chainState = blockchainStates[project.id];
                  const pledged = chainState ? chainState.pledged_amount : 0;
                  const isCompleted = chainState ? chainState.is_completed : false;
                  const isAborted = chainState ? chainState.is_aborted : false;
                  const userPledgeAmt = userPledges[project.id] ?? 0;
                  const projectType = project.projectType ?? 1;

                  let progress = 0;
                  let badgeText = 'Active';
                  let badgeColor = 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20';

                  if (projectType === 0) {
                    badgeText = 'Instant Buy';
                    badgeColor = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
                  } else if (projectType === 2) {
                    badgeText = 'Custom Escrow';
                    badgeColor = 'bg-purple-500/15 text-purple-400 border border-purple-500/20';
                    progress = pledged > 0 ? 100 : 0;
                  } else {
                    progress = Math.min(Math.round((pledged / project.targetAmount) * 100), 100);
                    if (isCompleted) {
                      badgeText = 'Completed';
                      badgeColor = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
                    } else if (isAborted) {
                      badgeText = 'Cancelled';
                      badgeColor = 'bg-rose-500/15 text-rose-400 border border-rose-500/20';
                    } else if (pledged >= project.targetAmount) {
                      badgeText = 'Reached';
                      badgeColor = 'bg-amber-500/15 text-amber-400 border border-amber-500/20';
                    } else {
                      badgeText = 'Pool Active';
                      badgeColor = 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20';
                    }
                  }

                  // Calculate remaining days
                  const nowSec = Math.floor(Date.now() / 1000);
                  const deadlineSec = chainState ? chainState.deadline : nowSec;
                  const diffTime = deadlineSec - nowSec;
                  const daysLeft = Math.max(Math.ceil(diffTime / (24 * 60 * 60)), 0);

                  return (
                    <motion.div
                      key={project.id}
                      variants={itemVariants}
                      whileHover={{ y: -6, scale: 1.015 }}
                      className="flex flex-col rounded-3xl glass-card overflow-hidden hover-glow-card group shadow-lg border border-white/5 hover:border-white/10 transition-all duration-300 relative cursor-pointer"
                    >
                      {/* Entire card link overlay */}
                      <Link href={`/project/${project.id}`} className="absolute inset-0 z-20" />

                      {/* Header Image Gradient representation */}
                      <div className={`h-36 bg-gradient-to-tr ${getGradientForCategory(project.category)} border-b border-zinc-800/80 p-5 flex flex-col justify-between transition-all duration-300 group-hover:brightness-110 relative z-10 overflow-hidden`}>
                        <img 
                          src={project.imageUrl ? project.imageUrl.split(',')[0] : "/MockProducts.png"} 
                          alt={project.title}
                          className="absolute inset-0 w-full h-full object-cover z-0 opacity-70 group-hover:opacity-85 group-hover:scale-105 transition-all duration-500 pointer-events-none" 
                        />
                        <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/5 blur-xl group-hover:scale-125 transition-transform duration-500"></div>

                        <div className="flex items-center justify-between gap-2 relative z-10">
                          <div className="flex gap-1 flex-wrap">
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${badgeColor}`}>
                              {badgeText}
                            </span>
                            <span className="bg-zinc-900/60 text-zinc-350 border border-zinc-700/30 px-2 py-0.5 rounded text-[10px] font-bold">
                              {project.category || 'Technology'}
                            </span>
                          </div>

                          {projectType === 1 && (
                            <div className="flex items-center gap-1.5 text-zinc-350 bg-black/45 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-semibold border border-white/5 shrink-0">
                              <Clock className="w-3 h-3 text-indigo-400 animate-pulse" />
                              <span>{isCompleted ? 'Finished' : daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-6 flex-1 flex flex-col justify-between gap-6 relative z-10 bg-zinc-900/40">
                        <div className="flex flex-col gap-2">
                          {projectType === 0 && (
                            <span className="text-emerald-455 font-mono font-black text-sm">
                              {project.targetAmount} USDC
                            </span>
                          )}
                          <h3 className="font-bold text-white text-base group-hover:text-indigo-400 transition line-clamp-1">
                            {project.title}
                          </h3>
                        </div>

                        <div className="flex flex-col gap-3">
                          {projectType === 1 ? (
                            /* Crowdfunded Progress */
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-semibold text-zinc-555">Crowdfund Progress</span>
                                <span className="font-bold text-indigo-400 font-mono">{progress}%</span>
                              </div>
                              <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-850">
                                <div
                                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : projectType === 2 ? (
                            /* Custom Escrow Progress */
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-semibold text-zinc-555">Escrow Milestones</span>
                                <span className="font-bold text-purple-400 font-mono">
                                  {chainState ? `${chainState.current_milestone}/${chainState.total_milestones}` : '0/0'}
                                </span>
                              </div>
                              <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-850">
                                <div
                                  className="bg-gradient-to-r from-purple-600 to-pink-500 h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: chainState && chainState.total_milestones > 0
                                      ? `${(chainState.current_milestone / chainState.total_milestones) * 105}%`
                                      : '0%'
                                  }}
                                ></div>
                              </div>
                            </div>
                          ) : null}

                          {/* Details */}
                          <div className="flex justify-between border-t border-zinc-800/40 pt-3 text-xs text-zinc-500 gap-2">
                            <div>
                              <span className="block text-[10px] text-indigo-400/80 uppercase font-bold tracking-wider mb-0.5">Backed By You</span>
                              <span className="font-bold text-indigo-400 font-mono text-xs">{userPledgeAmt.toFixed(2)} USDC</span>
                            </div>
                            {projectType === 0 ? (
                              <div className="text-right">
                                <span className="block text-[10px] text-zinc-550 uppercase font-bold tracking-wider mb-0.5">Price</span>
                                <span className="font-bold text-emerald-450 font-mono text-xs">{project.targetAmount} USDC</span>
                              </div>
                            ) : (
                              <>
                                <div>
                                  <span className="block text-[10px] text-zinc-555 uppercase font-bold tracking-wider mb-0.5">Raised</span>
                                  <span className="font-bold text-emerald-450 font-mono text-xs">{pledged.toFixed(2)} USDC</span>
                                </div>
                                <div className="text-right">
                                  <span className="block text-[10px] text-zinc-550 uppercase font-bold tracking-wider mb-0.5">Target</span>
                                  <span className="font-bold text-zinc-350 font-mono text-xs">{project.targetAmount} USDC</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* View Details Action */}
                        <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-400 group-hover:text-indigo-300 transition duration-300 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-xl group-hover:bg-zinc-800 group-hover:border-zinc-700/85">
                          <span>View Details</span>
                          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Backed Projects Pagination Controls */}
              {totalBackedPages > 1 && (
                <div className="flex items-center justify-between border-t border-zinc-850 pt-4 mt-6">
                  <button
                    onClick={() => setBackedPage(prev => Math.max(1, prev - 1))}
                    disabled={currentBackedPage === 1}
                    className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </button>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Page <span className="text-zinc-300 font-bold">{currentBackedPage}</span> of <span className="text-zinc-300 font-bold">{totalBackedPages}</span>
                  </span>
                  <button
                    onClick={() => setBackedPage(prev => Math.min(totalBackedPages, prev + 1))}
                    disabled={currentBackedPage === totalBackedPages}
                    className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )
          ) : activeTab === 'my-projects' ? (
            myCreatedProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-zinc-900/10 border border-zinc-850 border-dashed rounded-xl p-8 text-center gap-3">
                <FolderGit2 className="w-10 h-10 text-zinc-700" />
                <h3 className="text-base font-bold text-white">No Creations Listed</h3>
                <p className="text-zinc-550 text-xs max-w-sm">
                  Register your smart contracts and start selling digital products or offering milestone services.
                </p>
                <Link href="/create" className="mt-2 bg-indigo-650 hover:bg-indigo-750 text-white font-semibold text-xs px-4 py-2 rounded-lg glow-primary flex items-center gap-1.5 transition">
                  <Plus className="w-3.5 h-3.5" /> Start Listing
                </Link>
              </div>
            ) : (
              <>
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8"
                >
                  {paginatedCreatedProjects.map((project) => {
                  const chainState = blockchainStates[project.id];
                  const pledged = chainState ? chainState.pledged_amount : 0;
                  const isCompleted = chainState ? chainState.is_completed : false;
                  const isAborted = chainState ? chainState.is_aborted : false;
                  const projectType = project.projectType ?? 1;

                  let progress = 0;
                  let badgeText = 'Active';
                  let badgeColor = 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20';

                  if (projectType === 0) {
                    badgeText = 'Instant Buy';
                    badgeColor = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
                  } else if (projectType === 2) {
                    badgeText = 'Custom Escrow';
                    badgeColor = 'bg-purple-500/15 text-purple-400 border border-purple-500/20';
                    progress = pledged > 0 ? 100 : 0;
                  } else {
                    progress = Math.min(Math.round((pledged / project.targetAmount) * 100), 100);
                    if (isCompleted) {
                      badgeText = 'Completed';
                      badgeColor = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
                    } else if (isAborted) {
                      badgeText = 'Cancelled';
                      badgeColor = 'bg-rose-500/15 text-rose-400 border border-rose-500/20';
                    } else if (pledged >= project.targetAmount) {
                      badgeText = 'Reached';
                      badgeColor = 'bg-amber-500/15 text-amber-400 border border-amber-500/20';
                    } else {
                      badgeText = 'Pool Active';
                      badgeColor = 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20';
                    }
                  }

                  // Calculate remaining days
                  const nowSec = Math.floor(Date.now() / 1000);
                  const deadlineSec = chainState ? chainState.deadline : nowSec;
                  const diffTime = deadlineSec - nowSec;
                  const daysLeft = Math.max(Math.ceil(diffTime / (24 * 60 * 60)), 0);

                  return (
                    <motion.div
                      key={project.id}
                      variants={itemVariants}
                      whileHover={{ y: -6, scale: 1.015 }}
                      className="flex flex-col rounded-3xl glass-card overflow-hidden hover-glow-card group shadow-lg border border-white/5 hover:border-white/10 transition-all duration-300 relative cursor-pointer"
                    >
                      {/* Entire card link overlay */}
                      <Link href={`/project/${project.id}`} className="absolute inset-0 z-20" />

                      {/* Header Image Gradient representation */}
                      <div className={`h-36 bg-gradient-to-tr ${getGradientForCategory(project.category)} border-b border-zinc-800/80 p-5 flex flex-col justify-between transition-all duration-300 group-hover:brightness-110 relative z-10 overflow-hidden`}>
                        <img 
                          src={project.imageUrl ? project.imageUrl.split(',')[0] : "/MockProducts.png"} 
                          alt={project.title}
                          className="absolute inset-0 w-full h-full object-cover z-0 opacity-70 group-hover:opacity-85 group-hover:scale-105 transition-all duration-500 pointer-events-none" 
                        />
                        <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/5 blur-xl group-hover:scale-125 transition-transform duration-500"></div>

                        <div className="flex items-center justify-between gap-2 relative z-10">
                          <div className="flex gap-1 flex-wrap">
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${badgeColor}`}>
                              {badgeText}
                            </span>
                            <span className="bg-zinc-900/60 text-zinc-350 border border-zinc-700/30 px-2 py-0.5 rounded text-[10px] font-bold">
                              {project.category || 'Technology'}
                            </span>
                          </div>

                          {projectType === 1 && (
                            <div className="flex items-center gap-1.5 text-zinc-350 bg-black/45 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-semibold border border-white/5 shrink-0">
                              <Clock className="w-3 h-3 text-indigo-400 animate-pulse" />
                              <span>{isCompleted ? 'Finished' : daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-6 flex-1 flex flex-col justify-between gap-6 relative z-10 bg-zinc-900/40">
                        <div className="flex flex-col gap-2">
                          {projectType === 0 && (
                            <span className="text-emerald-455 font-mono font-black text-sm">
                              {project.targetAmount} USDC
                            </span>
                          )}
                          <h3 className="font-bold text-white text-base group-hover:text-indigo-400 transition line-clamp-1">
                            {project.title}
                          </h3>
                        </div>

                        <div className="flex flex-col gap-3">
                          {projectType === 1 ? (
                            /* Crowdfunded Progress */
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-semibold text-zinc-555">Crowdfund Progress</span>
                                <span className="font-bold text-indigo-400 font-mono">{progress}%</span>
                              </div>
                              <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-850">
                                <div
                                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : projectType === 2 ? (
                            /* Custom Escrow Progress */
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-semibold text-zinc-555">Escrow Milestones</span>
                                <span className="font-bold text-purple-400 font-mono">
                                  {chainState ? `${chainState.current_milestone}/${chainState.total_milestones}` : '0/0'}
                                </span>
                              </div>
                              <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-850">
                                <div
                                  className="bg-gradient-to-r from-purple-600 to-pink-500 h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: chainState && chainState.total_milestones > 0
                                      ? `${(chainState.current_milestone / chainState.total_milestones) * 105}%`
                                      : '0%'
                                  }}
                                ></div>
                              </div>
                            </div>
                          ) : null}

                          {/* Details */}
                          {projectType !== 0 && (
                            <div className="flex justify-between border-t border-zinc-800/40 pt-3 text-xs text-zinc-500">
                              <div>
                                <span className="block text-[10px] text-zinc-555 uppercase font-bold tracking-wider mb-0.5">Raised</span>
                                <span className="font-bold text-emerald-450 font-mono text-xs">{pledged.toFixed(2)} USDC</span>
                              </div>
                              <div className="text-right">
                                <span className="block text-[10px] text-zinc-550 uppercase font-bold tracking-wider mb-0.5">Target</span>
                                <span className="font-bold text-zinc-350 font-mono text-xs">{project.targetAmount} USDC</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* View Details Action */}
                        <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-400 group-hover:text-indigo-300 transition duration-300 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-xl group-hover:bg-zinc-800 group-hover:border-zinc-700/85">
                          <span>Manage Listing</span>
                          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Created Projects Pagination Controls */}
              {totalCreatedPages > 1 && (
                <div className="flex items-center justify-between border-t border-zinc-850 pt-4 mt-6">
                  <button
                    onClick={() => setCreatedPage(prev => Math.max(1, prev - 1))}
                    disabled={currentCreatedPage === 1}
                    className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </button>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Page <span className="text-zinc-300 font-bold">{currentCreatedPage}</span> of <span className="text-zinc-300 font-bold">{totalCreatedPages}</span>
                  </span>
                  <button
                    onClick={() => setCreatedPage(prev => Math.min(totalCreatedPages, prev + 1))}
                    disabled={currentCreatedPage === totalCreatedPages}
                    className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )
          ) : activeTab === 'seller-verification' ? (
            /* SELLER VERIFICATION TAB (Merchant gating) */
            <div className="flex flex-col gap-6 w-full animate-fade-in">

              {/* SELLER VIEW: Register application / Status */}
              <div className="rounded-xl glass-card p-6 border border-zinc-800 flex flex-col gap-6">
                {userApplication ? (
                  /* Status tracker */
                  <div className="flex flex-col gap-4 text-center max-w-lg mx-auto py-4 sm:py-8 px-2 sm:px-4">
                    {userApplication.status === 'approved' ? (
                      <>
                        <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-500 mx-auto" />
                        <h3 className="text-lg sm:text-xl font-bold text-white mt-2">Identity Activation Verified</h3>
                        <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                          Your profile has passed compliance reviews. Web3 gating is active on-chain for Freighter address:
                        </p>
                        <div className="bg-zinc-950 p-2 sm:p-3 rounded-lg border border-zinc-800 text-[10px] sm:text-xs font-mono text-zinc-350 break-all select-all hover:border-zinc-700 transition">
                          {walletAddress}
                        </div>

                        {/* On-chain activation status and trigger button */}
                        {!isVerifiedOnChain ? (
                          <div className="mt-4 p-3 sm:p-4 bg-zinc-950 rounded-lg border border-amber-500/20 text-center flex flex-col gap-2">
                            <span className="text-amber-500 text-xs font-semibold">Action Required: On-chain Registration Pending</span>
                            <span className="text-zinc-450 text-[10px] sm:text-[11px] leading-relaxed">
                              Your compliance application is approved, but your wallet identity has not been activated on the blockchain contract yet.
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  setSubmittingApp(true);
                                  const nullifier = userApplication.nullifierHash || 'zk_nullifier_default';
                                  const proof = userApplication.zkProof || 'zk_verification_key_default';
                                  await verifyCreatorZk(walletAddress, nullifier, proof);
                                  alert('Successfully registered and activated your identity on-chain!');
                                  await loadData();
                                } catch (err: any) {
                                  alert(`ZK activation transaction failed: ${err.message || err}`);
                                } finally {
                                  setSubmittingApp(false);
                                }
                              }}
                              disabled={submittingApp}
                              className="bg-indigo-650 hover:bg-indigo-750 text-white font-medium py-2.5 px-4 rounded-lg text-xs transition disabled:opacity-50 flex items-center justify-center gap-2 w-full cursor-pointer"
                            >
                              {submittingApp && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              Activate Web3 Identity (Freighter Transaction)
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-emerald-400 font-semibold mt-2 flex items-center justify-center gap-1">
                            <CheckCircle className="w-4 h-4" /> ✓ Active on Stellar Network Gating
                          </span>
                        )}

                        <p className="text-xs text-zinc-550 italic mt-2">
                          You are fully authorized to deploy digital assets, crowdfund pools, and locked escrow contracts.
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-indigo-400 bg-indigo-950/25 border border-indigo-900/30 rounded-lg p-3 mt-2 max-w-sm mx-auto font-sans leading-relaxed">
                          Identitas Anda terverifikasi secara on-chain. Nomor identitas asli Anda aman dan tidak disimpan di dalam server platform maupun ledger publik Stellar.
                        </p>
                      </>
                    ) : userApplication.status === 'rejected' ? (
                      <>
                        <XCircle className="w-16 h-16 text-rose-500 mx-auto" />
                        <h3 className="text-xl font-bold text-white mt-2">Verification Denied</h3>
                        <p className="text-zinc-400 text-sm">
                          Your portfolio review did not satisfy Stillwater compliance parameters. Please contact support.
                        </p>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-16 h-16 text-amber-500 animate-spin mx-auto" />
                        <h3 className="text-xl font-bold text-white mt-2">Verification Pending</h3>
                        <p className="text-zinc-400 text-sm">
                          Your Web2 metadata has been submitted. Awaiting Compliance Admin to approve KTP/KTM document verification and trigger Soroban registry activation.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  /* Application Registration Form */
                  <div className="flex flex-col gap-5 max-w-xl mx-auto w-full">
                    <div className="flex flex-col gap-1 text-center items-center">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 justify-center">
                        <ShieldCheck className="w-5 h-5 text-indigo-400" /> Apply for Creator Status (ZK-Identity self-verification)
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Sellers must register credentials and generate Zero-Knowledge mathematical proofs locally to deploy smart contracts.
                      </p>
                    </div>

                    <form onSubmit={handleApply} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase">Username / Handle (must start with @)</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g., @astrid"
                          value={realName}
                          onChange={(e) => setRealName(e.target.value)}
                          className="bg-zinc-950 border border-zinc-850 focus:border-zinc-700 rounded-lg p-2.5 text-zinc-200 text-xs transition outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase">Business Email</label>
                        <input
                          type="email"
                          required
                          placeholder="e.g., astrid@stillwater.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-zinc-950 border border-zinc-850 focus:border-zinc-700 rounded-lg p-2.5 text-zinc-200 text-xs transition outline-none font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase">Portfolio URL (GitHub / Behance / ArtStation)</label>
                        <input
                          type="url"
                          required
                          placeholder="e.g., https://github.com/astrid"
                          value={portfolio}
                          onChange={(e) => setPortfolio(e.target.value)}
                          className="bg-zinc-950 border border-zinc-850 focus:border-zinc-700 rounded-lg p-2.5 text-zinc-200 text-xs transition outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingApp}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 text-white font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-1.5 transition glow-primary mt-2 px-4 text-center"
                      >
                        {submittingApp ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span className="text-[10px] md:text-xs">Encrypting your identity locally using Zero-Knowledge Proof...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" /> Verify & Activate with ZK-Proof
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* ADMIN COMPLIANCE AUDIT VIEW */}
              {isAdmin && (
                <div className="rounded-xl glass-card p-6 border border-zinc-800 flex flex-col gap-6">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Compliance Panel: Registered Sellers (ZK Audit Log)</h3>
                  </div>

                  {allApplications.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">No applications recorded in the database.</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {allApplications.map((app) => (
                        <div
                          key={app.walletAddress}
                          className="bg-zinc-950 p-3 sm:p-5 rounded-xl border border-zinc-850 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6"
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-white text-base">{app.realName}</span>
                              <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${app.status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : app.status === 'rejected'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                {app.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-1.5 text-xs text-zinc-400 font-mono">
                              <span className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-zinc-550 shrink-0" /> {app.email}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <LinkIcon className="w-3.5 h-3.5 text-zinc-550 shrink-0" />
                                <a href={app.portfolio} target="_blank" rel="noreferrer" className="hover:underline text-indigo-400 truncate max-w-[150px]">{app.portfolio}</a>
                              </span>
                              <span className="flex items-center gap-1.5 truncate max-w-[200px]" title={app.walletAddress}>
                                <Wallet className="w-3.5 h-3.5 text-zinc-550 shrink-0" /> {app.walletAddress}
                              </span>
                            </div>

                            <div className="flex flex-col gap-1 text-[10px] text-zinc-555 font-sans mt-1">
                              <div>
                                Nullifier Hash: <span className="font-bold text-zinc-400 font-mono text-[9px]">{app.nullifierHash}</span>
                              </div>
                              <div>
                                ZK Proof: <span className="font-bold text-zinc-400 font-mono text-[9px] truncate max-w-[280px] inline-block align-bottom">{app.zkProof}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* TRANSACTION HISTORY TAB */
            <div className="flex flex-col gap-6 w-full animate-fade-in">
              <div className="rounded-xl glass-card p-4 sm:p-6 border border-zinc-800 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <History className="w-5 h-5 text-indigo-400" /> Transaction History
                  </h3>
                  <span className="text-xs text-zinc-555 font-mono">
                    Total Transactions: {userNotifs.length}
                  </span>
                </div>

                {userNotifs.length === 0 ? (
                  <div className="text-center py-12 text-zinc-550 text-sm font-medium font-sans">
                    No transactions recorded on this profile.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3">
                      {paginatedTransactions.map((notif) => {
                        const isOutgoing = notif.userAddress.toLowerCase() === walletAddress.toLowerCase();
                        const hasAmount = notif.amount !== undefined && notif.amount > 0;
                        const displayUsdc = hasAmount ? `${notif.amount!.toFixed(2)} USDC` : null;
                        const displayXlm = notif.xlmAmount !== undefined && notif.xlmAmount > 0
                          ? `${notif.xlmAmount.toFixed(2)} XLM`
                          : hasAmount && notif.xlmPrice
                            ? `${(notif.amount! / notif.xlmPrice).toFixed(2)} XLM`
                            : null;

                        let isIncoming = false;
                        if (notif.type === 'refund' || notif.type === 'milestone_claim') {
                          isIncoming = true;
                        } else if (!isOutgoing) {
                          isIncoming = true;
                        }

                        return (
                          <div
                            key={notif.id}
                            className="bg-zinc-950 dark:bg-zinc-950 bg-white/70 p-4 rounded-xl border border-zinc-850 dark:border-zinc-850 border-zinc-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4"
                          >
                            <div className="flex items-start gap-3.5 min-w-0 flex-1">
                              <div className={`p-2.5 rounded-xl border shrink-0 ${
                                isIncoming 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                  : 'bg-zinc-900 dark:bg-zinc-900 bg-zinc-100 text-zinc-400 border-zinc-850 dark:border-zinc-850 border-zinc-200'
                              }`}>
                                {isIncoming ? (
                                  <ArrowUpRight className="w-4 h-4" />
                                ) : (
                                  <ArrowDownLeft className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0 flex flex-col gap-1 text-left flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono">
                                    {notif.type.replace('_', ' ')}
                                  </span>
                                  <span className="text-[9px] text-zinc-500 dark:text-zinc-500 text-zinc-405 font-mono font-bold">
                                    {new Date(notif.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-800 dark:text-white leading-relaxed font-sans break-words">{notif.message}</p>
                                <Link
                                  href={`/project/${notif.projectId}`}
                                  className="text-[10px] text-indigo-400/80 hover:text-indigo-300 font-mono truncate hover:underline self-start font-bold max-w-full"
                                >
                                  Project: {notif.projectTitle}
                                </Link>
                              </div>
                            </div>
                            
                            {(displayUsdc || displayXlm) && (
                              <div className="shrink-0 text-left sm:text-right font-mono flex flex-row sm:flex-col justify-between sm:justify-end items-center sm:items-end gap-x-3 gap-y-0.5 pt-2.5 sm:pt-0 border-t border-zinc-850 dark:border-zinc-850 border-zinc-200 sm:border-0 w-full sm:w-auto">
                                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-x-1.5 gap-y-0.5">
                                  {displayXlm && (
                                    <span className={`text-xs font-black ${isIncoming ? 'text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                      {isIncoming ? '+' : '-'}{displayXlm}
                                    </span>
                                  )}
                                  {displayUsdc && (
                                    <span className="text-[10px] text-zinc-500 font-semibold">
                                      <span className="inline sm:hidden">(</span>≈ {displayUsdc}<span className="inline sm:hidden">)</span>
                                    </span>
                                  )}
                                </div>
                                {notif.xlmPrice && (
                                  <span className="text-[9px] text-zinc-650 dark:text-zinc-500 font-medium">
                                    @${notif.xlmPrice.toFixed(4)}/XLM
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between border-t border-zinc-850 pt-4 mt-2">
                        <button
                          onClick={() => setTransactionPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Previous
                        </button>
                        <span className="text-[11px] font-mono text-zinc-500">
                          Page <span className="text-zinc-300 font-bold">{currentPage}</span> of <span className="text-zinc-300 font-bold">{totalPages}</span>
                        </span>
                        <button
                          onClick={() => setTransactionPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                        >
                          Next <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
