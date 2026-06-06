'use client';

import { useState, useEffect } from 'react';
import Header from '@/app/components/Header';
import { getCampaign, CampaignState } from '@/lib/stellar';
import CustomSelect from '@/app/components/CustomSelect';
import { ProjectMetadata } from '@/lib/db';
import {
  ArrowUpRight,
  Landmark,
  Clock,
  Search,
  RefreshCw,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Tag,
  X,
  Coins,
  Sparkles,
  Laptop,
  Palette,
  Music,
  BookOpen,
  Video,
  TrendingUp
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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [blockchainStates, setBlockchainStates] = useState<Record<number, CampaignState>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState<string>('All'); // 'All', '0', '1', '2'
  const [sortBy, setSortBy] = useState('newest');

  // E-commerce UI states
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All'); // 'All', 'Active', 'Completed', 'Reached', 'Cancelled'
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedType, sortBy, searchQuery, minPrice, maxPrice, selectedStatus]);

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
    fetchProjects();

    // Listen for wallet changes
    window.addEventListener('walletChange', fetchProjects);
    return () => {
      window.removeEventListener('walletChange', fetchProjects);
    };
  }, []);

  // Filter and Sort projects
  const filteredAndSortedProjects = projects
    .filter((p) => {
      // Filter out completed or aborted projects
      const chainState = blockchainStates[p.id];
      if (chainState && (chainState.is_completed || chainState.is_aborted)) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'All' && p.category !== selectedCategory) {
        return false;
      }
      // Project Type filter
      if (selectedType !== 'All' && String(p.projectType ?? 1) !== selectedType) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'All') {
        const pledged = chainState ? chainState.pledged_amount : 0;
        const isReached = pledged >= p.targetAmount;

        if (selectedStatus === 'Reached' && !isReached) return false;
        if (selectedStatus === 'Active' && isReached) return false;
      }
      // Price range filters
      if (minPrice !== '' && p.targetAmount < parseFloat(minPrice)) {
        return false;
      }
      if (maxPrice !== '' && p.targetAmount > parseFloat(maxPrice)) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        return (
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.creatorAddress.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'target_desc') {
        return b.targetAmount - a.targetAmount;
      }
      if (sortBy === 'target_asc') {
        return a.targetAmount - b.targetAmount;
      }
      if (sortBy === 'progress_desc') {
        const progressA = blockchainStates[a.id] ? (blockchainStates[a.id].pledged_amount / a.targetAmount) : 0;
        const progressB = blockchainStates[b.id] ? (blockchainStates[b.id].pledged_amount / b.targetAmount) : 0;
        return progressB - progressA;
      }
      return 0;
    });

  const ITEMS_PER_PAGE = 15;
  const totalPages = Math.ceil(filteredAndSortedProjects.length / ITEMS_PER_PAGE);
  const currentPageResolved = Math.max(1, Math.min(currentPage, totalPages));
  const paginatedProjects = filteredAndSortedProjects.slice(
    (currentPageResolved - 1) * ITEMS_PER_PAGE,
    currentPageResolved * ITEMS_PER_PAGE
  );

  // Calculate Metrics Summary
  const totalListings = projects.filter(p => {
    const chainState = blockchainStates[p.id];
    if (chainState && (chainState.is_completed || chainState.is_aborted)) {
      return false;
    }
    return true;
  }).length;
  const activePoolsCount = projects.filter(p => {
    const chainState = blockchainStates[p.id];
    const projectType = p.projectType ?? 1;
    if (projectType !== 1) return false;
    if (!chainState) return true;
    return !chainState.is_completed && !chainState.is_aborted;
  }).length;
  const instantBuyCount = projects.filter(p => {
    if ((p.projectType ?? 1) !== 0) return false;
    const chainState = blockchainStates[p.id];
    if (chainState && (chainState.is_completed || chainState.is_aborted)) {
      return false;
    }
    return true;
  }).length;
  const totalVolumePledged = Object.values(blockchainStates).reduce((sum, state) => sum + state.pledged_amount, 0);

  // Category Icon Map
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Technology': return <Laptop className="w-3.5 h-3.5" />;
      case 'Design & Art': return <Palette className="w-3.5 h-3.5" />;
      case 'Music & Audio': return <Music className="w-3.5 h-3.5" />;
      case 'Writing & Literature': return <BookOpen className="w-3.5 h-3.5" />;
      case 'Video & Animation': return <Video className="w-3.5 h-3.5" />;
      default: return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  const getCategoryIconLarge = (category: string) => {
    const cn = "w-7 h-7 text-white/20 shrink-0";
    switch (category) {
      case 'Technology': return <Laptop className={cn} />;
      case 'Design & Art': return <Palette className={cn} />;
      case 'Music & Audio': return <Music className={cn} />;
      case 'Writing & Literature': return <BookOpen className={cn} />;
      case 'Video & Animation': return <Video className={cn} />;
      default: return <Sparkles className={cn} />;
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

  const getFriendlyName = (addr: string) => {
    if (addr === 'GB_CREATOR_ADDRESS_STW_NORTHGATE') return 'Creator';
    if (addr === 'GB_CONTRIBUTOR_1_STW_NORTHGATE') return 'Backer 1';
    if (addr === 'GB_CONTRIBUTOR_2_STW_NORTHGATE') return 'Backer 2';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 md:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">

        {/* Page Header */}
        <section className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            Explore <span className="text-indigo-400">Creative Marketplace</span>
          </h1>
        </section>

        {/* Dashboard Summary Banner */}
        <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-reveal-up">
          <div className="bg-zinc-900/30 border border-zinc-800/60 p-3 sm:p-4 rounded-xl flex items-center justify-between hover:border-zinc-700 transition duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Total Listings</span>
              <span className="text-lg sm:text-xl font-black text-white">{totalListings}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Tag className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/30 border border-zinc-800/60 p-3 sm:p-4 rounded-xl flex items-center justify-between hover:border-zinc-700 transition duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Active Crowdfunds</span>
              <span className="text-lg sm:text-xl font-black text-white">{activePoolsCount}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/30 border border-zinc-800/60 p-3 sm:p-4 rounded-xl flex items-center justify-between hover:border-zinc-700 transition duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Instant Buy Items</span>
              <span className="text-lg sm:text-xl font-black text-white">{instantBuyCount}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 shrink-0">
              <Coins className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/30 border border-zinc-800/60 p-3 sm:p-4 rounded-xl flex items-center justify-between hover:border-zinc-700 transition duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pledged Volume</span>
              <span className="text-lg sm:text-xl font-black text-emerald-450 font-mono">{Math.round(totalVolumePledged)} USDC</span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Filters and Controls */}
        <section className="flex flex-col gap-3 sm:gap-4 bg-zinc-900/30 border border-zinc-800/80 p-3 sm:p-5 rounded-xl">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            {/* Search Bar */}
            <div className="relative flex-1 min-w-0">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search by title, description, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-indigo-650 text-zinc-200 text-xs rounded-lg pl-9 pr-4 py-2.5 outline-none transition font-medium"
              />
            </div>

            {/* Filters by Project Type & Sorting */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Collapsible Trigger */}
              <button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition duration-300 ${filtersExpanded
                    ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400 shadow-md'
                    : 'bg-zinc-950 border-zinc-850 hover:border-zinc-750 text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-550 font-medium whitespace-nowrap">Distributor:</span>
                <CustomSelect
                  value={selectedType}
                  onChange={setSelectedType}
                  options={[
                    { value: 'All', label: 'All Types' },
                    { value: '0', label: 'Instant Buy' },
                    { value: '1', label: 'Crowdfunding Pools' },
                    { value: '2', label: 'Custom Escrow' },
                  ]}
                  className="w-40"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-550 font-medium whitespace-nowrap">Sort:</span>
                <CustomSelect
                  value={sortBy}
                  onChange={setSortBy}
                  options={[
                    { value: 'newest', label: 'Newest' },
                    { value: 'target_desc', label: 'Highest Price' },
                    { value: 'target_asc', label: 'Lowest Price' },
                    { value: 'progress_desc', label: 'Highest Progress' },
                  ]}
                  className="w-40"
                />
              </div>

              <div className="border-l border-zinc-800 h-6 mx-1 hidden sm:block"></div>

              {/* Grid/List View Toggler */}
              <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-850 text-zinc-450 text-xs">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition duration-200 ${viewMode === 'grid' ? 'bg-zinc-850 text-indigo-400' : 'hover:text-zinc-200'
                    }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded transition duration-200 ${viewMode === 'list' ? 'bg-zinc-850 text-indigo-400' : 'hover:text-zinc-200'
                    }`}
                  title="List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Collapsible Filter Panel */}
          {filtersExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850/60 mt-2 animate-reveal-up">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Blockchain Status</label>
                <CustomSelect
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  options={[
                    { value: 'All', label: 'All Statuses' },
                    { value: 'Active', label: 'Active / Funding' },
                    { value: 'Reached', label: 'Target Reached' },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Price Range (USDC)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min Price (USDC)"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-indigo-650 text-zinc-200 text-xs rounded-lg p-2.5 outline-none transition font-medium"
                  />
                  <span className="text-zinc-600 text-xs font-bold font-mono px-1">to</span>
                  <input
                    type="number"
                    placeholder="Max Price (USDC)"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-indigo-650 text-zinc-200 text-xs rounded-lg p-2.5 outline-none transition font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-zinc-800/60 my-1"></div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap w-full pb-1 font-sans">
            {['All', 'Technology', 'Design & Art', 'Music & Audio', 'Writing & Literature', 'Video & Animation'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                    : 'bg-zinc-950/40 text-zinc-400 border border-zinc-850 hover:text-zinc-200'
                  }`}
              >
                {getCategoryIcon(cat)}
                <span>{cat}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Active Filter Badges */}
        {(selectedCategory !== 'All' || selectedType !== 'All' || selectedStatus !== 'All' || minPrice !== '' || maxPrice !== '' || searchQuery !== '') && (
          <div className="flex flex-wrap items-center gap-2 -mt-4 animate-reveal-up">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mr-1">Active Filters:</span>

            {selectedCategory !== 'All' && (
              <span className="flex items-center gap-1.5 bg-indigo-950/20 border border-indigo-500/25 px-2.5 py-1 rounded-full text-xs text-indigo-300">
                <span>{selectedCategory}</span>
                <button onClick={() => setSelectedCategory('All')} className="text-indigo-400 hover:text-indigo-200">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedType !== 'All' && (
              <span className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full text-xs text-zinc-300">
                <span>{selectedType === '0' ? 'Instant Buy' : selectedType === '1' ? 'Crowdfunding' : 'Custom Escrow'}</span>
                <button onClick={() => setSelectedType('All')} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedStatus !== 'All' && (
              <span className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full text-xs text-zinc-300">
                <span>Status: {selectedStatus}</span>
                <button onClick={() => setSelectedStatus('All')} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {(minPrice !== '' || maxPrice !== '') && (
              <span className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full text-xs text-zinc-300">
                <span>Price: {minPrice || '0'} - {maxPrice || '∞'} USDC</span>
                <button onClick={() => { setMinPrice(''); setMaxPrice(''); }} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {searchQuery !== '' && (
              <span className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full text-xs text-zinc-300">
                <span>Query: &quot;{searchQuery}&quot;</span>
                <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              onClick={() => {
                setSelectedCategory('All');
                setSelectedType('All');
                setSelectedStatus('All');
                setMinPrice('');
                setMaxPrice('');
                setSearchQuery('');
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold hover:underline ml-2"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Project Results */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Market Listings
            </h2>
            <span className="text-xs text-zinc-500 font-mono">
              Showing {filteredAndSortedProjects.length} Projects
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-zinc-400 text-sm">Querying active ledger state...</p>
            </div>
          ) : filteredAndSortedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/10 border border-zinc-900 border-dashed rounded-xl p-8 text-center gap-3">
              <RefreshCw className="w-8 h-8 text-zinc-650" />
              <h3 className="text-base font-bold text-white">No Listings Found</h3>
              <p className="text-zinc-500 text-xs max-w-xs leading-relaxed">
                No active projects matched your criteria. Revise your search tags, price sliders or filters to locate items.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setSelectedType('All');
                  setSelectedStatus('All');
                  setMinPrice('');
                  setMaxPrice('');
                  setSearchQuery('');
                }}
                className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg glow-primary transition"
              >
                Reset Filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View - Matches Dashboard Card Aesthetics exactly */
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8"
            >
              {paginatedProjects.map((project) => {
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

                return (
                  <motion.div
                    key={project.id}
                    variants={itemVariants}
                    whileHover={{ y: -6, scale: 1.015 }}
                    className="flex flex-col h-full rounded-3xl glass-card overflow-hidden hover-glow-card group shadow-lg border border-white/5 hover:border-white/10 transition-all duration-300 relative cursor-pointer"
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
                                    ? `${(chainState.current_milestone / chainState.total_milestones) * 100}%`
                                    : '0%'
                                }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          /* Instant Buy Delivery Info */
                          <div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-zinc-555">Delivery Access</span>
                              <span className="font-bold text-emerald-400 font-mono">Instant Unlock</span>
                            </div>
                          </div>
                        )}

                        {/* Details */}
                        <div className="flex justify-between border-t border-zinc-800/40 pt-3 text-xs text-zinc-500">
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
          ) : (
            /* List View */
            <div className="flex flex-col gap-3 animate-reveal-up">
              {paginatedProjects.map((project, index) => {
                const chainState = blockchainStates[project.id];
                const pledged = chainState ? chainState.pledged_amount : 0;

                let progress = 0;
                let badgeText = 'Active';
                let badgeColor = 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';

                const isCompleted = chainState ? chainState.is_completed : false;
                const isAborted = chainState ? chainState.is_aborted : false;
                const projectType = project.projectType ?? 1;

                if (projectType === 0) {
                  badgeText = 'Instant Buy';
                  badgeColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                } else if (projectType === 2) {
                  badgeText = 'Custom Escrow';
                  badgeColor = 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
                  progress = pledged > 0 ? 100 : 0;
                } else {
                  progress = Math.min(Math.round((pledged / project.targetAmount) * 100), 100);
                  if (isCompleted) {
                    badgeText = 'Completed';
                    badgeColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                  } else if (isAborted) {
                    badgeText = 'Cancelled';
                    badgeColor = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                  } else if (pledged >= project.targetAmount) {
                    badgeText = 'Reached';
                    badgeColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                  } else {
                    badgeText = 'Pool Active';
                    badgeColor = 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
                  }
                }

                // Calculate remaining days
                const nowSec = Math.floor(Date.now() / 1000);
                const deadlineSec = chainState ? chainState.deadline : nowSec;
                const diffTime = deadlineSec - nowSec;
                const daysLeft = Math.max(Math.ceil(diffTime / (24 * 60 * 60)), 0);

                return (
                  <div
                    key={project.id}
                    className="flex flex-col md:flex-row items-stretch md:items-center justify-between p-4 bg-zinc-900/30 border border-zinc-800/60 hover:border-zinc-700/80 rounded-xl gap-4 hover-glow-card relative group cursor-pointer transition-all duration-300"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {/* Entire row link overlay */}
                    <Link href={`/project/${project.id}`} className="absolute inset-0 z-20" />
                    {/* Visual Category Icon & Title */}
                    <div className="flex items-center gap-4 flex-1 min-w-0 relative z-10">
                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 shrink-0 group-hover:scale-105 transition duration-300">
                        {getCategoryIconLarge(project.category)}
                      </div>
                      <div className="min-w-0 flex flex-col gap-1">
                        {projectType === 0 && (
                          <span className="text-emerald-450 font-mono font-black text-xs">
                            {project.targetAmount} USDC
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base truncate group-hover:text-indigo-400 transition">
                            {project.title}
                          </h3>
                          <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border shrink-0 ${badgeColor}`}>
                            {badgeText}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-555 font-mono flex items-center gap-1.5 flex-wrap">
                          <span>Category: <strong className="text-zinc-400">{project.category}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Progress / Milestones */}
                    <div className="flex flex-col gap-1.5 w-full md:w-48 shrink-0 relative z-10">
                      {projectType === 1 ? (
                        <>
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-zinc-555">Progress</span>
                            <span className="text-indigo-400 font-bold">{progress}%</span>
                          </div>
                          <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-850">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progress}%` }}></div>
                          </div>
                        </>
                      ) : projectType === 2 ? (
                        <>
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-zinc-555">Milestones</span>
                            <span className="text-purple-400 font-bold">
                              {chainState ? `${chainState.current_milestone}/${chainState.total_milestones}` : '0/0'}
                            </span>
                          </div>
                          <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-850">
                            <div
                              className="bg-gradient-to-r from-purple-600 to-pink-500 h-full rounded-full"
                              style={{
                                width: chainState && chainState.total_milestones > 0
                                  ? `${(chainState.current_milestone / chainState.total_milestones) * 100}%`
                                  : '0%'
                              }}
                            ></div>
                          </div>
                        </>
                      ) : null}
                    </div>

                    {/* Raised & Target Metrics */}
                    <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto relative z-10 border-t md:border-t-0 border-zinc-850/60 pt-3 md:pt-0">
                      {projectType !== 0 && (
                        <div className="flex gap-4 text-xs font-mono">
                          <div className="flex flex-col">
                            <span className="text-[9px] uppercase font-bold text-zinc-555">Raised</span>
                            <span className="text-emerald-450 font-bold">{pledged.toFixed(2)} USDC</span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-[9px] uppercase font-bold text-zinc-550">Target</span>
                            <span className="text-zinc-300 font-bold">{project.targetAmount} USDC</span>
                          </div>
                        </div>
                      )}

                      {projectType === 1 && (
                        <div className="text-[10px] bg-zinc-950/60 border border-zinc-850 p-2 rounded-lg text-zinc-400 flex items-center gap-1 font-mono shrink-0">
                          <Clock className="w-3.5 h-3.5 text-zinc-550" />
                          <span>{daysLeft}d left</span>
                        </div>
                      )}

                      <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400 group-hover:bg-zinc-800 group-hover:text-white transition duration-300 shrink-0">
                        <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8 bg-zinc-900/25 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPageResolved === 1}
                className="px-4 py-2 text-xs font-bold bg-zinc-950/60 hover:bg-zinc-900 text-zinc-450 hover:text-white border border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition duration-300"
              >
                Previous
              </button>
              <span className="text-xs text-zinc-500 font-mono">
                Page <span className="text-zinc-300 font-bold">{currentPageResolved}</span> of <span className="text-zinc-300 font-bold">{totalPages}</span>
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPageResolved === totalPages}
                className="px-4 py-2 text-xs font-bold bg-zinc-950/60 hover:bg-zinc-900 text-zinc-450 hover:text-white border border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition duration-300"
              >
                Next
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
