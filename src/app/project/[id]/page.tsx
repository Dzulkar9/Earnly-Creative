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
  isMockMode,
  releaseEscrowFunds,
  advanceMilestoneMock
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
  ChevronRight,
  MessageSquare,
  Send,
  Star
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

  // Rating States
  const [averageRating, setAverageRating] = useState<number>(5.0);
  const [ratingsCount, setRatingsCount] = useState<number>(0);
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [showAllReviews, setShowAllReviews] = useState<boolean>(false);
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [commentInput, setCommentInput] = useState<string>('');
  const [submitRatingLoading, setSubmitRatingLoading] = useState<boolean>(false);
  const [purchaseTransaction, setPurchaseTransaction] = useState<any | null>(null);
  const [showFullDescription, setShowFullDescription] = useState<boolean>(false);

  // Dispute / Report States
  const [dispute, setDispute] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);
  const [evidenceImages, setEvidenceImages] = useState<File[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState<boolean>(false);

  // Edit / Delete Listing States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTargetAmount, setEditTargetAmount] = useState('');
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [updatingProject, setUpdatingProject] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  // Milestone Progress States
  const [updatingMilestoneIndex, setUpdatingMilestoneIndex] = useState<number | null>(null);
  const [progressDescInput, setProgressDescInput] = useState('');
  const [progressMediaFile, setProgressMediaFile] = useState<File | null>(null);
  const [uploadingProgressMedia, setUploadingProgressMedia] = useState(false);
  const [submittingProgress, setSubmittingProgress] = useState(false);

  // Deliverables upload states
  const [deliverablesFile, setDeliverablesFile] = useState<File | null>(null);
  const [uploadingDeliverables, setUploadingDeliverables] = useState(false);

  useEffect(() => {
    if (project) {
      setEditTitle(project.title);
      setEditDescription(project.description);
      setEditCategory(project.category);
      setEditTargetAmount(project.targetAmount.toString());
      setEditImageUrl(project.imageUrl || '');
    }
  }, [project]);
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

        try {
          const txRes = await fetch(`/api/transactions?projectId=${projectId}`);
          if (txRes.ok) {
            const txs = await txRes.json();
            const purchaseTx = txs.find((t: any) => 
              (t.type === 'purchase' || t.type === 'lock_budget') &&
              (activeAddr ? t.userAddress.toLowerCase() === activeAddr.toLowerCase() : true)
            );
            setPurchaseTransaction(purchaseTx || null);

            if (purchaseTx) {
              const dispRes = await fetch(`/api/disputes?transactionId=${purchaseTx.id}`);
              if (dispRes.ok) {
                const disputes = await dispRes.json();
                if (disputes && disputes.length > 0) {
                  setDispute(disputes[0]);
                } else {
                  setDispute(null);
                }
              }
            } else {
              setDispute(null);
            }
          }
        } catch (txErr) {
          console.error('Error fetching transactions for purchase validation:', txErr);
        }
      }
      await fetchRatings();
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

  // Escrow lock and auto-release logic
  const hasBuyerRated = reviewsList.some(r => 
    ((r.transaction_id || r.transactionId) && purchaseTransaction && (r.transaction_id === purchaseTransaction.id || r.transactionId === purchaseTransaction.id)) ||
    (!(r.transaction_id || r.transactionId) && (Number(r.project_id) === projectId || Number(r.projectId) === projectId) && r.buyerAddress.toLowerCase() === (purchaseTransaction?.userAddress || '').toLowerCase())
  );
  const oneDayMs = 24 * 60 * 60 * 1000;
  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
  
  const isWithin24Hours = purchaseTransaction ? (Date.now() - purchaseTransaction.timestamp < oneDayMs) : false;
  const isWithin5Days = purchaseTransaction ? (Date.now() - purchaseTransaction.timestamp < fiveDaysMs) : false;

  const hasDispute = !!dispute;
  const isDisputePending = dispute && dispute.status === 'pending';

  // Escrow is locked if:
  // - Pending dispute and within 5 days
  // - OR no dispute, not rated, and within 24 hours
  const isEscrowLocked = purchaseTransaction && (
    (isDisputePending && isWithin5Days) ||
    (!hasDispute && !hasBuyerRated && isWithin24Hours)
  );

  const lockDuration = isDisputePending ? fiveDaysMs : oneDayMs;
  const timeRemainingMs = purchaseTransaction ? (purchaseTransaction.timestamp + lockDuration - Date.now()) : 0;
  const hoursRemaining = Math.max(0, Math.floor(timeRemainingMs / (1000 * 60 * 60)));
  const minutesRemaining = Math.max(0, Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60)));

  // Auto-submit 5-star rating after 24 hours
  useEffect(() => {
    if (purchaseTransaction && !hasBuyerRated && !isWithin24Hours && !submitRatingLoading) {
      const autoSubmit = async () => {
        try {
          setSubmitRatingLoading(true);
          const res = await fetch(`/api/projects/${projectId}/ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rating: 5,
              comment: '(Automated 5-Star Rating - Released after 24 hours of inactivity)',
              buyerAddress: purchaseTransaction.userAddress,
              isMock: isMockMode(),
              transactionId: purchaseTransaction.id
            })
          });
          if (res.ok) {
            console.log('Automated 5-star rating submitted successfully.');
            await fetchRatings();
            await loadAllData();
          }
        } catch (err) {
          console.error('Error auto-submitting rating:', err);
        } finally {
          setSubmitRatingLoading(false);
        }
      };
      autoSubmit();
    }
  }, [purchaseTransaction, hasBuyerRated, isWithin24Hours]);

  const getMyBuyerAddress = () => {
    if (walletAddress) return walletAddress;
    if (typeof window !== 'undefined') {
      let guestAddr = localStorage.getItem('earnly_guest_chat_address');
      if (!guestAddr) {
        guestAddr = `Guest_${Math.random().toString(36).substring(2, 6)}`;
        localStorage.setItem('earnly_guest_chat_address', guestAddr);
      }
      return guestAddr;
    }
    return 'Guest';
  };

  const handleChatWithSeller = () => {
    const event = new CustomEvent('openGlobalChat', {
      detail: {
        projectId: projectId,
        buyerAddress: getMyBuyerAddress()
      }
    });
    window.dispatchEvent(event);
  };

  const fetchRatings = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/ratings`);
      if (res.ok) {
        const data = await res.json();
        setAverageRating(data.averageRating);
        setRatingsCount(data.ratingsCount);
        setReviewsList(data.ratings || []);
      }
    } catch (err) {
      console.error('Error fetching ratings:', err);
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    const myAddr = getMyBuyerAddress();
    if (!myAddr) {
      alert('Please connect wallet or open guest chat to submit rating.');
      return;
    }

    try {
      setSubmitRatingLoading(true);
      const res = await fetch(`/api/projects/${projectId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: ratingInput,
          comment: commentInput,
          buyerAddress: myAddr,
          isMock: isMockMode(),
          transactionId: purchaseTransaction?.id || null
        })
      });

      if (res.ok) {
        alert('Thank you! Your rating has been submitted successfully.');
        setCommentInput('');
        await releaseEscrowFunds(projectId, myAddr);
        fetchRatings();
        loadAllData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to submit rating.');
      }
    } catch (err) {
      console.error('Error submitting rating:', err);
      alert('Network error submitting rating.');
    } finally {
      setSubmitRatingLoading(false);
    }
  };

  const handleReportProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress || !purchaseTransaction) return;
    if (!reportReason.trim()) {
      alert('Please enter a reason for reporting.');
      return;
    }
    if (evidenceImages.length < 2) {
      alert('Please select and upload at least 2 evidence photos.');
      return;
    }

    try {
      setSubmittingReport(true);
      setUploadingEvidence(true);

      const uploadedUrls: string[] = [];
      for (let i = 0; i < evidenceImages.length; i++) {
        const formData = new FormData();
        formData.append('file', evidenceImages[i]);
        formData.append('isImage', 'true');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error(`Failed to upload evidence photo ${i + 1}.`);
        }

        const data = await uploadRes.json();
        if (data.imageUrl) {
          uploadedUrls.push(data.imageUrl);
        }
      }

      setUploadingEvidence(false);

      const res = await fetch(`/api/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          transactionId: purchaseTransaction.id,
          buyerAddress: walletAddress,
          reason: reportReason,
          photos: uploadedUrls
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit report');
      }

      alert('Report submitted successfully. Funds will be held up to 5 days for admin mediation.');
      setShowReportModal(false);
      setReportReason('');
      setEvidenceImages([]);
      
      // Refresh database records
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit report');
    } finally {
      setUploadingEvidence(false);
      setSubmittingReport(false);
    }
  };

  const openProgressModal = (index: number, milestone: any) => {
    setUpdatingMilestoneIndex(index);
    setProgressDescInput(milestone.progressDescription || '');
    setProgressMediaFile(null);
  };

  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (updatingMilestoneIndex === null) return;
    if (!progressDescInput.trim()) {
      alert('Progress description is required.');
      return;
    }

    try {
      setSubmittingProgress(true);
      let progressMediaUrl = '';
      let progressMediaType = '';

      if (progressMediaFile) {
        setUploadingProgressMedia(true);
        const mediaFormData = new FormData();
        mediaFormData.append('file', progressMediaFile);
        mediaFormData.append('isImage', 'true');
        
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: mediaFormData,
        });

        if (!uploadRes.ok) {
          throw new Error('Failed to upload progress media file.');
        }

        const uploadData = await uploadRes.json();
        progressMediaUrl = uploadData.imageUrl || uploadData.cloudinaryUrl || '';
        progressMediaType = progressMediaFile.type;
        setUploadingProgressMedia(false);
      }

      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress
        },
        body: JSON.stringify({
          milestoneIndex: updatingMilestoneIndex,
          progressDescription: progressDescInput,
          progressMediaUrl,
          progressMediaType
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update milestone progress');
      }

      // Advance local mock blockchain milestone state
      advanceMilestoneMock(projectId, updatingMilestoneIndex);

      alert('Milestone progress updated successfully!');
      setUpdatingMilestoneIndex(null);
      setProgressDescInput('');
      setProgressMediaFile(null);
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Error updating milestone progress.');
    } finally {
      setUploadingProgressMedia(false);
      setSubmittingProgress(false);
    }
  };

  const handleUploadDeliverables = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliverablesFile) {
      alert('Please select a file to upload.');
      return;
    }

    try {
      setUploadingDeliverables(true);
      const formData = new FormData();
      formData.append('file', deliverablesFile);

      // 1. Upload and encrypt file
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to encrypt and upload deliverables.');
      }

      const fileDetails = await uploadRes.json();

      // 2. Save metadata in Supabase project_files table
      const saveRes = await fetch(`/api/projects/${projectId}/deliverables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress
        },
        body: JSON.stringify(fileDetails)
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json();
        throw new Error(errData.error || 'Failed to save deliverables metadata.');
      }

      alert('Final deliverables file uploaded successfully!');
      setDeliverablesFile(null);
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Error uploading deliverables file.');
    } finally {
      setUploadingDeliverables(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !editDescription.trim()) {
      alert('Title and Description are required.');
      return;
    }

    try {
      setUpdatingProject(true);
      let imageUrl = editImageUrl;

      // Upload image if a new file is chosen
      if (editImageFiles.length > 0) {
        const uploadedUrls: string[] = [];
        for (let i = 0; i < editImageFiles.length; i++) {
          const imgFormData = new FormData();
          imgFormData.append('file', editImageFiles[i]);
          imgFormData.append('isImage', 'true');
          
          const imgUploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: imgFormData,
          });
          
          if (!imgUploadRes.ok) {
            throw new Error(`Failed to upload product image ${i + 1}.`);
          }
          
          const imgData = await imgUploadRes.json();
          if (imgData.imageUrl) {
            uploadedUrls.push(imgData.imageUrl);
          }
        }
        imageUrl = uploadedUrls.join(',');
      }

      // Send PUT request to API
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress
        },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          category: editCategory,
          targetAmount: Number(editTargetAmount),
          imageUrl
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update listing.');
      }

      alert('Listing updated successfully!');
      setShowEditModal(false);
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Error updating project.');
    } finally {
      setUpdatingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      setDeletingProject(true);
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'x-wallet-address': walletAddress
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete listing.');
      }

      alert('Listing deleted successfully.');
      setShowDeleteModal(false);
      router.push('/profile');
    } catch (err: any) {
      alert(err.message || 'Error deleting listing.');
      setDeletingProject(false);
    }
  };

  const handlePledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      alert('Please connect your Freighter wallet or switch mock account in the top-right.');
      return;
    }
    const amt = Number(pledgeAmount);
    const minPledgeVal = project?.minContribution !== undefined ? project.minContribution : 0.5;
    if (isNaN(amt) || amt < minPledgeVal) {
      alert(`Minimum contribution amount is ${minPledgeVal} USDC.`);
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
          const mockPurchaseTx = {
            id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
            projectId,
            projectTitle: project.title,
            type: 'purchase',
            amount: project.targetAmount,
            xlmAmount: xlmEquiv,
            xlmPrice,
            userAddress: walletAddress,
            message: `${getFriendlyName(walletAddress)} purchased ${project.title} for ${project.targetAmount} USDC`,
            timestamp: Date.now(),
            read: false
          };
          setPurchaseTransaction(mockPurchaseTx);
          try {
            await fetch('/api/transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mockPurchaseTx)
            });
          } catch (dbErr) {
            console.error('Failed to save purchase transaction to database:', dbErr);
          }
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
          const mockPurchaseTx = {
            id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
            projectId,
            projectTitle: project.title,
            type: 'lock_budget',
            amount: project.targetAmount,
            xlmAmount: xlmEquiv,
            xlmPrice,
            userAddress: walletAddress,
            message: `${getFriendlyName(walletAddress)} locked ${project.targetAmount} USDC budget in Escrow`,
            timestamp: Date.now(),
            read: false
          };
          setPurchaseTransaction(mockPurchaseTx);
          try {
            await fetch('/api/transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mockPurchaseTx)
            });
          } catch (dbErr) {
            console.error('Failed to save budget lock transaction to database:', dbErr);
          }
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
    const activeAddr = walletAddress || getMyBuyerAddress();
    if (!activeAddr) {
      alert('Please connect your Freighter wallet.');
      return;
    }
    // Stream download from gated API
    window.open(`/api/download/${projectId}?address=${activeAddr}`, '_blank');
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
  const clientAddressResolved = project.clientAddress || chainState?.client;
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
  const myAddr = getMyBuyerAddress();
  const isActualBuyer = purchaseTransaction && myAddr && purchaseTransaction.userAddress.toLowerCase() === myAddr.toLowerCase();
  const hasAccess = isCreator || userPledge > 0 || !!isActualBuyer;

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
              {/* ZeusX Seller Card */}
              <motion.div
                variants={itemVariants}
                className="bg-zinc-900/30 border border-white/5 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-505 to-purple-650 flex items-center justify-center text-white font-extrabold shadow-md border border-white/10 text-base shrink-0 font-sans bg-indigo-600">
                    {getFriendlyName(project.creatorAddress).substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white font-sans">{getFriendlyName(project.creatorAddress)}</span>
                      <span className="bg-indigo-500/10 text-indigo-400 text-[8px] font-black uppercase px-1.5 py-0.2 rounded border border-indigo-500/20">Seller</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-zinc-450">
                      <span className="text-amber-400 font-bold">★ {averageRating.toFixed(1)}</span>
                      <span className="text-zinc-650 font-sans">•</span>
                      <span className="text-indigo-400 font-bold">
                        {ratingsCount > 0 ? `${ratingsCount} reviews` : 'New Seller'}
                      </span>
                    </div>
                  </div>
                </div>

                {!isCreator && (
                  <button
                    onClick={handleChatWithSeller}
                    className="inline-flex items-center justify-center gap-2 border border-indigo-500 hover:bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 font-bold px-5 py-2.5 rounded-xl transition duration-300 text-xs shrink-0 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Chat With Seller
                  </button>
                )}
              </motion.div>

              {/* Description */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl sm:rounded-3xl glass-card p-4 sm:p-6 md:p-8 border border-white/5 flex flex-col gap-4 shadow-md"
              >
                <h3 className="text-xs font-bold text-zinc-550 uppercase tracking-wider">Project Specification</h3>
                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {project.description && project.description.length > 300
                    ? showFullDescription
                      ? project.description
                      : `${project.description.slice(0, 300)}...`
                    : project.description}
                </p>
                {project.description && project.description.length > 300 && (
                  <button
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-350 transition duration-300 self-start flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 mt-1"
                  >
                    {showFullDescription ? 'Show Less' : 'View All'}
                  </button>
                )}
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

                            {/* Milestone Progress Uploaded Content */}
                            {milestone.progressDescription && (
                              <div className="mt-3 p-3 bg-zinc-950/80 border border-zinc-850 rounded-xl flex flex-col gap-2.5">
                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Progress Update:</span>
                                <p className="text-xs text-zinc-300 leading-relaxed font-sans">{milestone.progressDescription}</p>
                                
                                {milestone.progressMediaUrl && (
                                  <div className="rounded-lg overflow-hidden border border-zinc-800 bg-black/40 self-start max-w-full">
                                    {milestone.progressMediaType?.startsWith('image') ? (
                                      <img src={milestone.progressMediaUrl} alt="Progress proof" className="max-h-60 w-auto object-contain" />
                                    ) : milestone.progressMediaType?.startsWith('video') ? (
                                      <video controls src={milestone.progressMediaUrl} className="max-h-60 w-auto" />
                                    ) : milestone.progressMediaType?.startsWith('audio') ? (
                                      <audio controls src={milestone.progressMediaUrl} className="w-80 p-2" />
                                    ) : (
                                      <a href={milestone.progressMediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 p-2 block hover:underline">
                                        View Uploaded File
                                      </a>
                                    )}
                                  </div>
                                )}
                                
                                {milestone.progressUpdatedAt && (
                                  <span className="text-[9px] text-zinc-550 self-end font-mono">
                                    Updated: {new Date(milestone.progressUpdatedAt).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            )}

                            {isCreator && idx === chainState.current_milestone && !chainState.is_completed && (
                              <button
                                type="button"
                                onClick={() => openProgressModal(idx, milestone)}
                                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-650/10 hover:bg-indigo-650/25 border border-indigo-500/20 text-[10px] text-indigo-400 font-bold rounded-lg transition cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3" /> Update Progress
                              </button>
                            )}
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
                            <div className="flex flex-col items-end gap-1.5 font-sans">
                              <button
                                onClick={handleDownload}
                                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 glow-primary transition duration-300"
                              >
                                <Download className="w-4 h-4" /> Download Files
                              </button>
                              {isEscrowLocked && (
                                <span className="text-[9px] text-amber-400/90 font-medium text-right max-w-[240px] leading-snug">
                                  ★ Rate the seller to release their funds instantly!
                                </span>
                              )}
                            </div>
                          ) : (
                  <div className="flex items-center gap-1 text-[11px] text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                              <Lock className="w-3.5 h-3.5" /> Locked: Purchase Required
                            </div>
                          )
                        ) : (
                          /* Crowdfund pool download rule */
                          (chainState.is_completed || chainState.pledged_amount >= project.targetAmount) ? (
                            hasAccess ? (
                              <div className="flex flex-col items-end gap-1.5 font-sans">
                                <button
                                  onClick={handleDownload}
                                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 glow-primary transition duration-300"
                                >
                                  <Download className="w-4 h-4" /> Download Files
                                </button>
                                {isEscrowLocked && (
                                  <span className="text-[9px] text-amber-400/90 font-medium text-right max-w-[240px] leading-snug">
                                    ★ Rate the seller to release their funds instantly!
                                  </span>
                                )}
                              </div>
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

                    {!project.fileDetails ? (
                      /* Awaiting upload state */
                      <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-850 flex flex-col gap-4">
                        <div className="flex items-center gap-2.5 text-zinc-400 text-xs font-sans">
                          <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                          <span>Awaiting final file upload from creator (Menunggu di upload)</span>
                        </div>

                        {isCreator && (
                          <form onSubmit={handleUploadDeliverables} className="flex flex-col gap-3 border-t border-zinc-900 pt-3">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Upload Final Deliverable File:</span>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                              <input
                                type="file"
                                required
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    setDeliverablesFile(e.target.files[0]);
                                  }
                                }}
                                className="text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-900 file:text-zinc-300 hover:file:bg-zinc-800 file:cursor-pointer cursor-pointer"
                              />
                              <button
                                type="submit"
                                disabled={uploadingDeliverables || !deliverablesFile}
                                className="w-full sm:w-auto bg-purple-650 hover:bg-purple-750 disabled:bg-zinc-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer animate-fade-in"
                              >
                                {uploadingDeliverables ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                                  </>
                                ) : (
                                  'Upload & Encrypt'
                                )}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ) : (
                      /* Uploaded and ready to download state */
                      <div className="bg-zinc-950/40 p-4.5 rounded-2xl border border-zinc-850 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-zinc-950 rounded-xl text-purple-450 border border-zinc-850">
                            <FileArchive className="w-8 h-8" />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-bold text-white">{project.fileDetails.name}</span>
                            <span className="text-xs text-zinc-500 font-mono">
                              {(project.fileDetails.size / 1024 / 1024).toFixed(2)} MB • {project.fileDetails.type}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 items-end w-full sm:w-auto font-sans">
                          {isClient || isCreator || isActualBuyer ? (
                            <div className="flex flex-col items-end gap-1.5 font-sans">
                              {isClient || isActualBuyer ? (
                                <button
                                  onClick={handleDownload}
                                  className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 glow-primary transition duration-300 cursor-pointer"
                                >
                                  <Download className="w-4 h-4" /> Download Files
                                </button>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 rounded-xl">
                                  <CheckCircle className="w-4 h-4" /> Deliverables Uploaded
                                </div>
                              )}
                              {isEscrowLocked && (isClient || isActualBuyer) && (
                                <span className="text-[9px] text-amber-400/90 font-medium text-right max-w-[240px] leading-snug font-sans">
                                  ★ Rate the seller to release their funds instantly!
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[11px] text-rose-500 font-bold bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                              <Lock className="w-3.5 h-3.5" /> Locked: Client Access Only
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )
              )}

              {/* Rating and Feedback Card */}
              {isActualBuyer && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-3xl glass-card p-6 md:p-8 border border-white/5 flex flex-col gap-4 shadow-md bg-gradient-to-br from-zinc-900/20 via-zinc-900/10 to-indigo-950/10"
                >
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-400" />
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Seller Feedback</h3>
                  </div>

                  {(() => {
                    const myReview = reviewsList.find((r) => 
                      ((r.transaction_id || r.transactionId) && purchaseTransaction && (r.transaction_id === purchaseTransaction.id || r.transactionId === purchaseTransaction.id)) ||
                      (!(r.transaction_id || r.transactionId) && (Number(r.project_id) === projectId || Number(r.projectId) === projectId) && r.buyerAddress.toLowerCase() === getMyBuyerAddress().toLowerCase())
                    );

                    if (dispute) {
                      return (
                        <div className="bg-rose-950/20 p-4.5 rounded-2xl border border-rose-900/30 flex flex-col gap-2.5 font-sans">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" /> Product Reported / Refund Request
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {new Date(dispute.created_at || dispute.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-300">
                            <strong>Reason:</strong> "{dispute.reason}"
                          </div>
                          <div className="text-[11px] text-zinc-400 bg-zinc-950/60 p-3 rounded-xl border border-zinc-900 mt-1 font-sans">
                            Mediation Status: <span className="font-bold text-amber-400 capitalize">{dispute.status.replace('_', ' ')}</span>
                            <p className="text-[10px] text-zinc-500 mt-1.5 leading-normal">
                              {dispute.status === 'pending' 
                                ? 'Escrow funds are held for up to 5 days. Compliance admin will review the dispute and execute mediation.' 
                                : dispute.status === 'resolved_refunded' 
                                  ? 'Mediation completed: Funds refunded to buyer.' 
                                  : 'Mediation completed: Funds released to seller.'}
                            </p>
                          </div>

                          {dispute.photos && (
                            <div className="flex flex-col gap-2 mt-2">
                              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider font-sans">Uploaded Evidence:</span>
                              <div className="flex flex-wrap gap-2.5">
                                {dispute.photos.split(',').filter(Boolean).map((photoUrl: string, idx: number) => (
                                  <a key={idx} href={photoUrl} target="_blank" rel="noreferrer" className="block relative overflow-hidden rounded-xl border border-zinc-800 hover:border-zinc-700 transition shrink-0 bg-zinc-950">
                                    <img src={photoUrl} alt={`Evidence ${idx + 1}`} className="w-16 h-16 object-cover hover:opacity-80 transition duration-300" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (projectType === 2 && !chainState.is_completed) {
                      return (
                        <div className="bg-zinc-950/40 p-4.5 rounded-2xl border border-zinc-850 flex flex-col gap-4 font-sans text-xs">
                          <div className="flex items-center gap-2.5 text-zinc-400">
                            <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                            Project is in progress (Milestone #{chainState.current_milestone + 1} active). Feedback form will unlock after all milestones are completed.
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setShowReportModal(true)}
                            className="self-start bg-zinc-950 hover:bg-zinc-900 text-rose-450 border border-rose-950/40 font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition duration-300 cursor-pointer"
                          >
                            Report Project / Refund
                          </button>
                        </div>
                      );
                    }

                    if (myReview) {
                      return (
                        <div className="bg-zinc-950/40 p-4.5 rounded-2xl border border-zinc-850 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white">Your Rating:</span>
                              <span className="text-amber-400 font-extrabold">
                                {'★'.repeat(myReview.rating)}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {new Date(myReview.createdAt || Date.now()).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 italic font-sans leading-relaxed">
                            "{myReview.comment || 'No ulasan written.'}"
                          </p>
                        </div>
                      );
                    }

                    return (
                      <form onSubmit={handleSubmitRating} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold text-zinc-400">Score Rating:</span>
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRatingInput(star)}
                              className="text-2xl transition duration-150 transform hover:scale-110 cursor-pointer"
                            >
                              <span className={star <= ratingInput ? 'text-amber-400' : 'text-zinc-700'}>★</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="review-comment" className="text-xs font-bold text-zinc-400">Review Message (Optional):</label>
                        <textarea
                          id="review-comment"
                          rows={3}
                          value={commentInput}
                          onChange={(e) => setCommentInput(e.target.value)}
                          placeholder="Tell others about your experience buying from this seller..."
                          className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 placeholder:text-zinc-650 focus:outline-none focus:border-indigo-500/50 resize-none font-sans"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setShowReportModal(true)}
                          className="w-full sm:w-auto bg-zinc-950 hover:bg-zinc-900 text-rose-450 border border-rose-950/40 font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition duration-300 cursor-pointer"
                        >
                          Report Product / Refund
                        </button>
                        
                        <button
                          type="submit"
                          disabled={submitRatingLoading}
                          className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-purple-650 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition duration-300 disabled:opacity-50 cursor-pointer"
                        >
                          {submitRatingLoading ? 'Submitting...' : 'Submit Review'}
                        </button>
                      </div>
                      </form>
                    );
                  })()}
                </motion.div>
              )}

              {/* Seller Reviews List */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl sm:rounded-3xl glass-card p-4 sm:p-6 md:p-8 border border-white/5 flex flex-col gap-4 shadow-md"
              >
                <h3 className="text-xs font-bold text-zinc-550 uppercase tracking-wider">
                  Seller Reviews ({ratingsCount})
                </h3>

                {reviewsList.length === 0 ? (
                  <p className="text-xs text-zinc-550 italic font-mono">No reviews submitted for this seller yet.</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {(showAllReviews ? reviewsList : reviewsList.slice(0, 3)).map((rev, idx) => (
                      <div key={idx} className="bg-zinc-950/20 p-4 rounded-xl border border-zinc-900 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                              {rev.buyerAddress.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-zinc-300">
                              {getFriendlyName(rev.buyerAddress)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-amber-400 font-bold">
                              {'★'.repeat(rev.rating)}
                            </span>
                            <span className="text-[9px] text-zinc-600 font-mono">
                              {new Date(rev.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {rev.comment && (
                          <p className="text-xs text-zinc-400 leading-relaxed font-sans pl-8 text-left break-words">
                            {rev.comment}
                          </p>
                        )}
                      </div>
                    ))}

                    {reviewsList.length > 3 && (
                      <button
                        onClick={() => setShowAllReviews(!showAllReviews)}
                        className="mt-1 self-center bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200 text-xs font-bold px-4 py-2 rounded-xl transition duration-300 cursor-pointer"
                      >
                        {showAllReviews ? 'Show Less' : `Show All Reviews (${reviewsList.length})`}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
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
                      isEscrowLocked ? (
                        <div className="flex flex-col gap-2 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center font-sans">
                          <div className="text-xs text-amber-500 font-bold flex items-center justify-center gap-2">
                            <Lock className="w-4 h-4 animate-pulse" /> Escrow Locking Active
                          </div>
                          <span className="text-[10px] text-zinc-400 leading-snug">
                            Funds & Deliverables are locked. Released immediately upon buyer review, or automatically in {hoursRemaining}h {minutesRemaining}m.
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-450 font-bold bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-center flex items-center justify-center gap-2 font-sans">
                          <CheckCircle2 className="w-4 h-4" /> Purchased & Unlocked
                        </div>
                      )
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
                      project?.targetAmount !== undefined && chainState?.pledged_amount !== undefined && chainState.pledged_amount >= project.targetAmount ? (
                        <div className="text-emerald-450 text-center py-3 border border-dashed border-emerald-500/30 rounded-lg bg-emerald-950/20 text-xs font-semibold">
                          🎉 Funding Closed: Target 100% Reached!
                        </div>
                      ) : project?.creatorAddress.toLowerCase() === walletAddress.toLowerCase() ? (
                        <div className="text-zinc-500 text-center py-3 border border-dashed border-zinc-800 rounded-lg bg-zinc-950/30 text-xs">
                          As the creator, you cannot back your own campaign.
                        </div>
                      ) : (
                        <form onSubmit={handlePledge} className="flex flex-col gap-2 mt-1">
                          <div className="flex gap-2">
                            <div className="flex-1 flex flex-col gap-1">
                              <input
                                type="number"
                                required
                                min={project?.minContribution !== undefined ? project.minContribution : 0.5}
                                max={project?.targetAmount !== undefined && chainState?.pledged_amount !== undefined ? (project.targetAmount - chainState.pledged_amount) : undefined}
                                step="any"
                                value={pledgeAmount}
                                onChange={(e) => setPledgeAmount(e.target.value)}
                                className="bg-zinc-950 border border-zinc-850 focus:border-zinc-750 text-zinc-200 text-xs font-mono p-2.5 rounded-lg w-full outline-none"
                              />
                              <span className="text-[9px] text-zinc-555 pl-1 text-left">
                                Min. contribution: {project?.minContribution !== undefined ? project.minContribution : 0.5} USDC | Max. contribution: {project?.targetAmount !== undefined && chainState?.pledged_amount !== undefined ? (project.targetAmount - chainState.pledged_amount).toFixed(2) : 0} USDC
                              </span>
                            </div>
                            <button
                              type="submit"
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg glow-primary flex items-center gap-1 transition"
                            >
                              <Coins className="w-3.5 h-3.5" /> Back Pool
                            </button>
                          </div>
                        </form>
                      )
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
                    {/* Edit Listing Button */}
                    <button
                      type="button"
                      onClick={() => setShowEditModal(true)}
                      className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition duration-300 shadow"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Edit Listing Details
                    </button>

                    {/* Delete Listing Button */}
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full bg-rose-950/20 hover:bg-rose-900/35 border border-rose-900/30 text-rose-400 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition duration-300 shadow"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      Delete Listing
                    </button>
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

      {/* Dispute Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReportModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-zinc-950 border border-zinc-850 p-6 sm:p-8 rounded-3xl shadow-2xl flex flex-col gap-5 z-10 font-sans"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Report Product & Refund</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="text-zinc-500 hover:text-zinc-300 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                If the product does not match the description or is broken, you can report it. The admin will check the issue, and the funds will be held in escrow for up to 5 days for mediation.
              </p>

              <form onSubmit={handleReportProduct} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="report-reason" className="text-xs font-bold text-zinc-400">Describe the issue / reason for refund:</label>
                  <textarea
                    id="report-reason"
                    rows={4}
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Enter detailed explanation of what is wrong with this product..."
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 placeholder:text-zinc-650 focus:outline-none focus:border-rose-500/50 resize-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-400">
                    Evidence Photos (Min. 2 photos required):
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files) {
                        const filesArray = Array.from(e.target.files);
                        setEvidenceImages(filesArray);
                      }
                    }}
                    className="hidden"
                    id="evidence-file-input"
                  />
                  <label
                    htmlFor="evidence-file-input"
                    className="border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950 p-4 rounded-xl text-center cursor-pointer transition text-xs text-zinc-400 font-semibold"
                  >
                    Select Photos ({evidenceImages.length} selected)
                  </label>

                  {evidenceImages.length > 0 && (
                    <div className="flex flex-col gap-1 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-850">
                      <span className="text-[10px] text-zinc-550 uppercase font-bold tracking-wider">Selected Files:</span>
                      <ul className="text-[11px] text-zinc-400 list-disc list-inside flex flex-col gap-0.5">
                        {evidenceImages.map((file, idx) => (
                          <li key={idx} className="truncate">{file.name} ({(file.size / 1024).toFixed(1)} KB)</li>
                        ))}
                      </ul>
                      {evidenceImages.length < 2 && (
                        <span className="text-[10px] text-rose-500 font-bold mt-1">⚠️ Need at least {2 - evidenceImages.length} more photo(s).</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs mt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-zinc-300 font-bold p-3 rounded-xl transition text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReport || uploadingEvidence}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold p-3 rounded-xl shadow-lg transition text-center flex items-center justify-center disabled:opacity-50"
                  >
                    {uploadingEvidence ? 'Uploading...' : (submittingReport ? 'Submitting...' : 'Submit Report')}
                  </button>
                </div>
              </form>
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

      {/* Edit Listing Modal */}
      {showEditModal && project && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition p-1 hover:bg-zinc-900 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" /> Edit Campaign Listing
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Modify campaign details below. Some parameters like targets might affect smart contract state constraints.
              </p>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4 text-xs sm:text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-400">Campaign Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-zinc-900 border border-zinc-850 rounded-xl p-3 text-white outline-none focus:border-indigo-500 transition"
                  placeholder="Enter listing name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-400">Description</label>
                <textarea
                  required
                  rows={5}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="bg-zinc-900 border border-zinc-850 rounded-xl p-3 text-white outline-none focus:border-indigo-500 transition resize-none font-sans leading-relaxed"
                  placeholder="Describe your creative deliverables..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-400">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="bg-zinc-900 border border-zinc-850 rounded-xl p-3 text-zinc-300 outline-none focus:border-indigo-500 transition"
                  >
                    <option value="Technology">Technology</option>
                    <option value="Art & Design">Art & Design</option>
                    <option value="Writing">Writing</option>
                    <option value="Music & Audio">Music & Audio</option>
                    <option value="Video & Film">Video & Film</option>
                    <option value="Gaming">Gaming</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-400">Target Value (USDC)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editTargetAmount}
                    onChange={(e) => setEditTargetAmount(e.target.value)}
                    className="bg-zinc-900 border border-zinc-850 rounded-xl p-3 text-white outline-none focus:border-indigo-500 transition"
                    placeholder="e.g. 50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-400">Cover Product Images</label>
                <div className="flex items-center gap-4">
                  {editImageUrl && (
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 shrink-0">
                      <img src={editImageUrl.split(',')[0]} alt="Current preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const filesArray = Array.from(e.target.files || []);
                        setEditImageFiles(filesArray);
                      }}
                      className="text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-900 file:text-zinc-300 hover:file:bg-zinc-800 file:cursor-pointer cursor-pointer"
                    />
                    <p className="text-[10px] text-zinc-550 mt-1">Upload files to replace the existing cover image.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-2 border-t border-zinc-900 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 px-5 py-2.5 rounded-xl font-bold text-zinc-400 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingProject}
                  className="bg-indigo-650 hover:bg-indigo-750 disabled:bg-zinc-800 text-white font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 glow-primary cursor-pointer"
                >
                  {updatingProject ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Campaign Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
          <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col gap-5 shadow-2xl">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition p-1 hover:bg-zinc-900 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider font-sans">Confirm Deletion</h3>
                <p className="text-[11px] text-zinc-500 font-mono">This action is permanent and irreversible.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Are you sure you want to delete listing <strong>"{project?.title}"</strong>? This will permanently delete metadata, associated milestone descriptions, uploader files, reviews/ratings, and disputes.
            </p>

            <div className="flex items-center justify-end gap-3 mt-2 border-t border-zinc-900 pt-4 text-xs font-sans">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 px-4 py-2.5 rounded-xl font-bold text-zinc-400 transition cursor-pointer"
              >
                Keep Listing
              </button>
              <button
                type="button"
                disabled={deletingProject}
                onClick={handleDeleteProject}
                className="bg-rose-650 hover:bg-rose-750 disabled:bg-zinc-800 text-white font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                {deletingProject ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...
                  </>
                ) : (
                  'Yes, Delete Permanent'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Milestone Progress Update Modal */}
      {updatingMilestoneIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
          <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-2xl">
            <button
              onClick={() => setUpdatingMilestoneIndex(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition p-1 hover:bg-zinc-900 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" /> Update Milestone #{updatingMilestoneIndex + 1} Progress
              </h3>
              <p className="text-xs text-zinc-550 mt-1">
                Provide descriptions and upload image, video, or audio proof of milestone deliverables.
              </p>
            </div>

            <form onSubmit={handleProgressSubmit} className="flex flex-col gap-4 text-xs sm:text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-400">Progress Description</label>
                <textarea
                  required
                  rows={4}
                  value={progressDescInput}
                  onChange={(e) => setProgressDescInput(e.target.value)}
                  className="bg-zinc-900 border border-zinc-850 rounded-xl p-3 text-white outline-none focus:border-indigo-500 transition resize-none font-sans leading-relaxed"
                  placeholder="Detail what was completed for this milestone..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-400">Upload Media Evidence (Photo, Video, Audio)</label>
                <input
                  type="file"
                  accept="image/*,video/*,audio/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setProgressMediaFile(e.target.files[0]);
                    }
                  }}
                  className="text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-900 file:text-zinc-300 hover:file:bg-zinc-800 file:cursor-pointer cursor-pointer"
                />
                <p className="text-[10px] text-zinc-550 mt-1">Supports image, video, and audio file types.</p>
              </div>

              <div className="flex items-center justify-end gap-3 mt-2 border-t border-zinc-900 pt-4">
                <button
                  type="button"
                  onClick={() => setUpdatingMilestoneIndex(null)}
                  className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 px-5 py-2.5 rounded-xl font-bold text-zinc-400 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingProgress || uploadingProgressMedia}
                  className="bg-indigo-650 hover:bg-indigo-750 disabled:bg-zinc-800 text-white font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 glow-primary cursor-pointer"
                >
                  {submittingProgress ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Updating...
                    </>
                  ) : (
                    'Save Progress'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
