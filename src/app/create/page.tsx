'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import { createCampaign, isCreatorApproved, isMockMode, verifyCreatorZk } from '@/lib/stellar';
import CustomSelect from '@/app/components/CustomSelect';
import { MilestoneDetail } from '@/lib/db';
import { 
  Plus, 
  Trash2, 
  Upload, 
  HelpCircle, 
  Loader2, 
  Sparkles, 
  ArrowLeft, 
  CheckCircle,
  FileText,
  Lock,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function CreateCampaign() {
  const router = useRouter();
  
  // Wallet & verification state
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [verifiedCreator, setVerifiedCreator] = useState<boolean>(false);
  const [checkingVerification, setCheckingVerification] = useState<boolean>(true);
  
  // Form fields
  const [projectType, setProjectType] = useState<number>(1); // 0: Instant Buy, 1: Crowdfund, 2: Custom Milestone
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('500');
  const [durationDays, setDurationDays] = useState('30');
  const [category, setCategory] = useState('Technology');
  const [clientAddress, setClientAddress] = useState('');
  const [minContribution, setMinContribution] = useState('0.5');
  
  // Milestones for Custom Milestone type
  const [milestones, setMilestones] = useState<MilestoneDetail[]>([
    { title: 'Milestone 1: Prototype / Initial Sketch', description: 'Complete initial concept meshes and structural mockups.' },
    { title: 'Milestone 2: Final Output Assets', description: 'Deliver final encrypted high-fidelity files.' }
  ]);
  const [percentages, setPercentages] = useState<string[]>(['30', '70']);
  const [file, setFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  // Flow status
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentStep, setCurrentStep] = useState(0); // 0: Idle, 1: Uploading/Encrypting, 2: Deploying Contract, 3: Saving Metadata, 4: Done

  const checkCreatorVerification = async (addr: string) => {
    try {
      setCheckingVerification(true);
      let isApproved = await isCreatorApproved(addr);
      
      // Auto-sync approved applications in mock mode
      if (!isApproved) {
        const appRes = await fetch(`/api/creators?address=${addr}`);
        if (appRes.ok) {
          const appData = await appRes.json();
          if (appData && appData.status === 'approved') {
            if (isMockMode()) {
              try {
                const nullifier = appData.nullifierHash || 'zk_nullifier_default';
                const proof = appData.zkProof || 'zk_verification_key_default';
                await verifyCreatorZk(addr, nullifier, proof);
                isApproved = true;
              } catch (err) {
                console.error('Error auto-syncing mock verification in create campaign page:', err);
              }
            }
          }
        }
      }
      
      setVerifiedCreator(isApproved);
    } catch (err) {
      console.error('Error checking creator verification:', err);
      setVerifiedCreator(false);
    } finally {
      setCheckingVerification(false);
    }
  };

  useEffect(() => {
    const savedAddr = localStorage.getItem('earnly_wallet_address');
    if (savedAddr) {
      setWalletAddress(savedAddr);
      checkCreatorVerification(savedAddr);
    } else {
      setCheckingVerification(false);
    }
    
    const handleWalletChange = () => {
      const addr = localStorage.getItem('earnly_wallet_address') || '';
      setWalletAddress(addr);
      if (addr) {
        checkCreatorVerification(addr);
      } else {
        setVerifiedCreator(false);
        setCheckingVerification(false);
      }
    };

    window.addEventListener('walletChange', handleWalletChange);
    return () => {
      window.removeEventListener('walletChange', handleWalletChange);
    };
  }, []);

  const addMilestone = () => {
    setMilestones([...milestones, { title: `Milestone ${milestones.length + 1}: `, description: '' }]);
    setPercentages([...percentages, '0']);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length <= 2) {
      alert('A minimum of 2 Milestones is required for progressive releases.');
      return;
    }
    const list = [...milestones];
    list.splice(index, 1);
    setMilestones(list);

    const pctList = [...percentages];
    pctList.splice(index, 1);
    setPercentages(pctList);
  };

  const updateMilestone = (index: number, field: keyof MilestoneDetail, value: string) => {
    const list = [...milestones];
    list[index][field] = value;
    setMilestones(list);
  };

  const updatePercentage = (index: number, value: string) => {
    const pctList = [...percentages];
    pctList[index] = value;
    setPercentages(pctList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      alert('Please connect your Freighter wallet or switch mock account in the top-right.');
      return;
    }
    
    // Identity gate check
    if (!verifiedCreator) {
      alert('Your wallet is not verified as an approved creator. Verify on the Profile page.');
      return;
    }

    const targetVal = Number(targetAmount);
    if (isNaN(targetVal) || targetVal < 0.5) {
      alert('Funding target or retail price must be at least 0.5 USDC.');
      return;
    }

    // Type-specific validations
    if (projectType === 0 || projectType === 1) {
      if (!file) {
        alert('Please select the digital asset file to upload.');
        return;
      }
    }

    if (projectType === 2) {
      if (clientAddress.trim() && clientAddress.trim().toLowerCase() === walletAddress.toLowerCase()) {
        alert('Anda tidak dapat memasukkan alamat wallet Anda sendiri sebagai pembeli (buyer).');
        return;
      }
      if (milestones.some(m => !m.title.trim() || !m.description.trim())) {
        alert('Please fill out the title and deliverables description for all Milestones.');
        return;
      }
      
      const sum = percentages.reduce((acc, curr) => acc + (Number(curr) || 0), 0);
      if (sum !== 100) {
        alert(`Milestone weights must sum to exactly 100%. Current sum: ${sum}%`);
        return;
      }
    }

    try {
      setLoading(true);
      let fileDetails = null;
      let imageUrl = '';

      // Step 1: Upload files
      if ((projectType !== 2 && file) || imageFiles.length > 0) {
        setCurrentStep(1);
        setStatusMessage('Uploading files...');
        
        // Upload images if present
        if (imageFiles.length > 0) {
          const uploadedUrls: string[] = [];
          for (let i = 0; i < imageFiles.length; i++) {
            setStatusMessage(`Uploading product image ${i + 1} of ${imageFiles.length}...`);
            const imgFormData = new FormData();
            imgFormData.append('file', imageFiles[i]);
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
          console.log('Product images uploaded successfully:', imageUrl);
        }

        // Upload and encrypt deliverable asset package
        if (projectType !== 2 && file) {
          setStatusMessage('Uploading & local AES-256 encrypting of deliverable file...');
          const formData = new FormData();
          formData.append('file', file);
          
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!uploadRes.ok) {
            throw new Error('Failed to upload and encrypt digital asset.');
          }

          fileDetails = await uploadRes.json();
          console.log('File encrypted and uploaded:', fileDetails);
        }
      }

      // Step 2: Deploy / create campaign on smart contract
      setCurrentStep(2);
      setStatusMessage('Broadcasting deployment transaction to Soroban Stellar Network...');
      
      const targetInt = Number(targetAmount);
      const totalMilestonesCount = projectType === 2 ? milestones.length : projectType === 1 ? 1 : 0;
      const durationInt = projectType === 0 ? 0 : Number(durationDays);
      const clientAddrParam = projectType === 2 ? clientAddress : walletAddress;
      const milestonePcts = projectType === 2 ? percentages.map(Number) : undefined;

      const contractProjectId = await createCampaign(
        walletAddress,
        targetInt,
        totalMilestonesCount,
        durationInt,
        projectType,
        clientAddrParam,
        milestonePcts
      );
      
      console.log('Contract registered on chain. ID:', contractProjectId);

      // Step 3: Save metadata to JSON DB
      setCurrentStep(3);
      setStatusMessage('Recording project metadata and cryptographic details in index DB...');
      
      const dbRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: contractProjectId,
          title,
          description,
          creatorAddress: walletAddress,
          targetAmount: targetInt,
          category,
          milestonesCount: totalMilestonesCount,
          milestoneDetails: projectType === 2 ? milestones : [],
          fileDetails,
          projectType,
          clientAddress: clientAddrParam,
          milestonePercentages: milestonePcts,
          imageUrl: imageUrl || '',
          minContribution: projectType === 1 ? Number(minContribution) : 0.5
        }),
      });

      if (!dbRes.ok) {
        throw new Error('Failed to record project database metadata.');
      }

      // Step 4: Done
      setCurrentStep(4);
      setStatusMessage('Project listed successfully! Redirecting...');
      
      window.dispatchEvent(new Event('walletChange'));
      
      setTimeout(() => {
        router.push(`/project/${contractProjectId}`);
      }, 1500);
      
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'System execution error.');
      setLoading(false);
      setCurrentStep(0);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-4 md:px-8 py-6 sm:py-8 flex flex-col gap-5 sm:gap-6">
        {/* Back navigation */}
        <div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition text-xs font-semibold">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>

        {/* Page Title */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
            <Plus className="w-6 h-6 text-indigo-400" /> Start New Creative Project
          </h1>
          <p className="text-sm text-zinc-400">
            Publish an instant-buy asset, create a crowdfunded release pool, or construct a custom milestone contract.
          </p>
        </div>

        {checkingVerification ? (
          <div className="rounded-xl glass-card p-10 flex flex-col items-center justify-center border border-zinc-800 text-center gap-2">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-zinc-400 text-sm">Validating compliance gating status...</p>
          </div>
        ) : !walletAddress ? (
          <div className="rounded-xl glass-card p-10 flex flex-col items-center justify-center border border-zinc-800 text-center gap-4">
            <Lock className="w-12 h-12 text-zinc-650" />
            <h3 className="text-lg font-bold text-white">Wallet Connection Required</h3>
            <p className="text-zinc-400 text-sm max-w-md">
              Please connect your Freighter wallet or switch mock accounts using the wallet menu in the navbar to create listings.
            </p>
          </div>
        ) : !verifiedCreator ? (
          <div className="rounded-xl glass-card p-10 flex flex-col items-center justify-center border border-zinc-800 text-center gap-4 bg-gradient-to-b from-zinc-900 to-zinc-950">
            <Lock className="w-12 h-12 text-rose-500 animate-pulse" />
            <h3 className="text-lg font-bold text-white">Creator Verification Required</h3>
            <p className="text-zinc-400 text-sm max-w-md leading-relaxed">
              Compliance standards mandate Web2 verification and Web3 smart contract activation before registering listings.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <Link
                href="/profile?tab=seller-verification"
                className="bg-indigo-650 hover:bg-indigo-750 text-white font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition"
              >
                Go to Verification Page <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : loading ? (
          /* Processing Steps Progress */
          <div className="rounded-xl glass-card p-10 flex flex-col items-center justify-center text-center gap-6 border border-zinc-800">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-bold text-white">Processing Smart Contract Deployments</h3>
              <p className="text-zinc-400 text-sm font-medium">{statusMessage}</p>
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2 mt-4 text-xs flex-wrap justify-center">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold font-mono text-[10px] sm:text-xs ${currentStep > 1 ? 'bg-indigo-600/30 text-indigo-400' : currentStep === 1 ? 'bg-indigo-600 text-white animate-pulse' : 'bg-zinc-800 text-zinc-500'}`}>1</div>
              <div className="w-6 sm:w-12 h-0.5 bg-zinc-800"></div>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold font-mono text-[10px] sm:text-xs ${currentStep > 2 ? 'bg-indigo-600/30 text-indigo-400' : currentStep === 2 ? 'bg-indigo-600 text-white animate-pulse' : 'bg-zinc-800 text-zinc-500'}`}>2</div>
              <div className="w-6 sm:w-12 h-0.5 bg-zinc-800"></div>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold font-mono text-[10px] sm:text-xs ${currentStep > 3 ? 'bg-indigo-600/30 text-indigo-400' : currentStep === 3 ? 'bg-indigo-600 text-white animate-pulse' : 'bg-zinc-800 text-zinc-500'}`}>3</div>
              <div className="w-6 sm:w-12 h-0.5 bg-zinc-800"></div>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold font-mono text-[10px] sm:text-xs ${currentStep === 4 ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>✓</div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* Category selection */}
            <div className="rounded-xl glass-card p-4 sm:p-6 border border-zinc-800 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> 1. Select Distribution Category
              </h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {/* Instant Buy */}
                <label className={`cursor-pointer rounded-xl p-4 border flex flex-col gap-2 transition ${projectType === 0 ? 'bg-indigo-950/20 border-indigo-500 text-white' : 'bg-zinc-950/50 border-zinc-850 text-zinc-400 hover:border-zinc-800'}`}>
                  <input 
                    type="radio" 
                    name="projectType" 
                    value="0" 
                    checked={projectType === 0} 
                    onChange={() => setProjectType(0)}
                    className="hidden"
                  />
                  <span className="font-bold text-sm text-white">Instant Buy</span>
                  <span className="text-[10px] leading-relaxed">Category A: Ready assets sold directly. Unlocked on purchase.</span>
                </label>

                {/* Crowdfund Pool */}
                <label className={`cursor-pointer rounded-xl p-4 border flex flex-col gap-2 transition ${projectType === 1 ? 'bg-indigo-950/20 border-indigo-500 text-white' : 'bg-zinc-950/50 border-zinc-850 text-zinc-400 hover:border-zinc-800'}`}>
                  <input 
                    type="radio" 
                    name="projectType" 
                    value="1" 
                    checked={projectType === 1} 
                    onChange={() => setProjectType(1)}
                    className="hidden"
                  />
                  <span className="font-bold text-sm text-white">Crowdfund Pool</span>
                  <span className="text-[10px] leading-relaxed">Category A: Backers pool funds. Unlocks when target is reached.</span>
                </label>

                {/* Custom Escrow */}
                <label className={`cursor-pointer rounded-xl p-4 border flex flex-col gap-2 transition ${projectType === 2 ? 'bg-indigo-950/20 border-indigo-500 text-white' : 'bg-zinc-950/50 border-zinc-850 text-zinc-400 hover:border-zinc-800'}`}>
                  <input 
                    type="radio" 
                    name="projectType" 
                    value="2" 
                    checked={projectType === 2} 
                    onChange={() => setProjectType(2)}
                    className="hidden"
                  />
                  <span className="font-bold text-sm text-white">Custom Escrow</span>
                  <span className="text-[10px] leading-relaxed">Category B: Secured commission. Progressive milestone releases.</span>
                </label>
              </div>
            </div>

            {/* General Metadata */}
            <div className="rounded-xl glass-card p-4 sm:p-6 border border-zinc-800 flex flex-col gap-4 sm:gap-5">
              <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> 2. Project Specifications
              </h3>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Project Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Low-Poly Character Pack v2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg p-2.5 text-zinc-200 text-sm transition outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Project Category</label>
                <CustomSelect
                  value={category}
                  onChange={setCategory}
                  options={[
                    { value: 'Technology', label: 'Technology (Software / Web3)' },
                    { value: 'Design & Art', label: 'Design & Art (3D Models / Illustration)' },
                    { value: 'Music & Audio', label: 'Music & Audio (SFX / Loops)' },
                    { value: 'Writing & Literature', label: 'Writing & Literature (E-Books / Docs)' },
                    { value: 'Video & Animation', label: 'Video & Animation (Lottie / Templates)' },
                    { value: 'Coordinate', label: 'Coordinate (Mapping / GIS / Location)' },
                    { value: 'Automatic', label: 'Automatic (AI / Bots / Automation)' },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Product Images (Optional, Max 5, Max 2MB each)</label>
                
                {/* Upload Trigger Area */}
                {imageFiles.length < 5 && (
                  <div className="border border-zinc-800 bg-zinc-950/60 rounded-lg p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-indigo-400">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-zinc-400">Choose PNG, JPG, or WEBP photo ({imageFiles.length}/5 selected)</span>
                        <span className="text-[9px] text-zinc-555">Will be displayed as a gallery on the project details page</span>
                      </div>
                    </div>
                    <label className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-bold text-xs px-3.5 py-2 rounded-lg cursor-pointer transition shrink-0">
                      Browse
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            const filesArray = Array.from(e.target.files);
                            const validFiles: File[] = [];
                            
                            if (imageFiles.length + filesArray.length > 5) {
                              alert('Maksimal upload adalah 5 gambar.');
                              return;
                            }
                            
                            for (const f of filesArray) {
                              if (f.size > 2 * 1024 * 1024) {
                                alert(`File "${f.name}" melebihi ukuran maksimal 2MB.`);
                                continue;
                              }
                              validFiles.push(f);
                            }
                            
                            setImageFiles(prev => [...prev, ...validFiles]);
                          }
                        }}
                      />
                    </label>
                  </div>
                )}

                {/* Selected Files Preview List */}
                {imageFiles.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-2">
                    {imageFiles.map((f, idx) => {
                      const objectUrl = URL.createObjectURL(f);
                      return (
                        <div key={idx} className="relative rounded-xl border border-zinc-800 bg-zinc-900/40 p-2 flex flex-col gap-2 group">
                          <div className="h-24 w-full bg-zinc-950 rounded-lg overflow-hidden relative">
                            <img
                              src={objectUrl}
                              alt={`Selected ${idx}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const list = [...imageFiles];
                                list.splice(idx, 1);
                                setImageFiles(list);
                              }}
                              className="absolute top-1 right-1 p-1 rounded-md bg-black/60 hover:bg-rose-600 text-white transition-colors"
                              title="Hapus gambar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[10px] font-bold text-white truncate" title={f.name}>{f.name}</span>
                            <span className="text-[9px] text-zinc-500">{(f.size / 1024).toFixed(0)} KB</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Description / Deliverable Specs</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe details, format, dimensions, files, or services provided..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg p-2.5 text-zinc-200 text-sm transition outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase flex items-center gap-1">
                    {projectType === 0 ? 'Retail Price (USDC)' : projectType === 2 ? 'Client Budget (USDC)' : 'Funding Target (USDC)'}
                    <span title="Amount of USDC tokens required on-chain">
                      <HelpCircle className="w-3.5 h-3.5 text-zinc-550" />
                    </span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0.5}
                    step="any"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg p-2.5 text-zinc-200 text-sm transition outline-none font-mono"
                  />
                </div>

                {projectType !== 0 && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase">Duration (Days)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={90}
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg p-2.5 text-zinc-200 text-sm transition outline-none font-mono"
                    />
                  </div>
                )}

                {projectType === 1 && (
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase flex items-center gap-1">
                      Minimum Backing Contribution (USDC)
                      <span title="Minimum amount required to back this pool">
                        <HelpCircle className="w-3.5 h-3.5 text-zinc-550" />
                      </span>
                    </label>
                    <input
                      type="number"
                      required
                      min={0.1}
                      step="any"
                      value={minContribution}
                      onChange={(e) => setMinContribution(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg p-2.5 text-zinc-200 text-sm transition outline-none font-mono"
                    />
                  </div>
                )}
              </div>

              {projectType === 2 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Client Wallet Address <span className="text-zinc-550 lowercase font-normal">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="GB_... (leave empty for any buyer)"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg p-2.5 text-zinc-200 text-sm transition outline-none font-mono"
                  />
                </div>
              )}
            </div>

            {/* Custom escrows milstone list */}
            {projectType === 2 && (
              <div className="rounded-xl glass-card p-4 sm:p-6 border border-zinc-800 flex flex-col gap-4 sm:gap-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">
                    3. Escrow Milestones (Must Sum to 100%)
                  </h3>
                  <button
                    type="button"
                    onClick={addMilestone}
                    className="text-xs bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Milestone
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {milestones.map((milestone, idx) => (
                    <div key={idx} className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <span className="text-xs font-bold text-zinc-400 uppercase">
                          Milestone {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMilestone(idx)}
                          className="text-zinc-600 hover:text-rose-450 transition"
                          title="Delete Milestone"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="col-span-1 sm:col-span-3 flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-zinc-500 uppercase">Phase Title</label>
                          <input
                            type="text"
                            required
                            placeholder={`Milestone Title ${idx + 1}`}
                            value={milestone.title}
                            onChange={(e) => updateMilestone(idx, 'title', e.target.value)}
                            className="bg-zinc-900 border border-zinc-800/80 focus:border-zinc-700 rounded-lg p-2 text-zinc-200 text-xs transition outline-none"
                          />
                        </div>
                        <div className="col-span-1 flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold text-zinc-500 uppercase">Disburse Weight (%)</label>
                          <input
                            type="number"
                            required
                            min={1}
                            max={100}
                            value={percentages[idx]}
                            onChange={(e) => updatePercentage(idx, e.target.value)}
                            className="bg-zinc-900 border border-zinc-800/80 focus:border-zinc-700 rounded-lg p-2 text-zinc-200 text-xs transition outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase">Deliverables / Proof of Work Requirements</label>
                        <textarea
                          required
                          rows={2}
                          placeholder="What will you deliver to satisfy this phase? (e.g. concept document, source zip...)"
                          value={milestone.description}
                          onChange={(e) => updateMilestone(idx, 'description', e.target.value)}
                          className="bg-zinc-900 border border-zinc-800/80 focus:border-zinc-700 rounded-lg p-2 text-zinc-200 text-xs transition outline-none resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Asset file upload (Only for Category A) */}
            {projectType !== 2 && (
              <div className="rounded-xl glass-card p-4 sm:p-6 border border-zinc-800 flex flex-col gap-4 sm:gap-5">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">
                  3. Upload Digital Asset
                </h3>
                
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Target Deliverable File</label>
                  <div className="border border-zinc-800 border-dashed hover:border-zinc-700 rounded-xl bg-zinc-950 p-6 flex flex-col items-center justify-center text-center gap-3 transition">
                    <div className="p-3 bg-zinc-900 rounded-full text-indigo-400 border border-zinc-855">
                      <Upload className="w-6 h-6" />
                    </div>
                    {file ? (
                      <div className="flex items-center gap-2 text-sm text-zinc-200">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        <span className="font-bold">{file.name}</span>
                        <span className="text-xs text-zinc-500 font-mono">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-zinc-300">Choose zip/rar/pdf package file</span>
                        <span className="text-xs text-zinc-550">Files are dynamically AES-256 client-side encrypted before transfer.</span>
                      </div>
                    )}
                    <input
                      type="file"
                      required={projectType !== 2}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                      id="file-input"
                    />
                    <label
                      htmlFor="file-input"
                      className="cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-semibold text-xs px-4 py-2 rounded-lg border border-zinc-800 transition"
                    >
                      {file ? 'Replace File' : 'Browse Files'}
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl glow-primary flex items-center justify-center gap-2 transition"
            >
              <CheckCircle className="w-5 h-5" /> Deploy Listing & Smart Contract
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
