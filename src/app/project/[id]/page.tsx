'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import {
  getCampaign,
  pledgeFunds,
  voteMilestone,
  claimMilestoneFunds,
  claimRefund,
  abortCampaign,
  completeCampaign,
  simulateTimePass,
  getVoteTally,
  getContributorPledge,
  getContributorVote,
  CampaignState,
  VoteTally,
  isMockMode
} from '@/lib/stellar';
import { ProjectMetadata } from '@/lib/db';
import { addNotification } from '@/lib/notifications';
import {
  Coins,
  CheckCircle2,
  XCircle,
  Download,
  AlertTriangle,
  Loader2,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Lock,
  Unlock,
  ShieldCheck,
  FileArchive,
  ArrowLeft,
  User,
  CheckCircle,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import NetworkBackground from '@/app/components/NetworkBackground';
import { motion, AnimatePresence, Variants } from 'framer-motion';

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

export default function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);

  // States
  const [project, setProject] = useState<ProjectMetadata | null>(null);
  const [chainState, setChainState] = useState<CampaignState | null>(null);
  const [voteTally, setVoteTally] = useState<VoteTally | null>(null);
  const [userPledge, setUserPledge] = useState<number>(0);
  const [userVote, setUserVote] = useState<boolean | null>(null);

  const [walletAddress, setWalletAddress] = useState<string>('');
  const [pledgeAmount, setPledgeAmount] = useState('50');

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const imageUrls = project?.imageUrl ? project.imageUrl.split(',').filter(Boolean) : [];
  const displayImages = imageUrls.length > 0 ? imageUrls : ["/MockProducts.png"];

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [xlmPrice, setXlmPrice] = useState<number>(0.11);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    desc: string;
    amount: number;
    action: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    const fetchXlmPrice = async () => {
      try {
        const res = await fetch('https://api.coinbase.com/v2/prices/XLM-USD/spot');
        if (res.ok) {
          const json = await res.json();
          const price = Number(json.data.amount);
          if (price > 0) setXlmPrice(price);
        }
      } catch (err) {
        console.warn('Failed to fetch live XLM price from Coinbase:', err);
      }
    };
    fetchXlmPrice();
  }, []);

  const loadAllData = async () => {
    try {
      const activeAddr = localStorage.getItem('earnly_wallet_address') || '';
      setWalletAddress(activeAddr);

      // Fetch local DB metadata
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        throw new Error('Project metadata not found in database');
      }
      const meta: ProjectMetadata = await res.json();
      setProject(meta);

      // Fetch on-chain state
      const state = await getCampaign(projectId);
      setChainState(state);

      if (state) {
        // Fetch vote tally for the current milestone
        const tally = await getVoteTally(projectId, state.current_milestone);
        setVoteTally(tally);

        // Fetch user pledge & vote if wallet connected
        if (activeAddr) {
          const pledge = await getContributorPledge(projectId, activeAddr);
          setUserPledge(pledge);

          const vote = await getContributorVote(projectId, state.current_milestone, activeAddr);
          setUserVote(vote);
        }
      }
    } catch (err) {
      console.error('Error fetching project details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();

    // Listen for wallet changes
    const handleWalletChange = () => {
      loadAllData();
    };

    window.addEventListener('walletChange', handleWalletChange);
    return () => {
      window.removeEventListener('walletChange', handleWalletChange);
    };
  }, [projectId]);

  const handlePledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      alert('Please connect your Freighter wallet or switch mock account in the top-right.');
      return;
    }
    const amt = Number(pledgeAmount);
    if (isNaN(amt) || amt < 0.5) {
      alert('Minimum contribution amount is 0.5 USDC.');
      return;
    }

    setConfirmModalConfig({
      title: 'Authorize Crowdfund Pledge',
      desc: 'You are submitting a crowdfund contribution. Funds will be held securely in the campaign escrow contract until targets are met or milestones are voted on.',
      amount: amt,
      action: async () => {
        try {
          setActionLoading(true);
          const xlmEquiv = amt / xlmPrice;
          await pledgeFunds(projectId, amt, walletAddress, xlmPrice);
          addNotification(
            'pledge',
            projectId,
            project?.title || '',
            walletAddress,
            `${getFriendlyName(walletAddress)} contributed ${amt} USDC (~${xlmEquiv.toFixed(2)} XLM) to Project #${projectId}`,
            amt,
            xlmEquiv,
            xlmPrice
          );
          alert('Payment / pledge transaction successfully recorded on-chain!');
          setPledgeAmount('50');
          await loadAllData();
        } catch (err: any) {
          alert(err.message || 'Transaction failed to broadcast');
        } finally {
          setActionLoading(false);
        }
      }
    });
    setConfirmModalOpen(true);
  };

  const handleBuyInstant = async () => {
    if (!walletAddress) {
      alert('Please connect your Freighter wallet or switch mock account in the top-right.');
      return;
    }
    if (!project) return;
    const amt = project.targetAmount;

    setConfirmModalConfig({
      title: 'Authorize Instant Purchase',
      desc: 'You are making a direct purchase of this digital asset. Deliverable files will be unlocked for download immediately upon block validation.',
      amount: amt,
      action: async () => {
        try {
          setActionLoading(true);
          const xlmEquiv = amt / xlmPrice;
          await pledgeFunds(projectId, amt, walletAddress, xlmPrice);
          addNotification(
            'purchase',
            projectId,
            project.title,
            walletAddress,
            `${getFriendlyName(walletAddress)} purchased ${project.title} for ${project.targetAmount} USDC (~${xlmEquiv.toFixed(2)} XLM)`,
            project.targetAmount,
            xlmEquiv,
            xlmPrice
          );
          alert('Purchase successful! Creative files unlocked for download.');
          await loadAllData();
        } catch (err: any) {
          alert(err.message || 'Instant purchase failed');
        } finally {
          setActionLoading(false);
        }
      }
    });
    setConfirmModalOpen(true);
  };

  const handleLockBudget = async () => {
    if (!walletAddress) {
      alert('Please connect your Freighter wallet.');
      return;
    }
    if (!project) return;
    const amt = project.targetAmount;

    setConfirmModalConfig({
      title: 'Authorize Escrow Budget Lock',
      desc: 'You are locking the project budget into the campaign escrow smart contract. Funds will be disbursed dynamically to the creator upon milestone approvals.',
      amount: amt,
      action: async () => {
        try {
          setActionLoading(true);
          const xlmEquiv = amt / xlmPrice;
          await pledgeFunds(projectId, amt, walletAddress, xlmPrice);
          addNotification(
            'lock_budget',
            projectId,
            project.title,
            walletAddress,
            `${getFriendlyName(walletAddress)} locked ${project.targetAmount} USDC (~${xlmEquiv.toFixed(2)} XLM) budget in Escrow`,
            project.targetAmount,
            xlmEquiv,
            xlmPrice
          );
          alert('Escrow budget successfully locked in contract! Project status set to Active.');
          await loadAllData();
        } catch (err: any) {
          alert(err.message || 'Failed to lock budget');
        } finally {
          setActionLoading(false);
        }
      }
    });
    setConfirmModalOpen(true);
  };

  const handleVote = async (approve: boolean) => {
    if (!walletAddress) return;
    try {
      setActionLoading(true);
      await voteMilestone(projectId, approve, walletAddress);
      addNotification(
        'milestone_vote',
        projectId,
        project?.title || '',
        walletAddress,
        `${getFriendlyName(walletAddress)} voted ${approve ? 'APPROVE' : 'REJECT'} on Milestone #${(chainState?.current_milestone ?? 0) + 1}`
      );
      alert(`Vote successfully registered: ${approve ? 'APPROVED' : 'REVISION REQUESTED'}`);
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to save milestone approval vote');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaimFunds = async () => {
    if (!walletAddress) return;
    try {
      setActionLoading(true);
      await claimMilestoneFunds(projectId, walletAddress);
      // Calculate milestone payout amount for notification
      const milestonePayoutUsdc = chainState ? chainState.pledged_amount - chainState.funds_withdrawn : 0;
      const milestonePayoutXlm = milestonePayoutUsdc / xlmPrice;
      addNotification(
        'milestone_claim',
        projectId,
        project?.title || '',
        walletAddress,
        `Creator claimed ${milestonePayoutUsdc.toFixed(2)} USDC (~${milestonePayoutXlm.toFixed(2)} XLM) payout for Milestone #${(chainState?.current_milestone ?? 0) + 1}`,
        milestonePayoutUsdc,
        milestonePayoutXlm,
        xlmPrice
      );
      alert('Milestone payout successfully claimed and transferred to your wallet!');
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Disbursement failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!walletAddress) return;
    try {
      setActionLoading(true);
      await claimRefund(projectId, walletAddress);
      const refundXlm = userPledge / xlmPrice;
      addNotification(
        'refund',
        projectId,
        project?.title || '',
        walletAddress,
        `${getFriendlyName(walletAddress)} claimed ${userPledge.toFixed(2)} USDC (~${refundXlm.toFixed(2)} XLM) refund from Project #${projectId}`,
        userPledge,
        refundXlm,
        xlmPrice
      );
      alert('Funds successfully returned to your wallet balance!');
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Claim refund failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAbort = async () => {
    if (!confirm('Are you sure you want to abort this project? All remaining locked funds will be returned to contributors proportionally.')) return;
    try {
      setActionLoading(true);
      await abortCampaign(projectId, walletAddress);
      addNotification(
        'abort',
        projectId,
        project?.title || '',
        walletAddress,
        `Creator aborted Project #${projectId}`
      );
      alert('Project aborted. Buyers/Contributors can now claim proportional refunds.');
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to abort project');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteCampaign = async () => {
    if (!walletAddress) return;
    try {
      setActionLoading(true);
      await completeCampaign(projectId, walletAddress);
      addNotification(
        'complete',
        projectId,
        project?.title || '',
        walletAddress,
        `Project #${projectId} completed successfully!`
      );
      alert('Project manually marked as completed! Client can now download files.');
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to complete project');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFastForward = async () => {
    try {
      setActionLoading(true);
      await simulateTimePass(projectId, 3 * 24 * 60 * 60 + 10);
      alert('Fast forwarded simulation time by 3 days. Status updated.');
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to accelerate time');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = () => {
    if (!walletAddress) {
      alert('Please connect your Freighter wallet.');
      return;
    }
    // Stream download from gated API
    window.open(`/api/download/${projectId}?address=${walletAddress}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-zinc-400 text-sm font-semibold">Connecting to Stellar network...</p>
        </div>
      </div>
    );
  }

  if (!project || !chainState) {
    return (
      <div className="flex-1 flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
          <XCircle className="w-12 h-12 text-rose-500" />
          <h2 className="text-lg font-bold text-white">Project Not Found</h2>
          <p className="text-zinc-500 text-sm max-w-sm">No contract with ID {projectId} exists on-chain.</p>
          <Link href="/" className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-4 py-2 rounded-lg text-xs mt-2 transition">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const projectType = project.projectType ?? 1;
  const isCreator = walletAddress.toLowerCase() === project.creatorAddress.toLowerCase() || (walletAddress.startsWith('GB_CREATOR_') && project.creatorAddress.startsWith('GB_CREATOR_'));
  const clientAddressResolved = chainState?.client || project.clientAddress;
  const isClient = !!(
    walletAddress &&
    clientAddressResolved &&
    walletAddress.toLowerCase() === clientAddressResolved.toLowerCase() &&
    clientAddressResolved.toLowerCase() !== project.creatorAddress.toLowerCase()
  );

  // Helper variables
  const progress = Math.min(Math.round((chainState.pledged_amount / project.targetAmount) * 100), 100);
  const targetMet = chainState.pledged_amount >= project.targetAmount;
  const isExpired = Math.floor(Date.now() / 1000) >= chainState.deadline;

  // Calculate remaining days
  const nowSec = Math.floor(Date.now() / 1000);
  const diffTime = chainState.deadline - nowSec;
  const daysLeft = Math.max(Math.ceil(diffTime / (24 * 60 * 60)), 0);

  // Voting metrics
  const yesVotes = voteTally ? voteTally.yes_votes : 0;
  const noVotes = voteTally ? voteTally.no_votes : 0;
  const yesPercent = chainState.pledged_amount > 0 ? Math.round((yesVotes / chainState.pledged_amount) * 100) : 0;
  const noPercent = chainState.pledged_amount > 0 ? Math.round((noVotes / chainState.pledged_amount) * 100) : 0;

  // Access check
  const hasAccess = isCreator || userPledge > 0;

  let categoryBadgeText = 'Crowdfund Pool';
  let categoryBadgeColor = 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
  let statusBadgeText = 'Funding';
  let statusBadgeColor = 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';

  if (projectType === 0) {
    categoryBadgeText = 'Instant Buy';
    categoryBadgeColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    statusBadgeText = 'Ready';
    statusBadgeColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
  } else if (projectType === 2) {
    categoryBadgeText = 'Custom Escrow';
    categoryBadgeColor = 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    if (chainState.pledged_amount === 0) {
      statusBadgeText = 'Awaiting Deposit';
      statusBadgeColor = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    } else if (chainState.is_completed) {
      statusBadgeText = 'Completed';
      statusBadgeColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    } else if (chainState.is_aborted) {
      statusBadgeText = 'Aborted';
      statusBadgeColor = 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
    } else {
      statusBadgeText = 'In Progress';
      statusBadgeColor = 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
    }
  } else {
    if (chainState.is_completed) {
      statusBadgeText = 'Finished';
      statusBadgeColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    } else if (chainState.is_aborted) {
      statusBadgeText = 'Aborted';
      statusBadgeColor = 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
    } else if (targetMet) {
      statusBadgeText = 'Target Met';
      statusBadgeColor = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    }
  }

  const getFriendlyName = (addr: string) => {
    if (!addr) return '';
    if (addr === 'GB_CREATOR_ADDRESS_STW_NORTHGATE') return 'Astrid Vlachakis (Creator)';
    if (addr === 'GB_CONTRIBUTOR_1_STW_NORTHGATE') return 'Cormac Aleixo (Backer 1)';
    if (addr === 'GB_CONTRIBUTOR_2_STW_NORTHGATE') return 'Hyun-woo Çelik (Backer 2)';
    if (addr === 'GB_GUEST_ADDRESS_STW_NORTHGATE') return 'Guest Auditor';
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

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
        className="absolute top-24 left-10 w-96 h-96 bg-indigo-650/10 rounded-full blur-[120px] pointer-events-none -z-10 hidden md:block"
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
        className="absolute top-80 right-20 w-[450px] h-[450px] bg-purple-650/10 rounded-full blur-[140px] pointer-events-none -z-10 hidden md:block"
      />

      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 md:px-8 py-8 md:py-16 relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-6 sm:gap-8 md:gap-10"
        >
          {/* Navigation */}
          <motion.div variants={itemVariants}>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-white/10 hover:bg-zinc-900 text-zinc-400 hover:text-white transition duration-300 text-xs font-semibold self-start"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Catalog
            </Link>
          </motion.div>

          {/* Product Image Gallery */}
          <motion.div variants={itemVariants} className="flex flex-col gap-3.5">
            {/* Main Image View */}
            <div
              onClick={() => setLightboxOpen(true)}
              className="w-full h-48 sm:h-64 md:h-80 rounded-3xl overflow-hidden relative border border-white/10 shadow-xl cursor-pointer hover:border-white/20 transition-all duration-300 group"
            >
              <img
                src={displayImages[activeImageIndex]}
                alt={project.title}
                className="w-full h-full object-cover group-hover:scale-[1.015] transition duration-500 pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60"></div>

              {/* Tap to expand hint */}
              <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-semibold !text-white px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1">
                Click to Expand
              </div>
            </div>

            {/* Thumbnail Selectors */}
            {displayImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {displayImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-16 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${activeImageIndex === idx
                      ? 'border-indigo-500 scale-102 shadow-md'
                      : 'border-zinc-800 hover:border-zinc-700 opacity-60 hover:opacity-100'
                      }`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Project Header details & Elegant Price Alignment */}
          <motion.section
            variants={itemVariants}
            className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6 border-b border-zinc-800/60 pb-6 sm:pb-8"
          >
            <div className="flex flex-col gap-3.5 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${categoryBadgeColor}`}>
                  {categoryBadgeText}
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${statusBadgeColor}`}>
                  {statusBadgeText}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono bg-zinc-950 px-2.5 py-0.5 rounded-full border border-zinc-850">
                  Contract: #{projectId}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight">{project.title}</h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500 font-mono">
                <div className="flex items-center gap-1.5 bg-zinc-950/40 px-3 py-1 rounded-full border border-zinc-900">
                  <span className="text-[10px] text-zinc-500 font-sans">Seller:</span>
                  <Link
                    href={`/profile/${project.creatorAddress}`}
                    className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline"
                  >
                    {getFriendlyName(project.creatorAddress)}
                  </Link>
                  {isCreator && <span className="bg-indigo-600/20 text-indigo-400 px-1.5 py-0.2 rounded text-[8px] ml-1 font-bold font-sans uppercase">You</span>}
                </div>

                {projectType === 2 && (
                  <div className="flex items-center gap-1.5 bg-zinc-950/40 px-3 py-1 rounded-full border border-zinc-900">
                    <span className="text-[10px] text-zinc-500 font-sans">Buyer:</span>
                    {clientAddressResolved && clientAddressResolved.toLowerCase() !== project.creatorAddress.toLowerCase() ? (
                      <>
                        <Link
                          href={`/profile/${clientAddressResolved}`}
                          className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline"
                        >
                          {getFriendlyName(clientAddressResolved)}
                        </Link>
                        {isClient && <span className="bg-purple-600/20 text-purple-400 px-1.5 py-0.2 rounded text-[8px] ml-1 font-bold font-sans uppercase">You</span>}
                      </>
                    ) : (
                      <span className="text-amber-400/90 font-bold font-sans">Open to Any Buyer</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Prominent Pricing Block */}
            <div className="flex flex-col items-start lg:items-end gap-1.5 shrink-0 bg-zinc-900/35 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 w-full sm:w-auto sm:min-w-[220px] backdrop-blur-xl shadow-lg">
              <span className="text-[9px] text-zinc-550 uppercase font-bold tracking-wider font-sans">
                {projectType === 0 ? 'Retail Price' : projectType === 1 ? 'Target Fund' : 'Client Budget'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-white font-mono">{project.targetAmount}</span>
                <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">USDC</span>
              </div>
              {projectType === 1 && (
                <div className="text-[10px] text-zinc-450 font-medium mt-1 flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{chainState.is_completed ? 'Completed' : isExpired ? 'Ended' : `${daysLeft} days left`}</span>
                </div>
              )}
            </div>
          </motion.section>

          {/* Action Loader overlay if working */}
          {actionLoading && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center flex-col gap-2">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
              <span className="text-zinc-300 text-sm font-semibold">Broadcasting Stellar Soroban TX...</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8">
            {/* LEFT COLUMN: Details & Milestones */}
            <div className="lg:col-span-2 flex flex-col gap-5 sm:gap-6 lg:gap-8">
              {/* Description */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl sm:rounded-3xl glass-card p-4 sm:p-6 md:p-8 border border-white/5 flex flex-col gap-4 shadow-md"
              >
                <h3 className="text-xs font-bold text-zinc-550 uppercase tracking-wider">Project Specification</h3>
                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{project.description}</p>
              </motion.div>

              {/* Custom Milestones timeline (Only for type 2) */}
              {projectType === 2 && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-2xl sm:rounded-3xl glass-card p-4 sm:p-6 md:p-8 border border-white/5 flex flex-col gap-4 sm:gap-6 shadow-md"
                >
                  <h3 className="text-xs font-bold text-zinc-550 uppercase tracking-wider">Milestone Progressive Deliveries</h3>
                  <div className="flex flex-col gap-6">
                    {project.milestoneDetails.map((milestone, idx) => {
                      const isPassed = idx < chainState.current_milestone;
                      const isCurrent = idx === chainState.current_milestone && !chainState.is_completed && !chainState.is_aborted;

                      const pct = project.milestonePercentages?.[idx] || Math.round(100 / project.milestonesCount);

                      return (
                        <div key={idx} className="flex gap-4 relative">
                          {/* Connecting Line */}
                          {idx !== project.milestoneDetails.length - 1 && (
                            <div className={`absolute left-3 top-6 w-0.5 h-16 ${isPassed ? 'bg-indigo-650' : 'bg-zinc-850'}`}></div>
                          )}

                          {/* Bullet */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center border shrink-0 text-xs font-bold font-mono ${isPassed
                            ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500'
                            : isCurrent
                              ? 'bg-amber-600/20 text-amber-400 border-amber-500 animate-pulse'
                              : 'bg-zinc-950 text-zinc-600 border-zinc-850'
                            }`}>
                            {idx + 1}
                          </div>

                          {/* Content Card */}
                          <div className={`flex-1 rounded-2xl p-4.5 border transition-all duration-300 ${isCurrent
                            ? 'bg-zinc-900/50 border-zinc-800/80 shadow-md'
                            : 'bg-zinc-950/20 border-transparent text-zinc-500'
                            }`}>
                            <div className="flex justify-between items-start gap-2 mb-1.5">
                              <h4 className={`text-sm font-extrabold ${isCurrent ? 'text-white' : isPassed ? 'text-zinc-450 line-through' : 'text-zinc-600'}`}>
                                {milestone.title}
                              </h4>
                              <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${isPassed
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10'
                                : isCurrent
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-zinc-950 text-zinc-600 border border-zinc-850'
                                }`}>
                                {isPassed ? `Paid (${pct}%)` : isCurrent ? `In Review (${pct}%)` : `Locked (${pct}%)`}
                              </span>
                            </div>
                            <p className={`text-xs leading-relaxed ${isCurrent ? 'text-zinc-400 font-sans' : 'text-zinc-550 font-sans'}`}>
                              {milestone.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Gated file download (Only for Kategori A or completed custom services) */}
              {projectType !== 2 ? (
                <motion.div
                  variants={itemVariants}
                  className="rounded-2xl sm:rounded-3xl glass-card p-4 sm:p-6 md:p-8 border border-white/5 flex flex-col gap-4 shadow-md bg-gradient-to-br from-zinc-900/20 via-zinc-900/10 to-indigo-950/10"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Access-Gated Digital Files</h3>
                  </div>

                  {project.fileDetails ? (
                    <div className="bg-zinc-950/40 p-4.5 rounded-2xl border border-zinc-850 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-zinc-950 rounded-xl text-indigo-400 border border-zinc-850">
                          <FileArchive className="w-8 h-8" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-white">{project.fileDetails.name}</span>
                          <span className="text-xs text-zinc-500 font-mono">
                            {(project.fileDetails.size / 1024 / 1024).toFixed(2)} MB • {project.fileDetails.type}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 items-end w-full sm:w-auto">
                        {projectType === 0 ? (
                          /* Instant Buy download rule */
                          hasAccess ? (
                            <button
                              onClick={handleDownload}
                              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 glow-primary transition duration-300"
                            >
                              <Download className="w-4 h-4" /> Download Files
                            </button>
                          ) : (
                            <div className="flex items-center gap-1 text-[11px] text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                              <Lock className="w-3.5 h-3.5" /> Locked: Purchase Required
                            </div>
                          )
                        ) : (
                          /* Crowdfund pool download rule */
                          chainState.is_completed ? (
                            hasAccess ? (
                              <button
                                onClick={handleDownload}
                                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 glow-primary transition duration-300"
                              >
                                <Download className="w-4 h-4" /> Download Files
                              </button>
                            ) : (
                              <div className="flex items-center gap-1 text-[11px] text-rose-500 font-bold bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                                <Lock className="w-3.5 h-3.5" /> Locked: Contributor Only
                              </div>
                            )
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 bg-zinc-950 border border-zinc-850 px-3.5 py-2 rounded-xl font-mono">
                              <Lock className="w-3.5 h-3.5 text-zinc-600" /> Awaiting 100% Target Pool
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-550 italic font-mono">No deliverable package files uploaded.</p>
                  )}
                </motion.div>
              ) : (
                /* Custom Milestone gated download */
                chainState.is_completed && (
                  <motion.div
                    variants={itemVariants}
                    className="rounded-3xl glass-card p-6 md:p-8 border border-white/5 flex flex-col gap-4 shadow-md bg-gradient-to-br from-zinc-900/20 via-zinc-900/10 to-purple-950/10"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-purple-400" />
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Completed Service Assets</h3>
                    </div>

                    <div className="bg-zinc-950/40 p-4.5 rounded-2xl border border-zinc-850 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-zinc-950 rounded-xl text-purple-450 border border-zinc-850">
                          <FileArchive className="w-8 h-8" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-white">Final_Deliverables_Project_{projectId}.zip</span>
                          <span className="text-xs text-zinc-500 font-mono">Completed Escrow Package</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 items-end w-full sm:w-auto font-sans">
                        {isClient || isCreator ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 rounded-xl">
                            <CheckCircle className="w-4 h-4" /> Custom Project Released
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[11px] text-rose-500 font-bold bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                            <Lock className="w-3.5 h-3.5" /> Locked: Client Access Only
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              )}
            </div>

            {/* RIGHT COLUMN: Action panels */}
            <div className="flex flex-col gap-5 sm:gap-6 lg:gap-8">
              {/* Project Action Panel */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl sm:rounded-3xl glass-card p-4 sm:p-6 border border-white/5 flex flex-col gap-4 sm:gap-5 shadow-lg"
              >
                {projectType === 0 ? (
                  /* Instant Buy pricing card */
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xs font-bold text-zinc-450 uppercase tracking-wider">Retail Checkout</h3>



                    {hasAccess ? (
                      <div className="text-xs text-emerald-450 font-bold bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-center flex items-center justify-center gap-2 font-sans">
                        <CheckCircle2 className="w-4 h-4" /> Purchased & Unlocked
                      </div>
                    ) : (
                      <button
                        onClick={handleBuyInstant}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl glow-primary flex items-center justify-center gap-2 transition duration-300 text-sm"
                      >
                        <Coins className="w-4 h-4" /> Purchase Instantly
                      </button>
                    )}
                  </div>
                ) : projectType === 2 ? (
                  /* Custom Escrow budget card */
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xs font-bold text-zinc-450 uppercase tracking-wider">Escrow Activity</h3>
                    <div className="flex items-center justify-between text-xs bg-zinc-950 p-3.5 rounded-xl border border-zinc-900">
                      <span className="text-zinc-550 font-semibold uppercase tracking-wide text-[10px]">Escrow Balance</span>
                      <span className="font-bold text-indigo-400 font-mono text-sm">{chainState.pledged_amount.toFixed(2)} USDC</span>
                    </div>

                    {chainState.pledged_amount === 0 ? (
                      (isClient || (clientAddressResolved && clientAddressResolved.toLowerCase() === project.creatorAddress.toLowerCase() && !isCreator)) ? (
                        <button
                          onClick={handleLockBudget}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl glow-primary flex items-center justify-center gap-2 transition duration-300 text-sm"
                        >
                          <Lock className="w-4 h-4" /> Lock & Deposit Budget
                        </button>
                      ) : (
                        <div className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-center font-medium font-sans font-mono">
                          {isCreator ? "Awaiting client deposit to activate escrow contract." : "Only the designated client can lock budget for this project."}
                        </div>
                      )
                    ) : (
                      <div className="text-xs text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl text-center flex items-center justify-center gap-1.5 font-sans">
                        <Unlock className="w-4 h-4" /> Budget Escrow Active
                      </div>
                    )}
                  </div>
                ) : (
                  /* Crowdfunded Pool details card */
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xs font-bold text-zinc-450 uppercase tracking-wider">Pool Funding</h3>

                    {/* Progress Bar (Solid Color) */}
                    <div>
                      <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-850">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] mt-2 text-zinc-500 font-mono">
                        <span>Pledged: {chainState.pledged_amount.toFixed(2)} USDC</span>
                        <span>{progress}% Filled</span>
                      </div>
                    </div>

                    <div className="border-t border-zinc-800/60 my-1"></div>

                    <div className="flex items-center justify-between text-xs bg-zinc-950 p-3 rounded-xl border border-zinc-900">
                      <span className="text-zinc-555 font-semibold uppercase tracking-wide text-[10px]">Your Contribution</span>
                      <span className="font-bold text-indigo-400 font-mono text-sm">{userPledge.toFixed(2)} USDC</span>
                    </div>

                    {!chainState.is_completed && !chainState.is_aborted && !isExpired && (
                      <form onSubmit={handlePledge} className="flex flex-col gap-2 mt-1">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            required
                            min={0.5}
                            step="any"
                            value={pledgeAmount}
                            onChange={(e) => setPledgeAmount(e.target.value)}
                            className="bg-zinc-950 border border-zinc-850 focus:border-zinc-750 text-zinc-200 text-xs font-mono p-2.5 rounded-lg flex-1 outline-none"
                          />
                          <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg glow-primary flex items-center gap-1 transition"
                          >
                            <Coins className="w-3.5 h-3.5" /> Back Pool
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Escrow Milestone Approval Control (Only for Custom Milestone Type 2) */}
              {projectType === 2 && chainState.pledged_amount > 0 && !chainState.is_completed && !chainState.is_aborted && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-3xl glass-card p-6 border border-white/5 flex flex-col gap-4 shadow-lg bg-gradient-to-b from-zinc-900/30 to-zinc-950/30"
                >
                  <div className="flex flex-col gap-1">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Milestone #{chainState.current_milestone + 1} Status</h3>
                    <p className="text-[11px] text-zinc-450 leading-relaxed font-sans">
                      Verify and approve the creator's current phase outputs to authorize partial escrow payouts.
                    </p>
                  </div>

                  {/* Vote approval displays */}
                  {chainState.milestone_approved ? (
                    <div className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-center flex items-center justify-center gap-1.5 font-sans">
                      <CheckCircle2 className="w-4 h-4" /> Phase Approved & Ready for Payout
                    </div>
                  ) : (
                    <div className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-center font-medium font-sans">
                      Awaiting client milestone approval vote.
                    </div>
                  )}

                  {/* Actions for client */}
                  {isClient && !chainState.milestone_approved && (
                    <div className="flex flex-col gap-2 mt-2">
                      <span className="text-[9px] font-bold text-zinc-550 uppercase text-center tracking-wider">Milestone Judgment</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleVote(true)}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition duration-300 ${userVote === true
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                            : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white hover:border-zinc-750'
                            }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleVote(false)}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition duration-300 ${userVote === false
                            ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/20'
                            : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white hover:border-zinc-750'
                            }`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Refund Panel (Crowdfunding failure or custom aborts) */}
              {(chainState.is_aborted || (projectType === 1 && isExpired && !targetMet)) && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-3xl glass-card p-6 border border-white/5 bg-rose-950/10 flex flex-col gap-4 shadow-lg"
                >
                  <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <AlertTriangle className="w-4 h-4" /> Refund Payout Escrow
                  </h4>
                  <p className="text-xs text-zinc-450 leading-relaxed font-sans">
                    {chainState.is_aborted
                      ? 'This project was aborted by the creator. You can withdraw the remaining budget balance proportionally.'
                      : 'The pool failed to meet the target before the deadline. Claim your 100% refund.'}
                  </p>
                  {userPledge > 0 ? (
                    <button
                      onClick={handleRefund}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-3 rounded-xl transition duration-300 shadow-md"
                    >
                      Withdraw Refund
                    </button>
                  ) : (
                    <div className="text-xs text-zinc-550 bg-zinc-950/60 p-3 rounded-xl text-center border border-zinc-850 font-mono">
                      No claimable refund balance.
                    </div>
                  )}
                </motion.div>
              )}

              {/* ADMIN ACTIONS PANEL (Creator Controls) */}
              {isCreator && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-3xl glass-card p-6 border border-white/5 flex flex-col gap-4 shadow-lg"
                >
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Creator Admin Panel</h3>

                  <div className="flex flex-col gap-2.5">
                    {/* Claim milestone button */}
                    {projectType !== 0 && (
                      (projectType === 1 && targetMet && !chainState.is_completed) ||
                      (projectType === 2 && chainState.milestone_approved)
                    ) && (
                        <button
                          onClick={handleClaimFunds}
                          className="w-full bg-emerald-650 hover:bg-emerald-705 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition duration-300"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          {projectType === 1 ? 'Claim All Escrow Funds' : `Disburse Milestone #${chainState.current_milestone + 1}`}
                        </button>
                      )}

                    {/* Complete campaign button (For custom escrow only) */}
                    {projectType === 2 && !chainState.is_completed && !chainState.is_aborted && (
                      <button
                        onClick={handleCompleteCampaign}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-indigo-600/20"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Complete Custom Project
                      </button>
                    )}

                    {/* Simulate 3 Days Passed */}
                    {isMockMode() && projectType === 1 && targetMet && !chainState.is_completed && !chainState.is_aborted && (
                      <button
                        onClick={handleFastForward}
                        className="w-full bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/20 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition"
                      >
                        <Clock className="w-3.5 h-3.5" /> Fast Forward 3 Days
                      </button>
                    )}

                    {/* Abort button */}
                    {!chainState.is_completed && !chainState.is_aborted && (
                      <button
                        onClick={handleAbort}
                        className="w-full bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Abort Campaign
                      </button>
                    )}

                    <div className="text-[10px] text-zinc-550 italic mt-1 leading-relaxed bg-zinc-950/60 p-3 rounded-xl border border-zinc-850 font-sans">
                      Creator functions are active because your active wallet address matches the seller address.
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </main>

      {/* Custom Transaction Confirmation Modal */}
      <AnimatePresence>
        {confirmModalOpen && confirmModalConfig && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-reveal-up">
            {/* Backdrop blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 relative z-10 flex flex-col gap-5 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl shrink-0 animate-reveal-up">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <h3 className="text-base font-bold text-white font-sans text-left">
                    {confirmModalConfig.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans text-left">
                    {confirmModalConfig.desc}
                  </p>
                </div>
              </div>

              {/* Conversion Display Section */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850/60 flex flex-col gap-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-555 font-semibold uppercase tracking-wider">Payment Amount</span>
                  <span className="font-mono font-black text-white text-sm">
                    {confirmModalConfig.amount.toFixed(2)} USDC
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs border-t border-zinc-900/60 pt-2.5">
                  <span className="text-zinc-555 font-semibold uppercase tracking-wider flex items-center gap-1">
                    Auto Conversion
                  </span>
                  <span className="font-mono font-black text-indigo-400 text-sm">
                    ~{(confirmModalConfig.amount / xlmPrice).toFixed(2)} XLM
                  </span>
                </div>

                <div className="text-[10px] text-zinc-550 border-t border-zinc-900/60 pt-2 flex items-center justify-between font-mono">
                  <span>Live Coinbase Rate:</span>
                  <span>1 XLM ≈ ${xlmPrice.toFixed(4)}</span>
                </div>
              </div>

              {/* Wallet Authorization Notice */}
              <div className="bg-indigo-950/15 border border-indigo-500/25 p-3.5 rounded-xl text-left">
                <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-wider mb-1 font-mono">Notice</h4>
                <p className="text-[11px] text-zinc-350 leading-relaxed font-sans">
                  Your Freighter wallet popup will show only the network gas fee (~0.01 XLM) on the main confirmation screen. However, upon signing, the smart contract will securely transfer <strong>{confirmModalConfig.amount.toFixed(2)} USDC (~{(confirmModalConfig.amount / xlmPrice).toFixed(2)} XLM)</strong> from your wallet balance as authorized.
                </p>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 mt-1 text-xs">
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(false)}
                  className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-850 text-zinc-300 font-bold p-3 rounded-xl transition text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setConfirmModalOpen(false);
                    await confirmModalConfig.action();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold p-3 rounded-xl shadow-lg glow-primary transition text-center flex items-center justify-center"
                >
                  Approve & Pay
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-8"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 hover:border-white/20 text-white transition cursor-pointer z-50"
            title="Tutup"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Image container & Navigation */}
          <div
            className="relative max-w-5xl w-full h-[70vh] sm:h-[80vh] flex items-center justify-center group/lightbox"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Previous Button */}
            {displayImages.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex(prev => (prev === 0 ? displayImages.length - 1 : prev - 1));
                }}
                className="absolute left-2 sm:left-4 z-10 p-2 sm:p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-850 border border-white/10 hover:border-white/20 text-white hover:text-indigo-400 transition cursor-pointer"
                title="Sebelumnya"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}

            {/* Main Lightbox Image */}
            <img
              src={displayImages[activeImageIndex]}
              alt={`Lightbox ${activeImageIndex}`}
              className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_50px_rgba(99,102,241,0.15)] transition-all duration-300"
            />

            {/* Next Button */}
            {displayImages.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex(prev => (prev === displayImages.length - 1 ? 0 : prev + 1));
                }}
                className="absolute right-2 sm:right-4 z-10 p-2 sm:p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-850 border border-white/10 hover:border-white/20 text-white hover:text-indigo-400 transition cursor-pointer"
                title="Selanjutnya"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
          </div>

          {/* Indicator & title */}
          {project && (
            <div className="flex flex-col items-center gap-1 text-center mt-4" onClick={(e) => e.stopPropagation()}>
              <span className="text-zinc-200 text-xs sm:text-sm font-bold">{project.title}</span>
              {displayImages.length > 1 && (
                <span className="text-zinc-500 font-mono text-[10px] sm:text-xs">
                  Gambar {activeImageIndex + 1} dari {displayImages.length}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
