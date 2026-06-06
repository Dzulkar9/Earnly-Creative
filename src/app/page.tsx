'use client';

import { useState, useEffect } from 'react';
import Header from '@/app/components/Header';
import NetworkBackground from '@/app/components/NetworkBackground';
import { getCampaign, CampaignState, isMockMode } from '@/lib/stellar';
import { ProjectMetadata } from '@/lib/db';
import {
  ArrowUpRight,
  Plus,
  Landmark,
  Award,
  ShieldCheck,
  Clock,
  Sparkles,
  RefreshCw,
  ShoppingBag,
  Briefcase,
  Wallet
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence, Variants } from 'framer-motion';

// Framer Motion staggered transition variants
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

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [blockchainStates, setBlockchainStates] = useState<Record<number, CampaignState>>({});
  const [loading, setLoading] = useState(true);
  const [mockModeActive, setMockModeActive] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'instant' | 'crowdfund' | 'escrow'>('all');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [tickerIndex, setTickerIndex] = useState(0);

  const tickerEvents = [
    "🚀 Stellar Network is operational - Soroban smart contracts active.",
    "🛡️ ISO 42001 Compliance Gating successfully verified for all active escrow pools.",
    "🔒 Local Zero-Knowledge Proof generated and verified for compliance audit logs."
  ];

  const topCreators = [
    {
      address: 'GB_CREATOR_ADDRESS_STW_NORTHGATE',
      name: 'Astrid Vlachakis',
      role: 'Compliance Admin',
      avatarColor: 'from-indigo-655 to-purple-650',
      projectsCount: 12,
      successRate: 100,
    },
    {
      address: 'GB_CONTRIBUTOR_1_STW_NORTHGATE',
      name: 'Cormac Aleixo',
      role: 'Platform VIP Creator',
      avatarColor: 'from-emerald-500 to-teal-600',
      projectsCount: 8,
      successRate: 92,
    },
    {
      address: 'GB_GUEST_ADDRESS_STW_NORTHGATE',
      name: 'Idoia Marchetti',
      role: 'Verified Seller',
      avatarColor: 'from-pink-600 to-rose-650',
      projectsCount: 5,
      successRate: 100,
    }
  ];

  const faqItems = [
    {
      q: "Bagaimana cara bertransaksi di website Earnly?",
      a: "Website Earnly menggunakan Web3 untuk bertransaksi. Anda dapat bertransaksi dengan menggunakan wallet seperti Freight Wallet, Stellar Desktop Client, atau wallet berbasis Web3 lainnya."
    },
    {
      q: "Bagaimana cara kerja escrow milestone di Earnly?",
      a: "Untuk project Custom Milestone, pembeli mengunci 100% dari total anggaran di dalam smart contract escrow Stellar. Dana tersebut akan dicairkan secara bertahap kepada pembuat project (creator) hanya setelah pembeli menyetujui hasil kerja dari setiap fase/milestone secara manual."
    },
    {
      q: "Apakah ZK-Identity (Zero Knowledge) aman untuk privasi saya?",
      a: "Sangat aman. Earnly menggunakan bukti Zero-Knowledge secara lokal di browser Anda untuk memverifikasi keabsahan identitas Anda (misal KTP/KTM) tanpa menyimpan nomor identitas asli di server kami maupun di blockchain publik Stellar. Hanya hash matematis yang tercatat."
    },
    {
      q: "Bagaimana jika target pendanaan crowdfunding tidak tercapai?",
      a: "Jika target pendanaan pada Category A (Crowdfunded Pool) tidak terpenuhi sebelum melewati batas waktu (deadline), seluruh dana yang telah dikontribusikan oleh para pendukung dapat ditarik kembali secara utuh (refund 100%) melalui smart contract tanpa potongan biaya."
    }
  ];

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data: ProjectMetadata[] = await res.json();
        setProjects(data);

        // Fetch on-chain states for each project
        const states: Record<number, CampaignState> = {};
        for (const p of data) {
          try {
            const state = await getCampaign(p.id);
            if (state) {
              states[p.id] = state;
            }
          } catch (err) {
            console.error(`Error fetching chain state for project ${p.id}:`, err);
          }
        }
        setBlockchainStates(states);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMockModeActive(isMockMode());
    fetchProjects();

    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerEvents.length);
    }, 4000);

    window.addEventListener('walletChange', fetchProjects);
    return () => {
      window.removeEventListener('walletChange', fetchProjects);
      clearInterval(interval);
    };
  }, []);

  // Filter projects based on active filter tab
  const getFilteredProjects = () => {
    let list = [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Filter out completed or aborted projects
    list = list.filter(p => {
      const chainState = blockchainStates[p.id];
      if (chainState && (chainState.is_completed || chainState.is_aborted)) {
        return false;
      }
      return true;
    });

    if (activeFilter === 'instant') {
      return list.filter(p => p.projectType === 0);
    } else if (activeFilter === 'crowdfund') {
      return list.filter(p => p.projectType === 1);
    } else if (activeFilter === 'escrow') {
      return list.filter(p => p.projectType === 2);
    }
    return list;
  };

  const filteredProjects = getFilteredProjects().slice(0, 3);
  const totalVolume = Object.values(blockchainStates).reduce((acc, curr) => acc + curr.pledged_amount, 0);
  const activeCampaignsCount = projects.filter(p => {
    const chainState = blockchainStates[p.id];
    if (chainState && (chainState.is_completed || chainState.is_aborted)) {
      return false;
    }
    return true;
  }).length;
  const completedCampaignsCount = Object.values(blockchainStates).filter(c => c.is_completed).length;

  return (
    <div className="flex-1 flex flex-col min-h-screen relative overflow-hidden bg-radial-glow bg-grid-pattern">
      <NetworkBackground />
      {/* Decorative Blur Blobs */}
      <motion.div
        animate={{
          x: [0, 45, -20, 0],
          y: [0, -50, 30, 0],
          scale: [1, 1.15, 0.9, 1],
          opacity: [0.35, 0.5, 0.25, 0.35]
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-24 left-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10 hidden md:block"
      />
      <motion.div
        animate={{
          x: [0, -50, 35, 0],
          y: [0, 45, -25, 0],
          scale: [1, 0.9, 1.12, 1],
          opacity: [0.25, 0.45, 0.2, 0.25]
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5
        }}
        className="absolute top-80 right-20 w-[450px] h-[450px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none -z-10 hidden md:block"
      />

      <Header />

      {/* Dynamic Network Live Ticker */}
      <div className="w-full bg-zinc-950/60 backdrop-blur-md border-b border-zinc-900/50 py-3.5 px-4 overflow-hidden relative flex items-center justify-center">
        <div className="max-w-7xl w-full flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2 font-semibold text-indigo-400 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="text-zinc-400 font-semibold shrink-0 hidden sm:inline">Live Activity Log:</span>
            <span className="text-zinc-400 font-semibold shrink-0 sm:hidden">Live:</span>
          </div>
          <div className="flex-1 text-center font-medium overflow-hidden h-4 relative mx-4 min-w-0">
            <span
              className="absolute left-0 right-0 transition-all duration-500 ease-out transform truncate"
              style={{
                opacity: 1,
                transform: 'translateY(0)'
              }}
              key={tickerIndex}
            >
              {tickerEvents[tickerIndex]}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono shrink-0">
            Stellar-Soroban
          </span>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 md:px-8 py-8 md:py-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-12 md:gap-20"
        >
          {/* Welcome Hero & Stats Section in Unified Bento Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Welcome Hero Card */}
            <motion.section
              variants={itemVariants}
              whileHover={{ y: -2 }}
              className="lg:col-span-2 relative rounded-2xl sm:rounded-3xl overflow-hidden backdrop-blur-xl bg-zinc-900/35 border border-white/10 p-5 sm:p-8 md:p-12 flex flex-col justify-between gap-6 sm:gap-8 shadow-[0_12px_40px_rgba(0,0,0,0.3)] hover:border-white/15 transition-all duration-300 shimmer-sweep group"
            >
              <div className="absolute inset-0 bg-radial-purple opacity-40 pointer-events-none"></div>
              <div className="flex-1 flex flex-col gap-5 relative z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold self-start">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Soroban-Powered Milestone Marketplace on Stellar</span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight text-white leading-[1.15]">
                  Sell Your Digital Assets <br className="hidden sm:block" />
                  <span className="text-indigo-400">
                    on a Decentralized Hub
                  </span>
                </h1>
                <p className="text-sm md:text-base text-zinc-400 max-w-xl leading-relaxed">
                  Earnly Creative lets you trade digital assets instantly, pool funds for upcoming releases, or secure custom services using smart contract milestones.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-3.5 relative z-10 mt-4 sm:mt-6">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/create"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 sm:px-6 py-3 rounded-xl glow-primary flex items-center justify-center gap-2 transition duration-300 w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4" /> Start New Project
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/projects"
                    className="bg-zinc-950/60 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-bold text-sm px-5 sm:px-6 py-3 rounded-xl transition duration-300 flex items-center justify-center gap-1.5 w-full sm:w-auto"
                  >
                    Explore Catalog <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              </div>
            </motion.section>

            {/* Stats Bento Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4">
              {/* Card 1: Total Volume */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                className="bg-zinc-900/35 backdrop-blur-xl p-5 rounded-2xl border border-white/10 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300 shadow-lg"
              >
                <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                <div className="flex items-center justify-between mb-2">
                  <Landmark className="w-5 h-5 text-indigo-400" />
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Volume</span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5">Total Volume</span>
                  <span className="text-xl md:text-2xl font-black text-white font-mono">{Math.round(totalVolume)} USDC</span>
                </div>
              </motion.div>

              {/* Card 2: Total Items */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                className="bg-zinc-900/35 backdrop-blur-xl p-5 rounded-2xl border border-white/10 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300 shadow-lg"
              >
                <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                <div className="flex items-center justify-between mb-2">
                  <Plus className="w-5 h-5 text-indigo-400" />
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Listings</span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5">Total Items</span>
                  <span className="text-xl md:text-2xl font-black text-white font-mono">{activeCampaignsCount}</span>
                </div>
              </motion.div>

              {/* Card 3: Completed Deals */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                className="bg-zinc-900/35 backdrop-blur-xl p-5 rounded-2xl border border-white/10 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300 shadow-lg"
              >
                <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                <div className="flex items-center justify-between mb-2">
                  <Award className="w-5 h-5 text-indigo-400" />
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Settlements</span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5">Completed Deals</span>
                  <span className="text-xl md:text-2xl font-black text-white font-mono">{completedCampaignsCount}</span>
                </div>
              </motion.div>

              {/* Card 4: Compliance Gating */}
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                className="bg-zinc-900/35 backdrop-blur-xl p-5 rounded-2xl border border-white/10 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300 shadow-lg"
              >
                <div className="absolute inset-0 bg-emerald-600/5 opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                <div className="flex items-center justify-between mb-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider font-mono">Stillwater Audited</span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-0.5">Compliance Gating</span>
                  <span className="text-xs font-black text-emerald-400 uppercase font-sans tracking-wide">ISO 42001 Active</span>
                </div>
              </motion.div>
            </div>
          </div>

          {/* HOW IT WORKS SECTION - Bento Grid Card System */}
          <motion.section variants={itemVariants} className="flex flex-col gap-10">
            <div className="text-center flex flex-col items-center gap-3">
              <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">How Earnly Creative Works</h2>
              <p className="text-sm text-zinc-400 max-w-xl font-sans leading-relaxed">
                We offer two main categories of digital distribution with customized smart contract flows for sellers and clients.
              </p>
            </div>

            <motion.div
              variants={containerVariants}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {/* Card 1 */}
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -6, scale: 1.02 }}
                className="bg-zinc-900/35 backdrop-blur-xl border border-white/10 p-8 rounded-3xl flex flex-col gap-4 hover:border-emerald-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl"
                style={{ boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.3)' }}
              >
                <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 pointer-events-none"></div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-white text-lg">Instant Buy</h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                  Purchase finalized design files, templates, or code bases directly. Payments bypass contract escrow and go straight to verified creators, instantly unlocking download keys.
                </p>
              </motion.div>

              {/* Card 2 */}
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -6, scale: 1.02 }}
                className="bg-zinc-900/35 backdrop-blur-xl border border-white/10 p-8 rounded-3xl flex flex-col gap-4 hover:border-indigo-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl"
                style={{ boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.3)' }}
              >
                <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 pointer-events-none"></div>
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold shrink-0">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-white text-lg">Crowdfunded Pool</h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                  Backers pool micro-funds together to unlock premium packs. If the target is met before the deadline, funds disburse to the creator and download access opens to all backers.
                </p>
              </motion.div>

              {/* Card 3 */}
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -6, scale: 1.02 }}
                className="bg-zinc-900/35 backdrop-blur-xl border border-white/10 p-8 rounded-3xl flex flex-col gap-4 hover:border-purple-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl"
                style={{ boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.3)' }}
              >
                <div className="absolute top-0 right-0 w-28 h-28 bg-purple-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 pointer-events-none"></div>
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold shrink-0">
                  <Briefcase className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-white text-lg">Custom Milestones</h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                  Commission custom animations, smart contracts, or game mods. The client locks 100% budget in the escrow, which is released progressively only upon manual approval of each phase.
                </p>
              </motion.div>
            </motion.div>
          </motion.section>

          {/* FEATURED PROJECTS SECTION */}
          <motion.section variants={itemVariants} className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-zinc-800/60 pb-6 gap-4">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  Featured Campaigns & Listings
                </h2>
                <p className="text-xs text-zinc-550">Explore smart-contract escrowed products and crowdfunded release pools.</p>
              </div>

              {/* Interactive Filters Tabs */}
              <div className="flex items-center gap-1.5 bg-zinc-950/70 p-1.5 rounded-xl border border-zinc-850 text-xs shrink-0 self-start md:self-auto overflow-x-auto no-scrollbar whitespace-nowrap w-full md:w-auto">
                {(['all', 'instant', 'crowdfund', 'escrow'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all duration-300 uppercase tracking-wider text-[9px] ${activeFilter === filter
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-650/30'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
                      }`}
                  >
                    {filter === 'all' ? 'All Items' :
                      filter === 'instant' ? 'Instant Buy' :
                        filter === 'crowdfund' ? 'Crowdfunds' : 'Escrows'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-zinc-400 text-sm font-medium">Loading campaigns...</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/20 border border-zinc-850 border-dashed rounded-2xl p-8 text-center gap-3">
                <ShoppingBag className="w-10 h-10 text-zinc-600" />
                <h3 className="text-base font-bold text-white">No Listings Found</h3>
                <p className="text-zinc-500 text-xs max-w-sm leading-relaxed">
                  No items match the selected filter category. Create a new listing to start selling!
                </p>
                <Link
                  href="/create"
                  className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl glow-primary flex items-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4" /> Register Product
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                <motion.div
                  variants={containerVariants}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                  {filteredProjects.map((project) => {
                    const chainState = blockchainStates[project.id];
                    const pledged = chainState ? chainState.pledged_amount : 0;

                    let progress = 0;
                    let badgeText = 'Active';
                    let badgeColor = 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20';

                    const isCompleted = chainState ? chainState.is_completed : false;
                    const isAborted = chainState ? chainState.is_aborted : false;
                    const projectType = project.projectType ?? 1;

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

                    const getFriendlyName = (addr: string) => {
                      if (addr === 'GB_CREATOR_ADDRESS_STW_NORTHGATE') return 'Creator';
                      if (addr === 'GB_CONTRIBUTOR_1_STW_NORTHGATE') return 'Backer 1';
                      if (addr === 'GB_CONTRIBUTOR_2_STW_NORTHGATE') return 'Backer 2';
                      return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
                    };

                    return (
                      <motion.div
                        key={project.id}
                        variants={itemVariants}
                        whileHover={{ y: -6, scale: 1.015 }}
                        className="flex flex-col h-full rounded-3xl glass-card overflow-hidden hover-glow-card group shadow-lg border border-white/5 hover:border-white/10 transition-all duration-300 relative cursor-pointer"
                      >
                        {/* Absolute Link overlay */}
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

                          {/* Seller address removed from list card as requested */}
                        </div>

                        {/* Card Body */}
                        <div className="p-6 flex-1 flex flex-col justify-between gap-6 relative z-10 bg-zinc-900/40">
                          <div className="flex flex-col gap-2">
                            <h3 className="font-extrabold text-white text-base group-hover:text-indigo-400 transition line-clamp-1">
                              {project.title}
                            </h3>
                          </div>

                          <div className="flex flex-col gap-4">
                            {projectType === 1 ? (
                              /* Crowdfunded Progress */
                              <div>
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                  <span className="font-semibold text-zinc-555">Crowdfund Progress</span>
                                  <span className="font-bold text-indigo-400 font-mono">{progress}%</span>
                                </div>
                                <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-850">
                                  <div
                                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                  ></div>
                                </div>
                              </div>
                            ) : projectType === 2 ? (
                              /* Custom Escrow Progress (Solid Single Color) */
                              <div>
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                  <span className="font-semibold text-zinc-555">Escrow Milestones</span>
                                  <span className="font-bold text-indigo-400 font-mono">
                                    {chainState ? `${chainState.current_milestone}/${chainState.total_milestones}` : '0/0'}
                                  </span>
                                </div>
                                <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-850">
                                  <div
                                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: chainState && chainState.total_milestones > 0
                                        ? `${(chainState.current_milestone / chainState.total_milestones) * 100}%`
                                        : '0%'
                                    }}
                                  ></div>
                                </div>
                              </div>
                            ) : (
                              /* Instant Buy Progress */
                              <div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-zinc-555">Delivery Access</span>
                                  <span className="font-bold text-emerald-400 font-mono">Instant Unlock</span>
                                </div>
                              </div>
                            )}

                            {/* Details */}
                            <div className="flex justify-between border-t border-zinc-800/40 pt-3.5 text-xs text-zinc-500">
                              {projectType === 0 ? (
                                <>
                                  <div>
                                    <span className="block text-[10px] text-zinc-555 uppercase font-bold tracking-wider mb-0.5">Price</span>
                                    <span className="font-bold text-emerald-450 font-mono text-xs">{project.targetAmount} USDC</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="block text-[10px] text-zinc-555 uppercase font-bold tracking-wider mb-0.5">Delivery</span>
                                    <span className="font-bold text-zinc-350 font-mono text-xs">Immediate</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <span className="block text-[10px] text-zinc-550 uppercase font-bold tracking-wider mb-0.5">Raised</span>
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

                          {/* View Details Action Button */}
                          <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-400 group-hover:text-indigo-300 transition duration-300 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-xl group-hover:bg-zinc-800 group-hover:border-zinc-700/85">
                            <span>View Details</span>
                            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>

                <div className="flex justify-center mt-6 relative z-10">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Link
                      href="/projects"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider px-7 py-4 rounded-xl glow-primary flex items-center gap-1.5 transition-all duration-300"
                    >
                      Explore All Listings ({projects.length}) <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </motion.div>
                </div>
              </div>
            )}
          </motion.section>

          {/* VERIFIED CREATOR SHOWCASE SECTION */}
          <motion.section variants={itemVariants} className="flex flex-col gap-10">
            <div className="text-center flex flex-col items-center gap-3">
              <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">Top Verified Sellers</h2>
              <p className="text-sm text-zinc-400 max-w-xl font-sans leading-relaxed">
                Meet our top creative specialists, fully audited and ZK-verified on-chain under standard compliance protocols.
              </p>
            </div>

            <motion.div
              variants={containerVariants}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {topCreators.map((creator) => (
                <motion.div
                  key={creator.address}
                  variants={itemVariants}
                  whileHover={{ y: -6, scale: 1.015 }}
                  className="bg-zinc-900/35 backdrop-blur-xl border border-white/10 p-6 rounded-3xl flex flex-col gap-4 hover-glow-card group relative overflow-hidden shadow-lg hover:border-white/15 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <motion.div
                      whileHover={{ scale: 1.05, rotate: 2 }}
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${creator.avatarColor} flex items-center justify-center text-white glow-primary border border-white/10 shrink-0 shadow-lg`}
                    >
                      <Wallet className="w-6 h-6" />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-extrabold text-white text-sm truncate flex items-center gap-1.5">
                        {creator.name}
                        <span title="ZK-Identity Verified">
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        </span>
                      </h3>
                      <span className="text-[9px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">
                        {creator.role}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-900/80 text-xs font-sans">
                    <div>
                      <span className="block text-[9px] text-zinc-500 uppercase">Active Listings</span>
                      <span className="font-bold text-white font-mono">{creator.projectsCount} items</span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-zinc-500 uppercase">Success Rate</span>
                      <span className="font-bold text-emerald-400 font-mono">{creator.successRate}%</span>
                    </div>
                  </div>

                  <motion.div whileTap={{ scale: 0.97 }}>
                    <Link
                      href={`/profile/${creator.address}`}
                      className="w-full bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white font-bold text-xs py-3 rounded-xl text-center transition block"
                    >
                      View Profile
                    </Link>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          {/* INTERACTIVE FAQ SECTION */}
          <motion.section variants={itemVariants} className="flex flex-col gap-10 max-w-3xl w-full mx-auto">
            <div className="text-center flex flex-col items-center gap-3">
              <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">Frequently Asked Questions</h2>
              <p className="text-sm text-zinc-400 font-sans text-center leading-relaxed">Everything you need to know about Earnly Creative distribution models.</p>
            </div>

            <div className="flex flex-col gap-4">
              {faqItems.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className={`bg-zinc-900/20 border rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? 'border-indigo-500/35 bg-zinc-900/35' : 'border-zinc-850'
                      }`}
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full flex items-center justify-between text-left p-5 focus:outline-none"
                    >
                      <span className="font-bold text-white text-sm md:text-base">{item.q}</span>
                      <span className="text-zinc-500 font-bold transition-transform duration-300 transform" style={{
                        transform: isOpen ? 'rotate(45deg)' : 'rotate(0)'
                      }}>
                        <Plus className="w-5 h-5 text-indigo-400" />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 text-xs md:text-sm text-zinc-400 leading-relaxed border-t border-zinc-900/50 pt-4 bg-zinc-950/20 font-sans">
                            {item.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.section>
        </motion.div>
      </main>

      {/* Premium Footer */}
      <footer className="mt-auto border-t border-zinc-900 bg-zinc-950/40 backdrop-blur-md px-4 sm:px-6 py-5 sm:py-6 text-center text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        <div>
          <span>© 2026 Earnly Creative. Powered by Stellar Soroban.</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">
            Stellar Network OK
          </span>
          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">
            Soroban Runtime v26
          </span>
        </div>
      </footer>
    </div>
  );
}
