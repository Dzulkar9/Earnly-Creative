'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import {
  getCampaign,
  getMockBalances,
  CampaignState,
  isMockMode,
  getTokenBalance
} from '@/lib/stellar';
import { ProjectMetadata } from '@/lib/db';
import {
  Wallet,
  Landmark,
  Award,
  ArrowUpRight,
  Coins,
  FolderGit2,
  RefreshCw,
  ArrowLeft,
  Lock,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';

// Framer Motion layout transition variants
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

export default function CreatorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;

  const [balances, setBalances] = useState<Record<string, number>>({});
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [blockchainStates, setBlockchainStates] = useState<Record<number, CampaignState>>({});
  const [loading, setLoading] = useState(true);
  const [loggedInAddress, setLoggedInAddress] = useState<string>('');

  const loadData = async () => {
    if (!address) return;
    try {
      setLoading(true);
      if (isMockMode()) {
        const mockBals = await getMockBalances();
        setBalances(mockBals);
      } else {
        const bal = await getTokenBalance(address);
        setBalances({ [address]: bal });
      }

      const activeAddr = typeof window !== 'undefined' ? (localStorage.getItem('earnly_wallet_address') || '') : '';
      setLoggedInAddress(activeAddr);

      const res = await fetch('/api/projects');
      if (res.ok) {
        const allProjects: ProjectMetadata[] = await res.json();
        // Filter projects created by this address
        const creatorProjects = allProjects.filter(
          (p) => p.creatorAddress.toLowerCase() === address.toLowerCase()
        );
        setProjects(creatorProjects);

        const states: Record<number, CampaignState> = {};
        for (const p of creatorProjects) {
          try {
            const state = await getCampaign(p.id);
            if (state) {
              states[p.id] = state;
            }
          } catch (err) {
            console.error(`Error loading state for project ${p.id}:`, err);
          }
        }
        setBlockchainStates(states);
      }
    } catch (err) {
      console.error('Error loading creator profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('walletChange', loadData);
    return () => {
      window.removeEventListener('walletChange', loadData);
    };
  }, [address]);

  // Calculate statistics
  const isOwner = loggedInAddress.toLowerCase() === address.toLowerCase();
  const currentBalance = balances[address] ?? null;
  const totalCreated = projects.length;

  // Total funds collected across all projects
  const totalCollected = Object.values(blockchainStates).reduce(
    (acc, curr) => acc + curr.pledged_amount,
    0
  );

  const completedCount = Object.values(blockchainStates).filter(
    (c) => c.is_completed
  ).length;

  const successRate = totalCreated > 0 ? Math.round((completedCount / totalCreated) * 100) : 0;

  // Friendly names for simulated accounts
  const getFriendlyRole = (addr: string) => {
    if (addr === 'GB_CREATOR_ADDRESS_STW_NORTHGATE') return 'Compliance Admin';
    if (addr === 'GB_CONTRIBUTOR_1_STW_NORTHGATE') return 'VIP Supporter';
    if (addr === 'GB_CONTRIBUTOR_2_STW_NORTHGATE') return 'Platform Supporter';
    if (addr === 'GB_GUEST_ADDRESS_STW_NORTHGATE') return 'External Auditor';
    return 'Stellar Network Member';
  };

  // Generate avatar gradient
  const getAvatarGradient = (addr: string) => {
    let hash = 0;
    for (let i = 0; i < addr.length; i++) {
      hash = addr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      'from-indigo-650 to-purple-650',
      'from-emerald-600 to-teal-600',
      'from-rose-600 to-orange-600',
      'from-cyan-600 to-blue-600',
      'from-amber-500 to-red-600',
      'from-pink-600 to-purple-800'
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 md:px-8 py-6 sm:py-8">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-8"
        >
          {/* Navigation */}
          <motion.div variants={itemVariants}>
            <motion.button
              onClick={() => router.back()}
              whileHover={{ x: -4 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </motion.button>
          </motion.div>

          {/* PROFILE BANNER - Frosted Glass Bento Card */}
          <motion.section 
            variants={itemVariants}
            className="relative rounded-xl sm:rounded-2xl overflow-hidden backdrop-blur-xl bg-zinc-900/40 border border-white/10 p-4 sm:p-6 md:p-8 flex flex-col md:flex-row items-center gap-4 sm:gap-6 shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:border-white/15 transition duration-300"
          >
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 2 }}
              whileTap={{ scale: 0.95 }}
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getAvatarGradient(address)} flex items-center justify-center text-white glow-primary border border-white/10 shrink-0 shadow-lg cursor-pointer`}
            >
              <Wallet className="w-8 h-8" />
            </motion.div>
            
            <div className="flex-1 flex flex-col gap-1.5 text-center md:text-left min-w-0">
              <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-2">
                <h1 className="text-lg sm:text-xl md:text-2xl font-black text-white truncate max-w-[200px] sm:max-w-md" title={address}>
                  {address}
                </h1>
                <span className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                  {getFriendlyRole(address)}
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-mono break-all max-w-xl">
                Stellar Address: {address}
              </p>
            </div>
            
            <div className="flex items-center gap-2 self-stretch md:self-auto justify-center">
              <motion.button
                onClick={loadData}
                whileHover={{ scale: 1.05, rotate: 15 }}
                whileTap={{ scale: 0.95 }}
                className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-850/80 transition shadow-inner"
                title="Sync Data"
              >
                <RefreshCw className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.section>

          {/* DASHBOARD STATS CARD GRID - Bento Box layout */}
          <motion.section 
            variants={containerVariants}
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
          >
            {/* Balance Card */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-zinc-900/40 backdrop-blur-md p-5 rounded-2xl border border-white/5 flex flex-col gap-1.5 bg-gradient-to-br from-zinc-900/50 to-indigo-950/10 relative overflow-hidden group shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-white/10 transition duration-300"
            >
              <div className="flex items-center justify-between">
                <Coins className="w-5 h-5 text-indigo-400" />
                {!isOwner && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-950/40 border border-zinc-850/40 px-2 py-0.5 rounded-full font-sans">
                    <Lock className="w-3 h-3 text-zinc-500" /> Private
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Mock Balance</span>
              <span className="text-2xl font-black text-white font-mono mt-1">
                {isOwner && currentBalance !== null ? `${currentBalance.toFixed(2)} USDC` : '••••••'}
              </span>
            </motion.div>

            {/* Total Raised Card */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-zinc-900/40 backdrop-blur-md p-5 rounded-2xl border border-white/5 flex flex-col gap-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-white/10 transition duration-300"
            >
              <Landmark className="w-5 h-5 text-indigo-400" />
              <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Total Raised</span>
              <span className="text-2xl font-black text-white font-mono mt-1">{Math.round(totalCollected)} USDC</span>
            </motion.div>

            {/* Listings Created Card */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-zinc-900/40 backdrop-blur-md p-5 rounded-2xl border border-white/5 flex flex-col gap-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-white/10 transition duration-300"
            >
              <FolderGit2 className="w-5 h-5 text-indigo-400" />
              <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Listings Created</span>
              <span className="text-2xl font-black text-white font-mono mt-1">{totalCreated}</span>
            </motion.div>

            {/* Success Rate Card */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-zinc-900/40 backdrop-blur-md p-5 rounded-2xl border border-white/5 flex flex-col gap-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-white/10 transition duration-300"
            >
              <Award className="w-5 h-5 text-indigo-400" />
              <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Success Rate</span>
              <span className="text-2xl font-black text-white font-mono mt-1">{successRate}%</span>
            </motion.div>
          </motion.section>

          {/* PROJECTS LISTINGS SECTION */}
          <motion.section variants={itemVariants} className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Creator Listings ({totalCreated})
              </h2>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-zinc-400 text-sm font-medium">Syncing ledger...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-zinc-900/10 border border-zinc-850 border-dashed rounded-xl p-8 text-center gap-3">
                <FolderGit2 className="w-10 h-10 text-zinc-700" />
                <h3 className="text-base font-bold text-white">No Active Listings</h3>
                <p className="text-zinc-500 text-xs max-w-sm leading-relaxed">
                  This creator has not registered any products or escrow projects yet.
                </p>
              </div>
            ) : (
              <motion.div 
                variants={containerVariants}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8"
              >
                {projects.map((project) => {
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
                          <span>View Details</span>
                          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.section>
        </motion.div>
      </main>
    </div>
  );
}
