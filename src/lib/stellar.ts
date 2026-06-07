import freighter from '@stellar/freighter-api';
import { signTransaction } from '@stellar/freighter-api';
import {
  rpc,
  xdr,
  Address,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  Account
} from '@stellar/stellar-sdk';


export interface CampaignState {
  id: number;
  creator: string;
  token: string;
  target_amount: number;
  pledged_amount: number;
  total_milestones: number;
  current_milestone: number;
  is_completed: boolean;
  is_aborted: boolean;
  deadline: number; // timestamp in seconds
  milestone_approved: boolean;
  funds_withdrawn: number;
  reached_100_at?: number; // timestamp in seconds, 0 if not reached yet
  project_type: number; // 0: Instant Buy, 1: Crowdfund, 2: Custom Milestone
  client: string; // client address for custom milestone, or fallback creator
}

export interface VoteTally {
  yes_votes: number;
  no_votes: number;
}

// In-memory or localStorage based Mock Blockchain State
const MOCK_STATE_KEY = 'earnly_mock_blockchain_state';

interface MockBlockchain {
  campaigns: Record<number, CampaignState>;
  pledges: Record<string, number>; // key: "projectId-address" -> amount
  votes: Record<string, boolean>;   // key: "projectId-milestone-address" -> approve
  tallies: Record<string, VoteTally>; // key: "projectId-milestone" -> tally
  balances: Record<string, number>; // key: "address" -> token balance
  approved_creators: Record<string, boolean>; // key: "address" -> approved
  milestone_percentages: Record<number, number[]>; // key: "projectId" -> percentages
  registered_nullifiers: Record<string, boolean>; // key: "nullifierHash" -> true
  zk_verifier_key: string;
  counter: number;
}

export const DEFAULT_BALANCES = {
  'GB_CREATOR_ADDRESS_STW_NORTHGATE': 1000,
  'GB_CONTRIBUTOR_1_STW_NORTHGATE': 10000,
  'GB_CONTRIBUTOR_2_STW_NORTHGATE': 15000,
  'GB_GUEST_ADDRESS_STW_NORTHGATE': 5000,
};

function getMockBlockchain(): MockBlockchain {
  if (typeof window === 'undefined') {
    return { 
      campaigns: {}, 
      pledges: {}, 
      votes: {}, 
      tallies: {}, 
      balances: DEFAULT_BALANCES, 
      approved_creators: { 'GB_CREATOR_ADDRESS_STW_NORTHGATE': true }, 
      milestone_percentages: {}, 
      registered_nullifiers: {},
      zk_verifier_key: 'zk_verification_key_default',
      counter: 0 
    };
  }
  const data = localStorage.getItem(MOCK_STATE_KEY);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (!parsed.approved_creators) {
        parsed.approved_creators = { 'GB_CREATOR_ADDRESS_STW_NORTHGATE': true };
      }
      if (!parsed.milestone_percentages) {
        parsed.milestone_percentages = {};
      }
      if (!parsed.registered_nullifiers) {
        parsed.registered_nullifiers = {};
      }
      if (!parsed.zk_verifier_key) {
        parsed.zk_verifier_key = 'zk_verification_key_default';
      }
      return parsed;
    } catch {
      // fallback
    }
  }
  
  const newState: MockBlockchain = {
    campaigns: {},
    pledges: {},
    votes: {},
    tallies: {},
    balances: DEFAULT_BALANCES,
    approved_creators: { 'GB_CREATOR_ADDRESS_STW_NORTHGATE': true },
    milestone_percentages: {},
    registered_nullifiers: {},
    zk_verifier_key: 'zk_verification_key_default',
    counter: 0,
  };
  saveMockBlockchain(newState);
  return newState;
}

function saveMockBlockchain(state: MockBlockchain) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MOCK_STATE_KEY, JSON.stringify(state));
  }
}

export type NetworkType = 'simulation' | 'testnet' | 'mainnet';

export function getNetwork(): NetworkType {
  if (typeof window === 'undefined') return 'simulation';
  const net = localStorage.getItem('earnly_network') as NetworkType | null;
  if (net === 'testnet' || net === 'mainnet') return net;
  // Fallback to older mode flag
  const oldMock = localStorage.getItem('earnly_use_mock_mode');
  if (oldMock === 'false') return 'testnet';
  return 'simulation';
}

export function setNetwork(net: NetworkType) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('earnly_network', net);
    localStorage.setItem('earnly_use_mock_mode', net === 'simulation' ? 'true' : 'false');
  }
}

// Helpers to read/write mock mode flag
export function isMockMode(): boolean {
  return getNetwork() === 'simulation';
}

export function setMockMode(enable: boolean) {
  setNetwork(enable ? 'simulation' : 'testnet');
}

// Expose mock balances for UI debugging
export async function getMockBalances(): Promise<Record<string, number>> {
  const state = getMockBlockchain();
  const price = await getXlmPriceInUsd();
  const converted: Record<string, number> = {};
  for (const addr in state.balances) {
    converted[addr] = state.balances[addr] * price;
  }
  return converted;
}

export function resetMockBalances() {
  const state = getMockBlockchain();
  state.balances = { ...DEFAULT_BALANCES };
  saveMockBlockchain(state);
}

// Creator merchant gating helpers
export async function isCreatorApproved(address: string): Promise<boolean> {
  if (isMockMode()) {
    const state = getMockBlockchain();
    return !!state.approved_creators[address];
  }
  try {
    const approved = await queryContract('is_creator_approved', [
      Address.fromString(address).toScVal()
    ]);
    return !!approved;
  } catch (err) {
    console.warn(`Creator address ${address} is not approved on-chain. Details: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

export async function setCreatorStatus(
  admin: string,
  creatorAddress: string,
  approved: boolean
): Promise<void> {
  if (isMockMode()) {
    const state = getMockBlockchain();
    state.approved_creators[creatorAddress] = approved;
    saveMockBlockchain(state);
    return;
  }
  
  console.log(`Setting creator status on Stellar Testnet for ${creatorAddress} to ${approved}...`);
  await submitTransaction(admin, 'set_creator_status', [
    Address.fromString(admin).toScVal(),
    Address.fromString(creatorAddress).toScVal(),
    nativeToScVal(approved)
  ]);
  
  const state = getMockBlockchain();
  state.approved_creators[creatorAddress] = approved;
  saveMockBlockchain(state);
}

export async function verifyCreatorZk(
  creatorAddress: string,
  nullifierHash: string,
  zkProof: string
): Promise<void> {
  if (isMockMode()) {
    const state = getMockBlockchain();
    if (state.registered_nullifiers[nullifierHash]) {
      throw new Error("Nullifier already registered (identity clone detected)");
    }
    const verifierKey = state.zk_verifier_key || "zk_verification_key_default";
    if (zkProof !== verifierKey) {
      throw new Error("Invalid ZK Proof mathematical validation failed");
    }
    state.registered_nullifiers[nullifierHash] = true;
    state.approved_creators[creatorAddress] = true;
    saveMockBlockchain(state);
    return;
  }
  
  console.log(`Verifying creator via ZK-Proof on-chain for ${creatorAddress} (Nullifier: ${nullifierHash})...`);
  await submitTransaction(creatorAddress, 'verify_creator_zk', [
    Address.fromString(creatorAddress).toScVal(),
    xdr.ScVal.scvBytes(Buffer.from(nullifierHash, 'hex')),
    xdr.ScVal.scvBytes(Buffer.from(zkProof, 'utf-8'))
  ]);
  
  const state = getMockBlockchain();
  state.registered_nullifiers[nullifierHash] = true;
  state.approved_creators[creatorAddress] = true;
  saveMockBlockchain(state);
}

export async function setVerifierKey(admin: string, verifierKey: string): Promise<void> {
  const state = getMockBlockchain();
  state.zk_verifier_key = verifierKey;
  saveMockBlockchain(state);
  
  if (!isMockMode()) {
    await submitTransaction(admin, 'set_verifier_key', [
      Address.fromString(admin).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(verifierKey, 'utf-8'))
    ]);
  }
}

// -------------------------------------------------------------
// core client functions
// -------------------------------------------------------------

export async function getCampaign(projectId: number): Promise<CampaignState> {
  const xlmPrice = await getXlmPriceInUsd();

  if (isMockMode()) {
    const state = getMockBlockchain();
    const camp = state.campaigns[projectId];
    if (!camp) throw new Error('Campaign not found in mock chain');
    
    // Auto-completion check: 3 days (259200 seconds) after reaching 100% (Type 1 only)
    if (camp.project_type === 1 && !camp.is_completed && !camp.is_aborted && camp.reached_100_at) {
      const threeDaysInSecs = 3 * 24 * 60 * 60;
      const nowSecs = Math.floor(Date.now() / 1000);
      if (nowSecs >= camp.reached_100_at + threeDaysInSecs) {
        camp.is_completed = true;
        saveMockBlockchain(state);
      }
    }
    
    return {
      ...camp,
      target_amount: Math.round(camp.target_amount * xlmPrice * 100) / 100,
      pledged_amount: Math.round(camp.pledged_amount * xlmPrice * 100) / 100,
      funds_withdrawn: Math.round(camp.funds_withdrawn * xlmPrice * 100) / 100
    };
  }

  console.log('Fetching campaign from Stellar Testnet for ID:', projectId);
  try {
    const rawCamp = await queryContract('get_campaign', [
      nativeToScVal(projectId, { type: 'u32' })
    ]);
    
    const camp: CampaignState = {
      id: Number(rawCamp.id),
      creator: String(rawCamp.creator),
      token: String(rawCamp.token),
      target_amount: Math.round(((Number(rawCamp.target_amount) / 10000000) * xlmPrice) * 100) / 100,
      pledged_amount: Math.round(((Number(rawCamp.pledged_amount) / 10000000) * xlmPrice) * 100) / 100,
      total_milestones: Number(rawCamp.total_milestones),
      current_milestone: Number(rawCamp.current_milestone),
      is_completed: Boolean(rawCamp.is_completed),
      is_aborted: Boolean(rawCamp.is_aborted),
      deadline: Number(rawCamp.deadline),
      milestone_approved: Boolean(rawCamp.milestone_approved),
      funds_withdrawn: Math.round(((Number(rawCamp.funds_withdrawn) / 10000000) * xlmPrice) * 100) / 100,
      reached_100_at: Number(rawCamp.reached_100_at),
      project_type: Number(rawCamp.project_type),
      client: String(rawCamp.client)
    };
    
    const state = getMockBlockchain();
    state.campaigns[projectId] = {
      ...camp,
      target_amount: Number(rawCamp.target_amount) / 10000000,
      pledged_amount: Number(rawCamp.pledged_amount) / 10000000,
      funds_withdrawn: Number(rawCamp.funds_withdrawn) / 10000000,
    };
    saveMockBlockchain(state);
    
    return camp;
  } catch (err) {
    const state = getMockBlockchain();
    const camp = state.campaigns[projectId];
    if (camp) {
      return {
        ...camp,
        target_amount: Math.round(camp.target_amount * xlmPrice * 100) / 100,
        pledged_amount: Math.round(camp.pledged_amount * xlmPrice * 100) / 100,
        funds_withdrawn: Math.round(camp.funds_withdrawn * xlmPrice * 100) / 100
      };
    }
    return null as any;
  }
}

export async function createCampaign(
  creator: string,
  targetAmount: number,
  totalMilestones: number,
  durationDays: number,
  projectType: number,
  clientAddress: string,
  milestonePercentages?: number[]
): Promise<number> {
  const isApproved = await isCreatorApproved(creator);
  if (!isApproved) {
    throw new Error('Creator wallet is not verified. Please register on the Profile page.');
  }

  const xlmPrice = await getXlmPriceInUsd();
  const targetAmountXlm = targetAmount / xlmPrice;

  if (isMockMode()) {
    const state = getMockBlockchain();
    state.counter += 1;
    const id = state.counter;
    
    const deadline = Math.floor(Date.now() / 1000) + durationDays * 24 * 60 * 60;
    
    state.campaigns[id] = {
      id,
      creator,
      token: 'USDC_MOCK_ASSET',
      target_amount: targetAmountXlm,
      pledged_amount: 0,
      total_milestones: totalMilestones,
      current_milestone: 0,
      is_completed: false,
      is_aborted: false,
      deadline,
      milestone_approved: false,
      funds_withdrawn: 0,
      project_type: projectType,
      client: clientAddress || creator,
    };
    
    if (milestonePercentages) {
      state.milestone_percentages[id] = milestonePercentages;
    }
    
    saveMockBlockchain(state);
    return id;
  }

  console.log('Sending create_campaign transaction to Stellar Testnet...');
  const deadlineSecs = Math.floor(Date.now() / 1000) + durationDays * 86400;
  
  const pctScVals = (milestonePercentages || []).map(p => nativeToScVal(p, { type: 'u32' }));
  const milestoneScVal = xdr.ScVal.scvVec(pctScVals);

  const id = await submitTransaction(creator, 'create_campaign', [
    Address.fromString(creator).toScVal(),
    Address.fromString(getTokenContractId()).toScVal(),
    nativeToScVal(Math.round(targetAmountXlm * 10000000), { type: 'i128' }),
    nativeToScVal(totalMilestones, { type: 'u32' }),
    nativeToScVal(deadlineSecs, { type: 'u64' }),
    nativeToScVal(projectType, { type: 'u32' }),
    Address.fromString(clientAddress || creator).toScVal(),
    milestoneScVal
  ]);

  const campaignId = Number(id);
  console.log(`Campaign created on-chain with ID: ${campaignId}`);

  const state = getMockBlockchain();
  state.counter = Math.max(state.counter, campaignId);
  const camp: CampaignState = {
    id: campaignId,
    creator,
    token: getTokenContractId(),
    target_amount: targetAmountXlm,
    pledged_amount: 0,
    total_milestones: totalMilestones,
    current_milestone: 0,
    is_completed: false,
    is_aborted: false,
    deadline: deadlineSecs,
    milestone_approved: false,
    funds_withdrawn: 0,
    project_type: projectType,
    client: clientAddress || creator,
  };
  state.campaigns[campaignId] = camp;
  if (milestonePercentages) {
    state.milestone_percentages[campaignId] = milestonePercentages;
  }
  saveMockBlockchain(state);

  return campaignId;
}

export async function pledgeFunds(projectId: number, amount: number, contributor: string, xlmPrice?: number): Promise<void> {
  // Convert USDC amount to XLM equivalent for balance operations
  const effectiveXlmPrice = xlmPrice && xlmPrice > 0 ? xlmPrice : await getXlmPriceInUsd();
  const xlmAmount = parseFloat((amount / effectiveXlmPrice).toFixed(2));

  if (isMockMode()) {
    const state = getMockBlockchain();
    const camp = state.campaigns[projectId];
    if (!camp) throw new Error('Campaign not found');

    if (camp.is_completed) throw new Error('Project is already completed');
    if (camp.is_aborted) throw new Error('Project has been aborted');

    const userBal = state.balances[contributor] || 0;
    if (userBal < xlmAmount) throw new Error(`Insufficient balance. Required: ~${xlmAmount} XLM, Available: ${userBal.toFixed(2)} XLM`);
    
    if (camp.project_type === 0) {
      // Instant Buy: buyer pays XLM-converted, seller receives XLM-converted
      state.balances[contributor] = userBal - xlmAmount;
      state.balances[camp.creator] = (state.balances[camp.creator] || 0) + xlmAmount;
      
      const key = `${projectId}-${contributor}`;
      state.pledges[key] = (state.pledges[key] || 0) + xlmAmount;
      camp.pledged_amount += xlmAmount;
    } else if (camp.project_type === 2) {
      if (camp.client.toLowerCase() !== camp.creator.toLowerCase()) {
        if (contributor.toLowerCase() !== camp.client.toLowerCase()) {
          throw new Error('Only the designated client can fund this custom project');
        }
      } else {
        camp.client = contributor;
      }
      if (Math.abs(xlmAmount - camp.target_amount) > 0.05) {
        throw new Error(`Must lock exactly 100% of target budget: ${(camp.target_amount * effectiveXlmPrice).toFixed(2)} USDC`);
      }
      if (camp.pledged_amount > 0) {
        throw new Error('Custom budget already locked');
      }
      
      // Custom Milestone: buyer pays XLM-converted
      state.balances[contributor] = userBal - xlmAmount;
      camp.pledged_amount = xlmAmount;
      camp.reached_100_at = Math.floor(Date.now() / 1000);
      
      const key = `${projectId}-${contributor}`;
      state.pledges[key] = xlmAmount;
    } else {
      if (Math.floor(Date.now() / 1000) >= camp.deadline) {
        throw new Error('Campaign deadline has passed');
      }
      
      // Crowdfund: buyer pays XLM-converted
      state.balances[contributor] = userBal - xlmAmount;
      
      const key = `${projectId}-${contributor}`;
      const prevPledge = state.pledges[key] || 0;
      state.pledges[key] = prevPledge + xlmAmount;
      camp.pledged_amount += xlmAmount;

      if (camp.pledged_amount >= camp.target_amount && !camp.reached_100_at) {
        camp.reached_100_at = Math.floor(Date.now() / 1000);
      }
    }
    
    saveMockBlockchain(state);
    return;
  }

  console.log(`Pledging ${xlmAmount} tokens to project ${projectId} on Testnet...`);
  await submitTransaction(contributor, 'pledge_funds', [
    Address.fromString(contributor).toScVal(),
    nativeToScVal(projectId, { type: 'u32' }),
    nativeToScVal(Math.round(xlmAmount * 10000000), { type: 'i128' })
  ]);

  const state = getMockBlockchain();
  const camp = state.campaigns[projectId];
  if (camp) {
    camp.pledged_amount += xlmAmount;
    if (camp.pledged_amount >= camp.target_amount && !camp.reached_100_at) {
      camp.reached_100_at = Math.floor(Date.now() / 1000);
    }
    const key = `${projectId}-${contributor}`;
    state.pledges[key] = (state.pledges[key] || 0) + xlmAmount;
    saveMockBlockchain(state);
  }
}

export async function voteMilestone(projectId: number, approve: boolean, contributor: string): Promise<void> {
  if (isMockMode()) {
    const state = getMockBlockchain();
    const camp = state.campaigns[projectId];
    if (!camp) throw new Error('Campaign not found');

    if (camp.is_completed || camp.is_aborted) throw new Error('Project is inactive');
    if (camp.project_type === 2) {
      if (contributor.toLowerCase() !== camp.client.toLowerCase()) {
        throw new Error('Only the custom client can approve milestone updates');
      }
    } else {
      if (camp.pledged_amount < camp.target_amount) throw new Error('Target funding has not been met');
    }
    
    if (camp.current_milestone >= camp.total_milestones) throw new Error('All milestones already completed');
    if (camp.milestone_approved) throw new Error('Milestone already approved');

    const pledgeKey = `${projectId}-${contributor}`;
    const pledgeWeight = state.pledges[pledgeKey] || 0;
    if (pledgeWeight <= 0) throw new Error('Only contributors/buyers can vote');

    const milestone = camp.current_milestone;
    const voteKey = `${projectId}-${milestone}-${contributor}`;
    const tallyKey = `${projectId}-${milestone}`;

    const prevVote = state.votes[voteKey];
    const tally = state.tallies[tallyKey] || { yes_votes: 0, no_votes: 0 };

    if (prevVote !== undefined) {
      if (prevVote !== approve) {
        if (approve) {
          tally.yes_votes += pledgeWeight;
          tally.no_votes -= pledgeWeight;
        } else {
          tally.yes_votes -= pledgeWeight;
          tally.no_votes += pledgeWeight;
        }
      }
    } else {
      if (approve) {
        tally.yes_votes += pledgeWeight;
      } else {
        tally.no_votes += pledgeWeight;
      }
    }

    state.votes[voteKey] = approve;
    state.tallies[tallyKey] = tally;

    if (tally.yes_votes > camp.pledged_amount / 2) {
      camp.milestone_approved = true;
    }

    saveMockBlockchain(state);
    return;
  }

  console.log(`Voting ${approve ? 'YES' : 'NO'} on project ${projectId} milestone on Testnet...`);
  await submitTransaction(contributor, 'vote_milestone', [
    Address.fromString(contributor).toScVal(),
    nativeToScVal(projectId, { type: 'u32' }),
    nativeToScVal(approve)
  ]);

  const state = getMockBlockchain();
  const camp = state.campaigns[projectId];
  if (camp) {
    const milestone = camp.current_milestone;
    const voteKey = `${projectId}-${milestone}-${contributor}`;
    state.votes[voteKey] = approve;
    await getCampaign(projectId);
  }
}

export async function claimMilestoneFunds(projectId: number, creator: string): Promise<void> {
  if (isMockMode()) {
    const state = getMockBlockchain();
    const camp = state.campaigns[projectId];
    if (!camp) throw new Error('Campaign not found');

    if (camp.creator !== creator) throw new Error('Only the creator can claim milestone payouts');
    if (camp.current_milestone >= camp.total_milestones) throw new Error('All milestones already claimed');

    if (camp.project_type === 1) {
      if (camp.pledged_amount < camp.target_amount) {
        throw new Error('Funding target not reached');
      }
      const disburseAmountXlm = camp.pledged_amount - camp.funds_withdrawn;
      
      const creatorBal = state.balances[creator] || 0;
      state.balances[creator] = creatorBal + disburseAmountXlm;

      camp.funds_withdrawn += disburseAmountXlm;
      camp.current_milestone = 1;
      camp.is_completed = true;
    } else {
      if (!camp.milestone_approved) throw new Error('Milestone progress is not approved by buyer');

      const pcts = state.milestone_percentages[projectId] || [];
      const pct = pcts[camp.current_milestone] || (100 / camp.total_milestones);

      const isLastMilestone = camp.current_milestone === camp.total_milestones - 1;
      const disburseAmountXlm = isLastMilestone
        ? camp.pledged_amount - camp.funds_withdrawn
        : (camp.pledged_amount * pct) / 100;

      const creatorBal = state.balances[creator] || 0;
      state.balances[creator] = creatorBal + disburseAmountXlm;

      camp.funds_withdrawn += disburseAmountXlm;
      camp.current_milestone += 1;
      camp.milestone_approved = false;

      if (camp.current_milestone === camp.total_milestones) {
        camp.is_completed = true;
      }
    }

    saveMockBlockchain(state);
    return;
  }

  console.log(`Claiming milestone funds for project ${projectId} on Testnet...`);
  await submitTransaction(creator, 'claim_milestone_funds', [
    Address.fromString(creator).toScVal(),
    nativeToScVal(projectId, { type: 'u32' })
  ]);

  await getCampaign(projectId);
}

export async function claimRefund(projectId: number, contributor: string): Promise<void> {
  if (isMockMode()) {
    const state = getMockBlockchain();
    const camp = state.campaigns[projectId];
    if (!camp) throw new Error('Campaign not found');

    if (camp.project_type === 0) {
      throw new Error('Instant buy purchases cannot be refunded');
    }

    const pledgeKey = `${projectId}-${contributor}`;
    const pledgeXlm = state.pledges[pledgeKey] || 0;
    if (pledgeXlm <= 0) throw new Error('No pledge balance found for refund');

    const isExpiredFailed = camp.project_type === 1 && Math.floor(Date.now() / 1000) >= camp.deadline && camp.pledged_amount < camp.target_amount;
    const canRefund = camp.is_aborted || isExpiredFailed;

    if (!canRefund) throw new Error('Refund is not allowed at this stage');

    const refundAmountXlm = camp.is_aborted
      ? (pledgeXlm * (camp.pledged_amount - camp.funds_withdrawn)) / camp.pledged_amount
      : pledgeXlm;

    const contBal = state.balances[contributor] || 0;
    state.balances[contributor] = contBal + refundAmountXlm;
    state.pledges[pledgeKey] = 0;

    saveMockBlockchain(state);
    return;
  }

  console.log(`Claiming refund for project ${projectId} on Testnet...`);
  await submitTransaction(contributor, 'claim_refund', [
    Address.fromString(contributor).toScVal(),
    nativeToScVal(projectId, { type: 'u32' })
  ]);

  const state = getMockBlockchain();
  const pledgeKey = `${projectId}-${contributor}`;
  state.pledges[pledgeKey] = 0;
  saveMockBlockchain(state);
}

export async function abortCampaign(projectId: number, creator: string): Promise<void> {
  if (isMockMode()) {
    const state = getMockBlockchain();
    const camp = state.campaigns[projectId];
    if (!camp) throw new Error('Campaign not found');

    if (camp.creator !== creator) throw new Error('Only the creator can abort this project');
    if (camp.is_completed) throw new Error('Cannot abort a completed project');
    if (camp.is_aborted) throw new Error('Already aborted');

    camp.is_aborted = true;
    saveMockBlockchain(state);
    return;
  }

  console.log(`Aborting campaign ${projectId} on Testnet...`);
  await submitTransaction(creator, 'abort_campaign', [
    Address.fromString(creator).toScVal(),
    nativeToScVal(projectId, { type: 'u32' })
  ]);

  await getCampaign(projectId);
}

export async function completeCampaign(projectId: number, creator: string): Promise<void> {
  if (isMockMode()) {
    const state = getMockBlockchain();
    const camp = state.campaigns[projectId];
    if (!camp) throw new Error('Campaign not found');

    if (camp.creator !== creator) throw new Error('Only the creator can complete this project');
    if (camp.is_aborted) throw new Error('Cannot complete an aborted project');
    if (camp.is_completed) throw new Error('Already completed');

    // Transfer all remaining locked funds to the creator (already in XLM)
    const remainingBalanceXlm = camp.pledged_amount - camp.funds_withdrawn;
    if (remainingBalanceXlm > 0) {
      state.balances[creator] = (state.balances[creator] || 0) + remainingBalanceXlm;
      camp.funds_withdrawn += remainingBalanceXlm;
    }

    camp.is_completed = true;
    saveMockBlockchain(state);
    return;
  }

  console.log(`Completing campaign ${projectId} on Testnet...`);
  await submitTransaction(creator, 'complete_campaign', [
    Address.fromString(creator).toScVal(),
    nativeToScVal(projectId, { type: 'u32' })
  ]);

  await getCampaign(projectId);
}

export async function simulateTimePass(projectId: number, seconds: number): Promise<void> {
  if (isMockMode()) {
    const state = getMockBlockchain();
    const camp = state.campaigns[projectId];
    if (camp) {
      if (camp.reached_100_at) {
        camp.reached_100_at -= seconds;
      }
      camp.deadline -= seconds;
      saveMockBlockchain(state);
    }
  }
}

export async function getVoteTally(projectId: number, milestone: number): Promise<VoteTally> {
  const xlmPrice = await getXlmPriceInUsd();

  if (isMockMode()) {
    const state = getMockBlockchain();
    const key = `${projectId}-${milestone}`;
    const tally = state.tallies[key] || { yes_votes: 0, no_votes: 0 };
    return {
      yes_votes: Math.round(tally.yes_votes * xlmPrice * 100) / 100,
      no_votes: Math.round(tally.no_votes * xlmPrice * 100) / 100
    };
  }
  try {
    const rawTally = await queryContract('get_vote_tally', [
      nativeToScVal(projectId, { type: 'u32' }),
      nativeToScVal(milestone, { type: 'u32' })
    ]);
    return {
      yes_votes: Math.round(((Number(rawTally.yes_votes) / 10000000) * xlmPrice) * 100) / 100,
      no_votes: Math.round(((Number(rawTally.no_votes) / 10000000) * xlmPrice) * 100) / 100
    };
  } catch (err) {
    console.warn(`Vote tally for campaign #${projectId} milestone #${milestone} not found on-chain.`);
    return { yes_votes: 0, no_votes: 0 };
  }
}

export async function getContributorPledge(projectId: number, addr: string): Promise<number> {
  const xlmPrice = await getXlmPriceInUsd();

  if (isMockMode()) {
    const state = getMockBlockchain();
    const key = `${projectId}-${addr}`;
    const pledgeXlm = state.pledges[key] || 0;
    return Math.round(pledgeXlm * xlmPrice * 100) / 100;
  }
  try {
    const pledge = await queryContract('get_pledge', [
      nativeToScVal(projectId, { type: 'u32' }),
      Address.fromString(addr).toScVal()
    ]);
    return Math.round(((Number(pledge) / 10000000) * xlmPrice) * 100) / 100;
  } catch (err) {
    console.warn(`Pledge for contributor ${addr} in campaign #${projectId} not found on-chain.`);
    return 0;
  }
}

export async function getContributorVote(projectId: number, milestone: number, addr: string): Promise<boolean | null> {
  if (isMockMode()) {
    const state = getMockBlockchain();
    const key = `${projectId}-${milestone}-${addr}`;
    const vote = state.votes[key];
    return vote === undefined ? null : vote;
  }
  try {
    const vote = await queryContract('get_vote', [
      nativeToScVal(projectId, { type: 'u32' }),
      nativeToScVal(milestone, { type: 'u32' }),
      Address.fromString(addr).toScVal()
    ]);
    if (vote === undefined || vote === null) {
      return null;
    }
    return Boolean(vote);
  } catch (err) {
    console.warn(`Vote for contributor ${addr} in campaign #${projectId} milestone #${milestone} not found on-chain.`);
    return null;
  }
}

// Access Gating Verifier called by backend API route
export async function verifyContributorAccess(projectId: number, addr: string): Promise<boolean> {
  const camp = await getCampaign(projectId);
  if (!camp) return false;

  if (camp.creator.toLowerCase() === addr.toLowerCase()) {
    return true;
  }

  const pledge = await getContributorPledge(projectId, addr);

  if (camp.project_type === 0) {
    return pledge > 0;
  }

  if (camp.project_type === 2) {
    return camp.is_completed && addr.toLowerCase() === camp.client.toLowerCase();
  }

  const nowSecs = Math.floor(Date.now() / 1000);
  const isAutoCompleted = !camp.is_completed && !camp.is_aborted && camp.reached_100_at && (nowSecs >= camp.reached_100_at + 3 * 24 * 60 * 60);

  if (!camp.is_completed && !isAutoCompleted) {
    return false;
  }

  return pledge > 0;
}

// -------------------------------------------------------------
// Live Freighter wallet helpers
// -------------------------------------------------------------
export async function connectWallet(): Promise<string | null> {
  if (isMockMode()) {
    return 'GB_CONTRIBUTOR_1_STW_NORTHGATE';
  }

  try {
    const { isConnected } = await freighter.isConnected();
    if (!isConnected) {
      alert('Freighter Wallet extension is not detected. Please install Freighter browser extension.');
      return null;
    }

    const { isAllowed } = await freighter.isAllowed();
    if (!isAllowed) {
      const allowedRes = await freighter.setAllowed();
      if (!allowedRes || !allowedRes.isAllowed) {
        return null;
      }
    }
    
    const res = await freighter.getAddress();
    if (res && res.address) {
      return res.address;
    }
    return null;
  } catch (err) {
    console.error('Error connecting Freighter wallet:', err);
    return null;
  }
}

const PROXY_BASE = '/api/rpc';

export function getRpcServer(): rpc.Server {
  const net = getNetwork();
  const netParam = net === 'mainnet' ? 'mainnet' : 'testnet';
  return new rpc.Server(`${PROXY_BASE}?network=${netParam}`, { allowHttp: true });
}

export function getNetworkPassphrase(): string {
  const net = getNetwork();
  if (net === 'mainnet') {
    return Networks.PUBLIC;
  }
  return Networks.TESTNET;
}

export function getContractId(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_STELLAR_CAMPAIGN_CONTRACT_ID) {
    return process.env.NEXT_PUBLIC_STELLAR_CAMPAIGN_CONTRACT_ID;
  }
  const net = getNetwork();
  if (net === 'mainnet') {
    return 'CC7B2NCHNK5VWLEK6HF2WPQAZWDBPVBWZ7JZRV4OJQN4FJZNIUGLIEOQ';
  }
  return 'CDAXXGA55Q6AXCAI6YHK575EFTQZW5C22R2OAJQI6C2OGHSA6LEN63VA';
}

export function getTokenContractId(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_STELLAR_USDC_CONTRACT_ID) {
    return process.env.NEXT_PUBLIC_STELLAR_USDC_CONTRACT_ID;
  }
  const net = getNetwork();
  if (net === 'mainnet') {
    return 'CC7B2NCHNK5VWLEK6HF2WPQAZWDBPVBWZ7JZRV4OJQN4FJZNIUGLIEOQ';
  }
  return 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
}

const DUMMY_ADDRESS = 'GCGJ6G7SPNOCJKKS6BVX4I73DXT3HQSAXIX3SSCCT2VVSCFEB2UEBRNC';

// Helper to query read-only functions (Simulations)
async function queryContract(functionName: string, args: xdr.ScVal[]): Promise<any> {
  const contract = new Contract(getContractId());
  const account = new Account(DUMMY_ADDRESS, '0');
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: getNetworkPassphrase()
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(30)
    .build();

  const sim = await getRpcServer().simulateTransaction(tx);
  if (rpc.Api.isSimulationSuccess(sim) && sim.result) {
    return scValToNative(sim.result.retval);
  }
  throw new Error(`Simulation failed for function ${functionName}`);
}

// Helper to query read-only functions on the token contract
async function queryTokenContract(functionName: string, args: xdr.ScVal[]): Promise<any> {
  const contract = new Contract(getTokenContractId());
  const account = new Account(DUMMY_ADDRESS, '0');
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: getNetworkPassphrase()
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(30)
    .build();

  const sim = await getRpcServer().simulateTransaction(tx);
  if (rpc.Api.isSimulationSuccess(sim) && sim.result) {
    return scValToNative(sim.result.retval);
  }
  throw new Error(`Simulation failed for function ${functionName} on token contract`);
}

// Fetch live XLM price in USD/USDC from Cryptocompare with a local fallback
export async function getXlmPriceInUsd(): Promise<number> {
  try {
    const res = await fetch('https://min-api.cryptocompare.com/data/price?fsym=XLM&tsyms=USD');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.USD === 'number') {
        return data.USD;
      }
    }
  } catch (err) {
    console.warn('Could not fetch live XLM price, using fallback rate.', err);
  }
  return 0.11; // Fallback exchange rate (1 XLM = 0.11 USDC/USD)
}

// Exported token balance function for profile UI
export async function getTokenBalance(address: string): Promise<number> {
  if (isMockMode()) {
    const state = getMockBlockchain();
    const xlm = state.balances[address] ?? 0;
    const price = await getXlmPriceInUsd();
    return Math.round(xlm * price * 100) / 100;
  }
  try {
    const bal = await queryTokenContract('balance', [
      Address.fromString(address).toScVal()
    ]);
    // Soroban native/SAC asset balances are i128 representing stroops (7 decimals)
    const xlmAmount = Number(bal) / 10000000;

    // Convert XLM to USDC/USD automatically
    const price = await getXlmPriceInUsd();
    const usdcValue = xlmAmount * price;

    // Round to 2 decimal places for clean display
    return Math.round(usdcValue * 100) / 100;
  } catch (err) {
    console.warn(`Token balance query failed for ${address}, returning 0. Error:`, err);
    return 0;
  }
}

// Exported structured wallet details for UI header
export async function getWalletBalances(address: string): Promise<{ xlm: number; usdc: number }> {
  if (isMockMode()) {
    const state = getMockBlockchain();
    const xlm = state.balances[address] ?? 0;
    const price = await getXlmPriceInUsd();
    return {
      xlm: Math.round(xlm * 100) / 100,
      usdc: Math.round(xlm * price * 100) / 100
    };
  }
  try {
    const bal = await queryTokenContract('balance', [
      Address.fromString(address).toScVal()
    ]);
    const xlm = Number(bal) / 10000000;
    const price = await getXlmPriceInUsd();
    const usdc = xlm * price;
    return {
      xlm: Math.round(xlm * 100) / 100,
      usdc: Math.round(usdc * 100) / 100
    };
  } catch (err) {
    console.warn(`Failed to fetch wallet balances for ${address}:`, err);
    return { xlm: 0, usdc: 0 };
  }
}




// Helper to submit writing functions (Transactions)
async function submitTransaction(
  senderAddress: string,
  functionName: string,
  args: xdr.ScVal[]
): Promise<any> {
  const contract = new Contract(getContractId());
  const account = await getRpcServer().getAccount(senderAddress);
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: getNetworkPassphrase()
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(60)
    .build();

  const preparedTx = await getRpcServer().prepareTransaction(tx);
  const xdrString = preparedTx.toXDR();
  const signResult = await signTransaction(xdrString, {
    networkPassphrase: getNetworkPassphrase(),
    address: senderAddress
  });
  
  if (signResult.error) {
    throw new Error(`Transaction signing rejected by Freighter: ${signResult.error}`);
  }
  
  const signedTx = TransactionBuilder.fromXDR(signResult.signedTxXdr, getNetworkPassphrase());
  const submitResponse = await getRpcServer().sendTransaction(signedTx);
  
  if (submitResponse.status === 'ERROR') {
    throw new Error(`Stellar transaction submission failed: ${submitResponse.errorResult || 'unknown'}`);
  }

  
  let txResult = await getRpcServer().getTransaction(submitResponse.hash);
  for (let i = 0; i < 15; i++) {
    if (txResult.status !== 'NOT_FOUND') {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    txResult = await getRpcServer().getTransaction(submitResponse.hash);
  }
  
  if (txResult.status === 'SUCCESS') {
    if (txResult.returnValue) {
      return scValToNative(txResult.returnValue);
    }
    return null;
  } else {
    throw new Error(`Stellar transaction failed on-chain: ${txResult.status}`);
  }
}
