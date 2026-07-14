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
  Edit2,
  AlertTriangle
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
    case 'Coordinate': return 'from-sky-950 via-slate-900 to-cyan-950';
    case 'Automatic': return 'from-rose-950 via-zinc-900 to-amber-950';
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'backed-projects' | 'my-projects' | 'seller-verification' | 'transaction-history' | 'my-reviews' | 'admin-disputes' | 'admin-compliance'>('dashboard');
  const [transactionPage, setTransactionPage] = useState(1);
  const [backedPage, setBackedPage] = useState(1);
  const [createdPage, setCreatedPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [disputesPage, setDisputesPage] = useState(1);
  const [compliancePage, setCompliancePage] = useState(1);
  
  // Dynamic Merchant Stats States
  const [creatorAverageRating, setCreatorAverageRating] = useState<number>(5.0);
  const [creatorReviewsCount, setCreatorReviewsCount] = useState<number>(0);
  const [creatorReviewsList, setCreatorReviewsList] = useState<any[]>([]);
  const [onHoldAmount, setOnHoldAmount] = useState<number>(0);

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

  // Dispute States
  const [disputesList, setDisputesList] = useState<any[]>([]);
  const [resolvingDisputeId, setResolvingDisputeId] = useState<number | null>(null);
  const [submittingDefenseId, setSubmittingDefenseId] = useState<number | null>(null);
  const [defenseText, setDefenseText] = useState<Record<number, string>>({});
  const [defenseImages, setDefenseImages] = useState<Record<number, File[]>>({});
  const [uploadingDefenseId, setUploadingDefenseId] = useState<number | null>(null);

  // Name edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Edit / Delete Project States
  const [editingProfileProject, setEditingProfileProject] = useState<any | null>(null);
  const [profileEditTitle, setProfileEditTitle] = useState('');
  const [profileEditDescription, setProfileEditDescription] = useState('');
  const [profileEditCategory, setProfileEditCategory] = useState('');
  const [profileEditTargetAmount, setProfileEditTargetAmount] = useState('');
  const [profileEditImageFiles, setProfileEditImageFiles] = useState<File[]>([]);
  const [profileEditImageUrl, setProfileEditImageUrl] = useState('');
  const [updatingProfileProject, setUpdatingProfileProject] = useState(false);

  const [deletingProfileProject, setDeletingProfileProject] = useState<any | null>(null);
  const [isDeletingProfileProject, setIsDeletingProfileProject] = useState(false);


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

      const adminAddress = (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || 'GB_CREATOR_ADDRESS_STW_NORTHGATE').trim();
      const isUserAdmin = !!activeAddr && (
        activeAddr.trim().toLowerCase() === adminAddress.toLowerCase() ||
        activeAddr.trim().toUpperCase() === 'GB_CREATOR_ADDRESS_STW_NORTHGATE'
      );
      setIsAdmin(isUserAdmin);
      if (isUserAdmin) {
        setActiveTab((prev) => {
          if (prev === 'admin-disputes' || prev === 'admin-compliance') {
            return prev;
          }
          return 'admin-disputes';
        });
      }

      const dbTransactions = await fetchUserTransactions(activeAddr);
      setUserNotifs(dbTransactions);

      // Fetch projects
      const res = await fetch('/api/projects');
      if (res.ok) {
        const allProjects: ProjectMetadata[] = await res.json();
        setProjects(allProjects);

        // Filter relevant projects (created or backed by the user)
        const myCreated = allProjects.filter(
          (p) => p.creatorAddress.toLowerCase() === activeAddr.toLowerCase() ||
            (activeAddr.startsWith('GB_CREATOR_') && p.creatorAddress.startsWith('GB_CREATOR_'))
        );
        const backedProjectIds = Array.from(
          new Set(
            dbTransactions
              .filter(tx => tx.type === 'pledge' || tx.type === 'purchase')
              .map(tx => tx.projectId)
          )
        );
        const relevantProjects = allProjects.filter(
          (p) => myCreated.some(my => my.id === p.id) || backedProjectIds.includes(p.id)
        );

        // Fetch states and pledges in parallel ONLY for relevant projects
        const states: Record<number, CampaignState> = {};
        const pledges: Record<number, number> = {};

        await Promise.all(
          relevantProjects.map(async (p) => {
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
          })
        );

        setBlockchainStates(states);
        setUserPledges(pledges);

        let allDisputes: any[] = [];
        try {
          const dispRes = await fetch(`/api/disputes`);
          if (dispRes.ok) {
            allDisputes = await dispRes.json();
            setDisputesList(allDisputes);
          }
        } catch (dispErr) {
          console.error('Error fetching disputes:', dispErr);
        }


        let totalRatingSum = 0;
        let totalRatingCount = 0;
        let allReviews: any[] = [];
        let holdSum = 0;
        const oneDayMs = 24 * 60 * 60 * 1000;
        const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;

        for (const p of myCreated) {
          try {
            const ratRes = await fetch(`/api/projects/${p.id}/ratings`);
            if (ratRes.ok) {
              const ratData = await ratRes.json();
              if (ratData.ratingsCount > 0) {
                totalRatingSum += ratData.averageRating * ratData.ratingsCount;
                totalRatingCount += ratData.ratingsCount;
                allReviews = [...allReviews, ...ratData.ratings.map((r: any) => ({ ...r, projectId: p.id, projectTitle: p.title }))];
              }

              // Check if any purchase transaction for this project is currently held
              const projectPledges = dbTransactions.filter(
                tx => tx.projectId === p.id && tx.type === 'purchase'
              );

              projectPledges.forEach((tx) => {
                const dispute = allDisputes.find(d => d.transaction_id === tx.id);
                const hasRated = ratData.ratings.some(
                  (r: any) => r.buyerAddress.toLowerCase() === tx.userAddress.toLowerCase()
                );

                if (dispute) {
                  // If disputed, check if pending and within 5 days limit
                  if (dispute.status === 'pending') {
                    const isWithin5Days = (Date.now() - tx.timestamp) < fiveDaysMs;
                    if (isWithin5Days) {
                      holdSum += tx.amount || 0;
                    }
                  }
                } else {
                  // Standard 24h release lock
                  const isWithin24h = (Date.now() - tx.timestamp) < oneDayMs;
                  if (!hasRated && isWithin24h) {
                    holdSum += tx.amount || 0;
                  }
                }
              });
            }
          } catch (e) {
            console.error('Error fetching project rating in profile:', e);
          }
        }

        setCreatorAverageRating(totalRatingCount > 0 ? Number((totalRatingSum / totalRatingCount).toFixed(1)) : 5.0);
        setCreatorReviewsCount(totalRatingCount);
        setCreatorReviewsList(allReviews);
        setOnHoldAmount(holdSum);
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

  const openProfileEditModal = (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingProfileProject(project);
    setProfileEditTitle(project.title);
    setProfileEditDescription(project.description);
    setProfileEditCategory(project.category);
    setProfileEditTargetAmount(project.targetAmount.toString());
    setProfileEditImageUrl(project.imageUrl || '');
  };

  const openProfileDeleteModal = (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    e.preventDefault();
    setDeletingProfileProject(project);
  };

  const handleProfileEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfileProject) return;
    if (!profileEditTitle.trim() || !profileEditDescription.trim()) {
      alert('Title and Description are required.');
      return;
    }

    try {
      setUpdatingProfileProject(true);
      let imageUrl = profileEditImageUrl;

      if (profileEditImageFiles.length > 0) {
        const uploadedUrls: string[] = [];
        for (let i = 0; i < profileEditImageFiles.length; i++) {
          const imgFormData = new FormData();
          imgFormData.append('file', profileEditImageFiles[i]);
          imgFormData.append('isImage', 'true');
          
          const imgUploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: imgFormData,
          });
          
          if (!imgUploadRes.ok) {
            throw new Error(`Failed to upload image ${i + 1}.`);
          }
          
          const imgData = await imgUploadRes.json();
          if (imgData.imageUrl) {
            uploadedUrls.push(imgData.imageUrl);
          }
        }
        imageUrl = uploadedUrls.join(',');
      }

      const res = await fetch(`/api/projects/${editingProfileProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress
        },
        body: JSON.stringify({
          title: profileEditTitle,
          description: profileEditDescription,
          category: profileEditCategory,
          targetAmount: Number(profileEditTargetAmount),
          imageUrl
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update listing.');
      }

      alert('Listing updated successfully!');
      setEditingProfileProject(null);
      setProfileEditImageFiles([]);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating project.');
    } finally {
      setUpdatingProfileProject(false);
    }
  };

  const handleProfileDeleteSubmit = async () => {
    if (!deletingProfileProject) return;

    try {
      setIsDeletingProfileProject(true);
      const res = await fetch(`/api/projects/${deletingProfileProject.id}`, {
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
      setDeletingProfileProject(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting listing.');
    } finally {
      setIsDeletingProfileProject(false);
    }
  };

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
      const hashBuffer = await crypto.subtle.digest('SHA-256', data as any);
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

  const handleResolveDispute = async (disputeId: number, action: 'refund' | 'release') => {
    if (!confirm(`Are you sure you want to resolve this dispute and execute a ${action} on-chain?`)) return;
    try {
      setResolvingDisputeId(disputeId);
      const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to resolve dispute');
      }

      alert(`Dispute successfully resolved! On-chain transaction has been broadcasted.`);
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to resolve dispute.');
    } finally {
      setResolvingDisputeId(null);
    }
  };

  const handleSubmitDefense = async (disputeId: number) => {
    const text = defenseText[disputeId] || '';
    if (!text.trim()) {
      alert('Please enter your defense statement.');
      return;
    }

    const images = defenseImages[disputeId] || [];

    try {
      setSubmittingDefenseId(disputeId);
      setUploadingDefenseId(disputeId);

      const uploadedUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const formData = new FormData();
        formData.append('file', images[i]);
        formData.append('isImage', 'true');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error(`Failed to upload defense image ${i + 1}.`);
        }

        const data = await uploadRes.json();
        if (data.imageUrl) {
          uploadedUrls.push(data.imageUrl);
        }
      }

      setUploadingDefenseId(null);

      const res = await fetch(`/api/disputes/${disputeId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerDefense: text,
          sellerPhotos: uploadedUrls,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit defense');
      }

      alert('Defense submitted successfully! The admin will review it.');
      setDefenseText(prev => ({ ...prev, [disputeId]: '' }));
      setDefenseImages(prev => ({ ...prev, [disputeId]: [] }));

      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to submit defense.');
    } finally {
      setUploadingDefenseId(null);
      setSubmittingDefenseId(null);
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

  const myCreatedProjectIds = new Set(myCreatedProjects.map(p => p.id));
  const soldProductsCount = userNotifs.filter(tx => myCreatedProjectIds.has(tx.projectId) && tx.type === 'purchase').length;
  const myOrders = userNotifs.filter(tx => myCreatedProjectIds.has(tx.projectId) && tx.type === 'purchase');
  
  const ongoingEscrow = myCreatedProjects
    .filter(p => blockchainStates[p.id]?.project_type === 2 && !blockchainStates[p.id]?.is_completed)
    .reduce((acc, p) => acc + (blockchainStates[p.id]?.pledged_amount ?? 0), 0);

  const withdrawnFunds = userNotifs
    .filter(tx => myCreatedProjectIds.has(tx.projectId) && (tx.type === 'milestone_claim' || tx.type === 'complete'))
    .reduce((acc, tx) => acc + (tx.amount || 0), 0);

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      alert('Copied to clipboard: ' + text);
    }
  };

  const getFriendlyName = (addr: string) => {
    if (!addr) return '';
    if (addr === 'GB_CREATOR_ADDRESS_STW_NORTHGATE') return 'Astrid Vlachakis (Creator)';
    if (addr === 'GB_CONTRIBUTOR_1_STW_NORTHGATE') return 'Cormac Aleixo (Backer 1)';
    if (addr === 'GB_CONTRIBUTOR_2_STW_NORTHGATE') return 'Hyun-woo Çelik (Backer 2)';
    if (addr === 'GB_GUEST_ADDRESS_STW_NORTHGATE') return 'Guest Auditor';
    if (addr.startsWith('Guest_')) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

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

  // Pagination for Listing Overview Table (myOrders)
  const ORDERS_PER_PAGE = 8;
  const totalOrdersPages = Math.ceil(myOrders.length / ORDERS_PER_PAGE);
  const currentOrdersPage = Math.max(1, Math.min(ordersPage, totalOrdersPages));
  const paginatedOrders = myOrders.slice(
    (currentOrdersPage - 1) * ORDERS_PER_PAGE,
    currentOrdersPage * ORDERS_PER_PAGE
  );

  // Pagination for Customer Reviews (creatorReviewsList)
  const REVIEWS_PER_PAGE = 8;
  const totalReviewsPages = Math.ceil(creatorReviewsList.length / REVIEWS_PER_PAGE);
  const currentReviewsPage = Math.max(1, Math.min(reviewsPage, totalReviewsPages));
  const paginatedReviews = creatorReviewsList.slice(
    (currentReviewsPage - 1) * REVIEWS_PER_PAGE,
    currentReviewsPage * REVIEWS_PER_PAGE
  );

  // Pagination for Dispute Mediation Panel (disputesList)
  const DISPUTES_PER_PAGE = 5;
  const totalDisputesPages = Math.ceil(disputesList.length / DISPUTES_PER_PAGE);
  const currentDisputesPage = Math.max(1, Math.min(disputesPage, totalDisputesPages));
  const paginatedDisputes = disputesList.slice(
    (currentDisputesPage - 1) * DISPUTES_PER_PAGE,
    currentDisputesPage * DISPUTES_PER_PAGE
  );

  // Pagination for Compliance Panel (allApplications)
  const COMPLIANCE_PER_PAGE = 6;
  const totalCompliancePages = Math.ceil(allApplications.length / COMPLIANCE_PER_PAGE);
  const currentCompliancePage = Math.max(1, Math.min(compliancePage, totalCompliancePages));
  const paginatedCompliance = allApplications.slice(
    (currentCompliancePage - 1) * COMPLIANCE_PER_PAGE,
    currentCompliancePage * COMPLIANCE_PER_PAGE
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 md:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">

        {/* PROFILE BANNER (ZeusX Merchant Profile Style) */}
        <section className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-zinc-800 p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-zinc-950 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center gap-5 w-full md:w-auto">
            {/* Avatar block */}
            <div className="relative group cursor-pointer w-20 h-20 shrink-0">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-650 to-purple-650 flex items-center justify-center text-white font-black text-2xl border-2 border-zinc-800 shadow-md keep-white">
                {userApplication?.realName ? userApplication.realName.replace('@', '').substring(0, 2).toUpperCase() : 'ME'}
              </div>
              <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <Edit2 className="w-5 h-5 text-white" />
              </div>
            </div>

            {/* Shop Details */}
            <div className="flex flex-col gap-2 text-center md:text-left w-full md:w-auto">
              <div className="flex flex-col sm:flex-row items-center gap-2 justify-center md:justify-start">
                {isEditingName ? (
                  <div className="flex items-center gap-2 w-full max-w-sm justify-center md:justify-start">
                    <input
                      type="text"
                      required
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      disabled={savingName}
                      placeholder="Masukkan nama baru..."
                      className="bg-zinc-900 border border-zinc-850 rounded-lg px-2.5 py-1 text-white text-xs outline-none"
                    />
                    <button onClick={handleSaveName} disabled={savingName} className="bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded text-xs text-white">Save</button>
                    <button onClick={() => setIsEditingName(false)} className="bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded text-xs text-zinc-400">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <h1 className="text-xl font-bold text-white tracking-wide">
                      {userApplication ? userApplication.realName.replace('@', '') + ' Shop' : 'Stellar Creator'}
                    </h1>
                    {walletAddress && (
                      <button onClick={() => { setTempName(userApplication ? userApplication.realName : 'Stellar Member'); setIsEditingName(true); }} className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-900 transition">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                <span className="flex items-center gap-1 bg-amber-400/10 text-amber-400 text-xs px-2 py-0.5 rounded font-black">
                  {creatorAverageRating.toFixed(1)} ★
                </span>
              </div>

              {/* Badges and metadata */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5 text-xs text-zinc-400 font-medium">
                <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                  <Award className="w-3 h-3" /> Seller Tiers: Bronze
                </span>
                <span className="text-zinc-700">•</span>
                <span>Total Products: <span className="text-zinc-200 font-mono font-bold">{myCreatedProjects.length}</span></span>
                <span className="text-zinc-700">•</span>
                <span>Sold Products: <span className="text-zinc-200 font-mono font-bold">{soldProductsCount}</span></span>
                <span className="text-zinc-700">•</span>
                <span className="flex items-center gap-1">
                  Wallet Balance: <strong className="text-emerald-400 font-mono">${Math.max(0, currentBalance - onHoldAmount).toFixed(2)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Preview Button on right */}
          <div className="flex items-center gap-2 shrink-0">
            {walletAddress && (
              <Link
                href={`/profile/${walletAddress}`}
                className="inline-flex items-center justify-center gap-2 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 hover:text-white px-4 py-2 rounded-xl transition duration-300 text-xs font-bold font-sans"
              >
                <BookOpen className="w-4 h-4" /> Preview Public Page
              </Link>
            )}
            <button onClick={loadData} className="p-2 border border-zinc-800 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* PROJECT TABS & DISPLAY */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/60 pb-3 gap-3">
            <div className="flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar whitespace-nowrap w-full pb-1">
              {isAdmin ? (
                <>
                  <button
                    onClick={() => setActiveTab('admin-disputes')}
                    className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer ${activeTab === 'admin-disputes'
                      ? 'text-white border-b-2 border-indigo-500'
                      : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                  >
                    Dispute Mediation Panel
                  </button>
                  <button
                    onClick={() => setActiveTab('admin-compliance')}
                    className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer ${activeTab === 'admin-compliance'
                      ? 'text-white border-b-2 border-indigo-500'
                      : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                  >
                    Compliance Panel: ZK Sellers
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer ${activeTab === 'dashboard'
                      ? 'text-white border-b-2 border-indigo-500'
                      : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setActiveTab('my-projects')}
                    className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer ${activeTab === 'my-projects'
                      ? 'text-white border-b-2 border-indigo-500'
                      : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                  >
                    My Listing ({myCreatedProjects.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('backed-projects')}
                    className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer ${activeTab === 'backed-projects'
                      ? 'text-white border-b-2 border-indigo-500'
                      : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                  >
                    My Purchases ({myBackedProjects.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('my-reviews')}
                    className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer ${activeTab === 'my-reviews'
                      ? 'text-white border-b-2 border-indigo-500'
                      : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                  >
                    My Reviews ({creatorReviewsCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('seller-verification')}
                    className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer ${activeTab === 'seller-verification'
                      ? 'text-white border-b-2 border-indigo-500'
                      : 'text-zinc-550 hover:text-zinc-300'
                      }`}
                  >
                    Seller Verification
                  </button>
                  <button
                    onClick={() => setActiveTab('transaction-history')}
                    className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer ${activeTab === 'transaction-history'
                      ? 'text-white border-b-2 border-indigo-500'
                      : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                  >
                    Transaction History ({userNotifs.length})
                  </button>
                </>
              )}
            </div>
            <span className="text-xs text-zinc-550 font-mono">Simulation Mode Active</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-zinc-400 text-sm">Syncing with ledger...</p>
            </div>
          ) : isAdmin ? (
            activeTab === 'admin-compliance' ? (
              /* ADMIN COMPLIANCE AUDIT VIEW */
              <div className="flex flex-col gap-6 w-full animate-fade-in font-sans">
                <div className="rounded-xl glass-card p-6 border border-zinc-800 flex flex-col gap-6 bg-zinc-950">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Compliance Panel: Registered Sellers (ZK Audit Log)</h3>
                  </div>

                  {allApplications.length === 0 ? (
                    <p className="text-xs text-zinc-550 italic">No applications recorded in the database.</p>
                  ) : (
                    <>
                      <div className="flex flex-col gap-4">
                        {paginatedCompliance.map((app) => (
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

                      {/* ZK Compliance Sellers Pagination Controls */}
                      {totalCompliancePages > 1 && (
                        <div className="flex items-center justify-between border-t border-zinc-850 pt-4 mt-4 font-sans">
                          <button
                            type="button"
                            onClick={() => setCompliancePage(prev => Math.max(1, prev - 1))}
                            disabled={currentCompliancePage === 1}
                            className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" /> Previous
                          </button>
                          <span className="text-[11px] font-mono text-zinc-500">
                            Page <span className="text-zinc-300 font-bold">{currentCompliancePage}</span> of <span className="text-zinc-300 font-bold">{totalCompliancePages}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setCompliancePage(prev => Math.min(totalCompliancePages, prev + 1))}
                            disabled={currentCompliancePage === totalCompliancePages}
                            className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                          >
                            Next <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* ADMIN DISPUTE MEDIATION PANEL */
              <div className="flex flex-col gap-6 w-full animate-fade-in font-sans">
                <div className="rounded-xl glass-card p-6 border border-zinc-800 flex flex-col gap-6 bg-zinc-950">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">Dispute Mediation Panel (Refunds & Escrow Audits)</h3>
                  </div>

                  {disputesList.length === 0 ? (
                    <p className="text-xs text-zinc-550 italic">No reported disputes recorded in the database.</p>
                  ) : (
                    <>
                      <div className="flex flex-col gap-4 font-sans">
                        {paginatedDisputes.map((disp) => (
                          <div
                            key={disp.id}
                            className="bg-zinc-950 p-4.5 rounded-xl border border-zinc-850 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 text-xs"
                          >
                            <div className="flex flex-col gap-2.5 max-w-xl">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-white text-sm">Dispute #{disp.id}</span>
                                <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono px-2 py-0.5 rounded">
                                  Project ID: {disp.project_id}
                                </span>
                                <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                                  disp.status === 'pending'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : disp.status === 'resolved_refunded'
                                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}>
                                  {disp.status.replace('_', ' ')}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3 font-sans">
                                {/* Buyer Report Side */}
                                <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-850/60 flex flex-col gap-2">
                                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Buyer Complaint (Laporan Pembeli)</span>
                                  <p className="text-zinc-300 italic pl-3 border-l border-l-rose-500 leading-relaxed">
                                    "{disp.reason}"
                                  </p>
                                  {disp.photos && (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {disp.photos.split(',').filter(Boolean).map((photoUrl: string, idx: number) => (
                                        <a key={idx} href={photoUrl} target="_blank" rel="noreferrer" className="block relative overflow-hidden rounded-lg border border-zinc-800 hover:border-zinc-700 transition shrink-0 bg-zinc-950">
                                          <img src={photoUrl} alt={`Evidence ${idx + 1}`} className="w-12 h-12 object-cover" />
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Seller Defense Side */}
                                <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-850/60 flex flex-col gap-2">
                                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Seller Defense (Pembelaan Penjual)</span>
                                  {disp.seller_defense ? (
                                    <>
                                      <p className="text-zinc-300 italic pl-3 border-l border-l-emerald-500 leading-relaxed">
                                        "{disp.seller_defense}"
                                      </p>
                                      {disp.seller_photos && (
                                        <div className="flex flex-wrap gap-2 mt-1">
                                          {disp.seller_photos.split(',').filter(Boolean).map((photoUrl: string, idx: number) => (
                                            <a key={idx} href={photoUrl} target="_blank" rel="noreferrer" className="block relative overflow-hidden rounded-lg border border-zinc-800 hover:border-zinc-700 transition shrink-0 bg-zinc-950">
                                              <img src={photoUrl} alt={`Defense ${idx + 1}`} className="w-12 h-12 object-cover" />
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                      <span className="text-[9px] text-zinc-500 font-mono mt-1">
                                        Responded: {new Date(disp.seller_responded_at).toLocaleString()}
                                      </span>
                                    </>
                                  ) : (
                                    <p className="text-zinc-500 italic pl-3 border-l border-l-zinc-800">
                                      Waiting for seller defense response.
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-zinc-400 font-mono text-[11px] mb-3">
                                <span className="truncate">
                                  <strong>Order Title:</strong> <span className="text-zinc-200 font-bold">{disp.projectTitle}</span>
                                </span>
                                <span>
                                  <strong>Purchase Price:</strong> <span className="text-indigo-400 font-bold">{disp.amount.toFixed(2)} USDC (~{disp.xlmAmount.toFixed(2)} XLM)</span>
                                </span>
                                <span className="truncate">
                                  <strong>Buyer:</strong> {disp.buyer_address}
                                </span>
                                <span>
                                  <strong>Date Reported:</strong> {new Date(disp.created_at || disp.createdAt).toLocaleString()}
                                </span>
                                <span className="truncate">
                                  <strong>Order/Tx ID:</strong> {disp.transaction_id}
                                </span>
                                {disp.resolved_at && (
                                  <span>
                                    <strong>Resolved At:</strong> {new Date(disp.resolved_at).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>

                            {disp.status === 'pending' && (
                              <div className="flex flex-row md:flex-col gap-2.5 shrink-0 w-full md:w-auto mt-2 md:mt-0">
                                <button
                                  type="button"
                                  disabled={resolvingDisputeId === disp.id}
                                  onClick={() => handleResolveDispute(disp.id, 'refund')}
                                  className="flex-1 md:w-32 bg-rose-600 hover:bg-rose-700 disabled:bg-zinc-800 text-white font-bold py-2 px-3 rounded-lg transition text-center shadow"
                                >
                                  {resolvingDisputeId === disp.id ? 'Processing...' : 'Refund Buyer'}
                                </button>
                                <button
                                  type="button"
                                  disabled={resolvingDisputeId === disp.id}
                                  onClick={() => handleResolveDispute(disp.id, 'release')}
                                  className="flex-1 md:w-32 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-800 text-white font-bold py-2 px-3 rounded-lg transition text-center shadow"
                                >
                                  {resolvingDisputeId === disp.id ? 'Processing...' : 'Release Funds'}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Disputes Pagination Controls */}
                      {totalDisputesPages > 1 && (
                        <div className="flex items-center justify-between border-t border-zinc-850 pt-4 mt-4 font-sans">
                          <button
                            type="button"
                            onClick={() => setDisputesPage(prev => Math.max(1, prev - 1))}
                            disabled={currentDisputesPage === 1}
                            className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" /> Previous
                          </button>
                          <span className="text-[11px] font-mono text-zinc-500">
                            Page <span className="text-zinc-300 font-bold">{currentDisputesPage}</span> of <span className="text-zinc-300 font-bold">{totalDisputesPages}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setDisputesPage(prev => Math.min(totalDisputesPages, prev + 1))}
                            disabled={currentDisputesPage === totalDisputesPages}
                            className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                          >
                            Next <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          ) : activeTab === 'dashboard' ? (
            <div className="flex flex-col gap-6 w-full animate-fade-in font-sans">
              {/* Financial Overview Cards */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-white">Overview</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* On Going */}
                  <div className="bg-zinc-900/35 border border-zinc-800 p-5 rounded-2xl flex flex-col gap-2 shadow-lg">
                    <span className="text-xs text-zinc-550 font-bold uppercase tracking-wider">On Going</span>
                    <span className="text-2xl font-black text-white font-mono">${ongoingEscrow.toFixed(2)}</span>
                  </div>
                  {/* On Hold */}
                  <div className="bg-zinc-900/35 border border-zinc-800 p-5 rounded-2xl flex flex-col gap-2 shadow-lg relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-550 font-bold uppercase tracking-wider">On Hold</span>
                      <span className="text-[10px] text-zinc-500 border border-zinc-800 w-4 h-4 rounded-full flex items-center justify-center cursor-help">i</span>
                    </div>
                    <span className="text-2xl font-black text-indigo-405 font-mono">${onHoldAmount.toFixed(2)}</span>
                    <div className="absolute top-12 left-5 z-20 w-52 p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[10px] text-zinc-400 leading-relaxed shadow-2xl opacity-0 group-hover:opacity-100 transition pointer-events-none">
                      Held securely in escrow for 24 hours of buyer review before releasing. Rate project to disburse instantly.
                    </div>
                  </div>
                  {/* Balance */}
                  <div className="bg-zinc-900/35 border border-zinc-800 p-5 rounded-2xl flex flex-col gap-2 shadow-lg">
                    <span className="text-xs text-zinc-550 font-bold uppercase tracking-wider">Balance</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono">${Math.max(0, currentBalance - onHoldAmount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* SELLER DISPUTES & DEFENSE SECTION */}
              {disputesList.filter(d => myCreatedProjects.some(p => p.id === d.project_id)).length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" /> Sengketa & Pembelaan (Active Disputes)
                  </h3>
                  <div className="flex flex-col gap-4 font-sans">
                    {disputesList.filter(d => myCreatedProjects.some(p => p.id === d.project_id)).map((disp) => {
                      const isPending = disp.status === 'pending';
                      const hasResponded = !!disp.seller_defense;

                      return (
                        <div
                          key={disp.id}
                          className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800 flex flex-col gap-4 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-white text-sm">Dispute #{disp.id}</span>
                              <span className="text-[10px] bg-zinc-950 border border-zinc-850 text-zinc-400 font-mono px-2 py-0.5 rounded">
                                Project: {disp.projectTitle}
                              </span>
                              <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                                disp.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : disp.status === 'resolved_refunded'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {disp.status.replace('_', ' ')}
                              </span>
                            </div>
                            <span className="font-mono text-zinc-500 text-[10px]">
                              Reported: {new Date(disp.created_at || disp.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Buyer Report Side */}
                            <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-850/60 flex flex-col gap-2.5">
                              <span className="text-[10px] text-zinc-550 uppercase font-black tracking-wider">Buyer Complaint (Laporan Pembeli)</span>
                              <p className="text-zinc-300 italic pl-3 border-l border-l-rose-500">
                                "{disp.reason}"
                              </p>
                              {disp.photos && (
                                <div className="flex flex-wrap gap-2.5 mt-1">
                                  {disp.photos.split(',').filter(Boolean).map((photoUrl: string, idx: number) => (
                                    <a key={idx} href={photoUrl} target="_blank" rel="noreferrer" className="block relative overflow-hidden rounded-lg border border-zinc-800 hover:border-zinc-700 transition shrink-0 bg-zinc-950">
                                      <img src={photoUrl} alt={`Evidence ${idx + 1}`} className="w-12 h-12 object-cover" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Seller Defense Side */}
                            <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-850/60 flex flex-col gap-2.5">
                              <span className="text-[10px] text-zinc-550 uppercase font-black tracking-wider">Seller Defense (Pembelaan Penjual)</span>
                              {hasResponded ? (
                                <>
                                  <p className="text-zinc-300 italic pl-3 border-l border-l-emerald-500">
                                    "{disp.seller_defense}"
                                  </p>
                                  {disp.seller_photos && (
                                    <div className="flex flex-wrap gap-2.5 mt-1">
                                      {disp.seller_photos.split(',').filter(Boolean).map((photoUrl: string, idx: number) => (
                                        <a key={idx} href={photoUrl} target="_blank" rel="noreferrer" className="block relative overflow-hidden rounded-lg border border-zinc-800 hover:border-zinc-700 transition shrink-0 bg-zinc-950">
                                          <img src={photoUrl} alt={`Defense ${idx + 1}`} className="w-12 h-12 object-cover" />
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                  <span className="text-[10px] text-zinc-550 font-mono mt-1">
                                    Responded at: {new Date(disp.seller_responded_at).toLocaleString()}
                                  </span>
                                </>
                              ) : (
                                <p className="text-zinc-500 italic pl-3 border-l border-l-zinc-800">
                                  No defense submitted yet. Fill the form below to respond.
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Submit Defense Form (only if pending and not yet responded) */}
                          {isPending && !hasResponded && (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleSubmitDefense(disp.id);
                              }}
                              className="border-t border-zinc-850 pt-4 flex flex-col gap-3"
                            >
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Submit Defense Statement (Pernyataan Pembelaan):</label>
                                <textarea
                                  rows={3}
                                  value={defenseText[disp.id] || ''}
                                  onChange={(e) => setDefenseText(prev => ({ ...prev, [disp.id]: e.target.value }))}
                                  placeholder="Provide clear details and proof explaining why the product conforms to description..."
                                  className="bg-zinc-950 border border-zinc-850 focus:border-zinc-700 rounded-xl p-3 text-xs text-zinc-200 placeholder:text-zinc-650 focus:outline-none resize-none font-sans"
                                  required
                                />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Defense Evidence Photos (Optional):</label>
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*"
                                  id={`defense-file-input-${disp.id}`}
                                  onChange={(e) => {
                                    if (e.target.files) {
                                      const filesArray = Array.from(e.target.files);
                                      setDefenseImages(prev => ({ ...prev, [disp.id]: filesArray }));
                                    }
                                  }}
                                  className="hidden"
                                />
                                <div className="flex items-center gap-3">
                                  <label
                                    htmlFor={`defense-file-input-${disp.id}`}
                                    className="border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950 px-4 py-2.5 rounded-xl text-center cursor-pointer transition text-xs text-zinc-400 font-semibold"
                                  >
                                    Select Photos ({(defenseImages[disp.id] || []).length} selected)
                                  </label>
                                  {(defenseImages[disp.id] || []).length > 0 && (
                                    <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[200px]">
                                      {(defenseImages[disp.id] || []).map(f => f.name).join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="submit"
                                disabled={submittingDefenseId === disp.id || uploadingDefenseId === disp.id}
                                className="bg-indigo-650 hover:bg-indigo-750 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow transition self-start disabled:opacity-50 mt-1 cursor-pointer"
                              >
                                {uploadingDefenseId === disp.id ? 'Uploading...' : (submittingDefenseId === disp.id ? 'Submitting...' : 'Submit Defense')}
                              </button>
                            </form>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Listing Overview Table */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-white">Listing Overview</h3>
                <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-md overflow-x-auto">
                  {myOrders.length === 0 ? (
                    <div className="text-center py-12 text-zinc-550 text-xs italic">
                      No customer purchase orders found.
                    </div>
                  ) : (
                    <>
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-zinc-850 text-zinc-500 font-bold uppercase text-[9px] tracking-wider">
                            <th className="pb-3 pl-2">Buyer</th>
                            <th className="pb-3">Order ID</th>
                            <th className="pb-3">Order Title</th>
                            <th className="pb-3">Purchase Date</th>
                            <th className="pb-3">Price</th>
                            <th className="pb-3">Status</th>
                            <th className="pb-3 text-right pr-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900/50">
                          {paginatedOrders.map((ord: any) => {
                            const dateStr = new Date(ord.timestamp).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) + ', ' + new Date(ord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            
                            // Check if review exists from this buyer for this project
                            const hasRated = creatorReviewsList.some((r: any) => r.projectId === ord.projectId && r.buyerAddress.toLowerCase() === ord.userAddress.toLowerCase());

                            return (
                              <tr key={ord.id} className="hover:bg-zinc-950/20 transition duration-150">
                                <td className="py-4 pl-2 font-medium flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] text-zinc-405 font-bold uppercase shadow-sm">
                                    {ord.userAddress.substring(0, 2)}
                                  </div>
                                  <span className="text-zinc-350">{getFriendlyName(ord.userAddress)}</span>
                                </td>
                                <td className="py-4 font-mono text-[10px] text-zinc-400">
                                  <div className="flex items-center gap-1">
                                    <span>{ord.id.substring(0, 8)}...</span>
                                    <button onClick={() => copyToClipboard(ord.id)} className="text-zinc-650 hover:text-white p-0.5 rounded transition">
                                      <FileText className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-4 text-zinc-300 max-w-[200px] truncate">{ord.projectTitle}</td>
                                <td className="py-4 text-zinc-400">{dateStr}</td>
                                <td className="py-4 font-mono"><span className="text-zinc-200 font-bold">${(ord.amount || 0).toFixed(2)}</span></td>
                                <td className="py-4">
                                  {hasRated ? (
                                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-black tracking-wide font-sans">
                                      Good Delivery
                                    </span>
                                  ) : (
                                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-black tracking-wide font-sans">
                                      Pending Escrow
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 text-right pr-2">
                                  <button className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-900 transition">
                                    •••
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Orders Pagination Controls */}
                      {totalOrdersPages > 1 && (
                        <div className="flex items-center justify-between border-t border-zinc-850 pt-4 mt-4">
                          <button
                            type="button"
                            onClick={() => setOrdersPage(prev => Math.max(1, prev - 1))}
                            disabled={currentOrdersPage === 1}
                            className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" /> Previous
                          </button>
                          <span className="text-[11px] font-mono text-zinc-500">
                            Page <span className="text-zinc-300 font-bold">{currentOrdersPage}</span> of <span className="text-zinc-300 font-bold">{totalOrdersPages}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setOrdersPage(prev => Math.min(totalOrdersPages, prev + 1))}
                            disabled={currentOrdersPage === totalOrdersPages}
                            className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                          >
                            Next <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
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
                            <span className="text-zinc-800 dark:text-emerald-400 font-mono font-black text-sm">
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
                            <span className="text-zinc-800 dark:text-emerald-400 font-mono font-black text-sm">
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

                        {/* Actions group */}
                        <div className="mt-1 flex items-center gap-2">
                          <Link 
                            href={`/project/${project.id}`} 
                            className="flex-grow flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition duration-300 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-xl hover:bg-zinc-800 hover:border-zinc-700/85 z-30 relative"
                          >
                            <span>Manage</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                          
                          <button
                            type="button"
                            onClick={(e) => openProfileEditModal(e, project)}
                            className="p-2.5 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 rounded-xl text-zinc-400 hover:text-indigo-400 transition cursor-pointer z-30 relative flex items-center justify-center shrink-0"
                            title="Edit Listing"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => openProfileDeleteModal(e, project)}
                            className="p-2.5 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 rounded-xl text-zinc-400 hover:text-rose-400 transition cursor-pointer z-30 relative flex items-center justify-center shrink-0"
                            title="Delete Listing"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
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
          ) : activeTab === 'my-reviews' ? (
            <div className="flex flex-col gap-6 w-full animate-fade-in font-sans">
              <div className="rounded-2xl border border-zinc-800 p-6 flex flex-col gap-6 bg-zinc-950">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-5 h-5 text-indigo-400" /> Customer Reviews & Feedback
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Aggregate reviews left by customers on your listings.
                  </p>
                </div>

                {creatorReviewsList.length === 0 ? (
                  <div className="text-center py-12 text-zinc-550 text-xs italic">
                    No reviews received yet.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-4">
                      {paginatedReviews.map((rev: any, i: number) => {
                        const ratingStars = '★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating);
                        return (
                          <div key={i} className="bg-zinc-900/35 border border-zinc-900 p-4.5 rounded-xl flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-300">{getFriendlyName(rev.buyerAddress)}</span>
                                <span className="text-amber-400 font-bold text-xs tracking-wider">{ratingStars}</span>
                              </div>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {new Date(rev.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <span className="text-[10px] text-indigo-455 font-mono">Project: {rev.projectTitle}</span>
                            <p className="text-xs text-zinc-400 italic">"{rev.comment || 'No comment provided.'}"</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Reviews Pagination Controls */}
                    {totalReviewsPages > 1 && (
                      <div className="flex items-center justify-between border-t border-zinc-850 pt-4 mt-4">
                        <button
                          type="button"
                          onClick={() => setReviewsPage(prev => Math.max(1, prev - 1))}
                          disabled={currentReviewsPage === 1}
                          className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Previous
                        </button>
                        <span className="text-[11px] font-mono text-zinc-500">
                          Page <span className="text-zinc-300 font-bold">{currentReviewsPage}</span> of <span className="text-zinc-300 font-bold">{totalReviewsPages}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setReviewsPage(prev => Math.min(totalReviewsPages, prev + 1))}
                          disabled={currentReviewsPage === totalReviewsPages}
                          className="flex items-center gap-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 disabled:opacity-40 disabled:hover:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs text-zinc-300 font-semibold transition"
                        >
                          Next <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
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

              {/* ADMIN DISPUTE MEDIATION PANEL */}
              {isAdmin && (
                <div className="rounded-xl glass-card p-6 border border-zinc-800 flex flex-col gap-6">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">Dispute Mediation Panel (Refunds & Escrow Audits)</h3>
                  </div>

                  {disputesList.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">No reported disputes recorded in the database.</p>
                  ) : (
                    <div className="flex flex-col gap-4 font-sans">
                      {disputesList.map((disp) => (
                        <div
                          key={disp.id}
                          className="bg-zinc-950 p-4.5 rounded-xl border border-zinc-850 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 text-xs"
                        >
                          <div className="flex flex-col gap-2.5 max-w-xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-white text-sm">Dispute #{disp.id}</span>
                              <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono px-2 py-0.5 rounded">
                                Project ID: {disp.project_id}
                              </span>
                              <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                                disp.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : disp.status === 'resolved_refunded'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {disp.status.replace('_', ' ')}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3 font-sans">
                              {/* Buyer Report Side */}
                              <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-850/60 flex flex-col gap-2">
                                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Buyer Complaint (Laporan Pembeli)</span>
                                <p className="text-zinc-300 italic pl-3 border-l border-l-rose-500 leading-relaxed">
                                  "{disp.reason}"
                                </p>
                                {disp.photos && (
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {disp.photos.split(',').filter(Boolean).map((photoUrl: string, idx: number) => (
                                      <a key={idx} href={photoUrl} target="_blank" rel="noreferrer" className="block relative overflow-hidden rounded-lg border border-zinc-800 hover:border-zinc-700 transition shrink-0 bg-zinc-950">
                                        <img src={photoUrl} alt={`Evidence ${idx + 1}`} className="w-12 h-12 object-cover" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Seller Defense Side */}
                              <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-850/60 flex flex-col gap-2">
                                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Seller Defense (Pembelaan Penjual)</span>
                                {disp.seller_defense ? (
                                  <>
                                    <p className="text-zinc-300 italic pl-3 border-l border-l-emerald-500 leading-relaxed">
                                      "{disp.seller_defense}"
                                    </p>
                                    {disp.seller_photos && (
                                      <div className="flex flex-wrap gap-2 mt-1">
                                        {disp.seller_photos.split(',').filter(Boolean).map((photoUrl: string, idx: number) => (
                                          <a key={idx} href={photoUrl} target="_blank" rel="noreferrer" className="block relative overflow-hidden rounded-lg border border-zinc-800 hover:border-zinc-700 transition shrink-0 bg-zinc-950">
                                            <img src={photoUrl} alt={`Defense ${idx + 1}`} className="w-12 h-12 object-cover" />
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                    <span className="text-[9px] text-zinc-500 font-mono mt-1">
                                      Responded: {new Date(disp.seller_responded_at).toLocaleString()}
                                    </span>
                                  </>
                                ) : (
                                  <p className="text-zinc-500 italic pl-3 border-l border-l-zinc-800">
                                    Waiting for seller defense response.
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-zinc-400 font-mono text-[11px] mb-3">
                              <span className="truncate">
                                <strong>Order Title:</strong> <span className="text-zinc-200 font-bold">{disp.projectTitle}</span>
                              </span>
                              <span>
                                <strong>Purchase Price:</strong> <span className="text-indigo-400 font-bold">{disp.amount.toFixed(2)} USDC (~{disp.xlmAmount.toFixed(2)} XLM)</span>
                              </span>
                              <span className="truncate">
                                <strong>Buyer:</strong> {disp.buyer_address}
                              </span>
                              <span>
                                <strong>Date Reported:</strong> {new Date(disp.created_at || disp.createdAt).toLocaleString()}
                              </span>
                              <span className="truncate">
                                <strong>Order/Tx ID:</strong> {disp.transaction_id}
                              </span>
                              {disp.resolved_at && (
                                <span>
                                  <strong>Resolved At:</strong> {new Date(disp.resolved_at).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>

                          {disp.status === 'pending' && (
                            <div className="flex flex-row md:flex-col gap-2.5 shrink-0 w-full md:w-auto mt-2 md:mt-0">
                              <button
                                type="button"
                                disabled={resolvingDisputeId === disp.id}
                                onClick={() => handleResolveDispute(disp.id, 'refund')}
                                className="flex-1 md:w-32 bg-rose-600 hover:bg-rose-700 disabled:bg-zinc-800 text-white font-bold py-2 px-3 rounded-lg transition text-center shadow"
                              >
                                {resolvingDisputeId === disp.id ? 'Processing...' : 'Refund Buyer'}
                              </button>
                              <button
                                type="button"
                                disabled={resolvingDisputeId === disp.id}
                                onClick={() => handleResolveDispute(disp.id, 'release')}
                                className="flex-1 md:w-32 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-800 text-white font-bold py-2 px-3 rounded-lg transition text-center shadow"
                              >
                                {resolvingDisputeId === disp.id ? 'Processing...' : 'Release Funds'}
                              </button>
                            </div>
                          )}
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
      {/* Profile Edit Listing Modal */}
      {editingProfileProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setEditingProfileProject(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition p-1 hover:bg-zinc-900 rounded-full cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" /> Edit Campaign Listing
              </h3>
              <p className="text-xs text-zinc-550 mt-1">
                Modify campaign details. Click save to persist updates.
              </p>
            </div>

            <form onSubmit={handleProfileEditSubmit} className="flex flex-col gap-4 text-xs sm:text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-400">Campaign Title</label>
                <input
                  type="text"
                  required
                  value={profileEditTitle}
                  onChange={(e) => setProfileEditTitle(e.target.value)}
                  className="bg-zinc-900 border border-zinc-850 rounded-xl p-3 text-white outline-none focus:border-indigo-500 transition"
                  placeholder="Enter listing name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-400">Description</label>
                <textarea
                  required
                  rows={5}
                  value={profileEditDescription}
                  onChange={(e) => setProfileEditDescription(e.target.value)}
                  className="bg-zinc-900 border border-zinc-850 rounded-xl p-3 text-white outline-none focus:border-indigo-500 transition resize-none font-sans leading-relaxed"
                  placeholder="Describe your creative deliverables..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-400">Category</label>
                  <select
                    value={profileEditCategory}
                    onChange={(e) => setProfileEditCategory(e.target.value)}
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
                    value={profileEditTargetAmount}
                    onChange={(e) => setProfileEditTargetAmount(e.target.value)}
                    className="bg-zinc-900 border border-zinc-850 rounded-xl p-3 text-white outline-none focus:border-indigo-500 transition"
                    placeholder="e.g. 50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-400">Cover Product Images</label>
                <div className="flex items-center gap-4">
                  {profileEditImageUrl && (
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 shrink-0">
                      <img src={profileEditImageUrl.split(',')[0]} alt="Current preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const filesArray = Array.from(e.target.files || []);
                        setProfileEditImageFiles(filesArray);
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
                  onClick={() => setEditingProfileProject(null)}
                  className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 px-5 py-2.5 rounded-xl font-bold text-zinc-400 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingProfileProject}
                  className="bg-indigo-650 hover:bg-indigo-750 disabled:bg-zinc-800 text-white font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 glow-primary cursor-pointer"
                >
                  {updatingProfileProject ? (
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

      {/* Profile Delete Campaign Confirmation Modal */}
      {deletingProfileProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
          <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col gap-5 shadow-2xl">
            <button
              onClick={() => setDeletingProfileProject(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition p-1 hover:bg-zinc-900 rounded-full cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
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
              Are you sure you want to delete listing <strong>"{deletingProfileProject.title}"</strong>? This will permanently delete metadata, milestones, reviews/ratings, and disputes.
            </p>

            <div className="flex items-center justify-end gap-3 mt-2 border-t border-zinc-900 pt-4 text-xs font-sans">
              <button
                type="button"
                onClick={() => setDeletingProfileProject(null)}
                className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 px-4 py-2.5 rounded-xl font-bold text-zinc-400 transition cursor-pointer"
              >
                Keep Listing
              </button>
              <button
                type="button"
                disabled={isDeletingProfileProject}
                onClick={handleProfileDeleteSubmit}
                className="bg-rose-650 hover:bg-rose-750 disabled:bg-zinc-800 text-white font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingProfileProject ? (
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
        </section>
      </main>
    </div>
  );
}
