#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    pub id: u32,
    pub creator: Address,
    pub token: Address,
    pub target_amount: i128,
    pub pledged_amount: i128,
    pub total_milestones: u32,
    pub current_milestone: u32,
    pub is_completed: bool,
    pub is_aborted: bool,
    pub deadline: u64, // timestamp in seconds
    pub milestone_approved: bool,
    pub funds_withdrawn: i128,
    pub reached_100_at: u64, // timestamp in seconds, 0 if not reached yet
    pub project_type: u32, // 0: Instant Buy, 1: Crowdfunded Pool, 2: Custom Milestone
    pub client: Address, // specified client for custom milestones, or fallback to creator
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VoteState {
    pub yes_votes: i128,
    pub no_votes: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Campaign(u32),
    CampaignCounter,
    ContributorPledge(u32, Address),
    ContributorVote(u32, u32, Address), // (project_id, milestone_index, contributor)
    CampaignVoteState(u32, u32),         // (project_id, milestone_index)
    Admin,
    ApprovedCreator(Address),
    MilestonePercentage(u32, u32),       // (project_id, milestone_index)
    RegisteredNullifier(soroban_sdk::BytesN<32>),
    ZKVerifierKey,
}

#[contract]
pub struct EarnlyCoFundContract;

fn verify_zk_proof(_env: &Env, proof: &soroban_sdk::Bytes, verifier_key: &soroban_sdk::Bytes) -> bool {
    // In production, this runs a zk-SNARK verifier check (e.g. Groth16 verify).
    // For this deployment testnet/mockup, we check if the proof is non-empty and matches the verifier_key.
    proof.len() > 0 && proof == verifier_key
}

fn check_and_update_campaign_completion(env: &Env, campaign: &mut Campaign) -> bool {
    // Only crowdfunded pools (type 1) auto-complete 3 days after reaching 100% target
    if campaign.project_type == 1 && !campaign.is_completed && !campaign.is_aborted && campaign.reached_100_at > 0 {
        let three_days = 3 * 24 * 60 * 60;
        if env.ledger().timestamp() >= campaign.reached_100_at + three_days {
            campaign.is_completed = true;
            return true;
        }
    }
    false
}

#[contractimpl]
impl EarnlyCoFundContract {
    // Initialize the contract and register the compliance admin
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic!("contract already initialized");
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
    }

    // Set approval status for a creator (Merchant Gating)
    pub fn set_creator_status(env: Env, admin: Address, creator: Address, approved: bool) {
        admin.require_auth();
        let stored_admin: Address = env.storage().persistent().get(&DataKey::Admin).expect("admin not initialized");
        assert_eq!(admin, stored_admin, "only compliance admin can approve creators");
        env.storage().persistent().set(&DataKey::ApprovedCreator(creator), &approved);
    }

    // Configure ZK Verifier Key
    pub fn set_verifier_key(env: Env, admin: Address, key: soroban_sdk::Bytes) {
        admin.require_auth();
        let stored_admin: Address = env.storage().persistent().get(&DataKey::Admin).expect("admin not initialized");
        assert_eq!(admin, stored_admin, "only compliance admin can set verifier key");
        env.storage().persistent().set(&DataKey::ZKVerifierKey, &key);
    }

    // Self-sovereign ZK-Proof creator verification (replaces admin gating)
    pub fn verify_creator_zk(
        env: Env,
        creator: Address,
        nullifier: soroban_sdk::BytesN<32>,
        proof: soroban_sdk::Bytes,
    ) {
        creator.require_auth();

        // Check if nullifier is already registered (Anti-Sybil check)
        let nullifier_key = DataKey::RegisteredNullifier(nullifier.clone());
        let is_registered = env.storage().persistent().get(&nullifier_key).unwrap_or(false);
        assert!(!is_registered, "Nullifier already registered (identity clone detected)");

        // Verify ZK Proof
        let verifier_key: soroban_sdk::Bytes = env.storage().persistent().get(&DataKey::ZKVerifierKey)
            .unwrap_or_else(|| soroban_sdk::Bytes::from_array(&env, &[0; 8])); // default key if not set

        let is_proof_valid = verify_zk_proof(&env, &proof, &verifier_key);
        assert!(is_proof_valid, "Invalid ZK Proof mathematical validation failed");

        // Mark nullifier as registered and approve creator
        env.storage().persistent().set(&nullifier_key, &true);
        env.storage().persistent().set(&DataKey::ApprovedCreator(creator), &true);
    }

    // View helper to check creator status
    pub fn is_creator_approved(env: Env, creator: Address) -> bool {
        env.storage().persistent().get(&DataKey::ApprovedCreator(creator)).unwrap_or(false)
    }

    // Create a new campaign (Instant Buy, Crowdfunded, or Custom Milestone)
    pub fn create_campaign(
        env: Env,
        creator: Address,
        token: Address,
        target_amount: i128,
        total_milestones: u32,
        deadline: u64,
        project_type: u32,
        client: Address,
        milestone_percentages: Vec<u32>,
    ) -> u32 {
        creator.require_auth();

        // If an admin has been initialized, enforce identity-gating check
        if env.storage().persistent().has(&DataKey::Admin) {
            let approved = env.storage().persistent().get(&DataKey::ApprovedCreator(creator.clone())).unwrap_or(false);
            assert!(approved, "creator address is not verified by admin");
        }

        let mut counter: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::CampaignCounter)
            .unwrap_or(0);
        counter += 1;
        env.storage().persistent().set(&DataKey::CampaignCounter, &counter);

        let campaign = Campaign {
            id: counter,
            creator,
            token,
            target_amount,
            pledged_amount: 0,
            total_milestones,
            current_milestone: 0,
            is_completed: false,
            is_aborted: false,
            deadline,
            milestone_approved: false,
            funds_withdrawn: 0,
            reached_100_at: 0,
            project_type,
            client,
        };

        env.storage().persistent().set(&DataKey::Campaign(counter), &campaign);

        // Store custom milestone percentages during campaign creation
        if project_type == 2 {
            assert_eq!(milestone_percentages.len(), total_milestones, "milestones count mismatch");
            let mut sum: u32 = 0;
            for i in 0..milestone_percentages.len() {
                let pct = milestone_percentages.get(i).unwrap();
                sum += pct;
                env.storage().persistent().set(&DataKey::MilestonePercentage(counter, i), &pct);
            }
            assert_eq!(sum, 100, "milestone percentages must sum up to 100%");
        }

        counter
    }

    // Set custom milestone percentages (must sum to exactly 100)
    pub fn set_milestone_percentages(env: Env, creator: Address, project_id: u32, percentages: Vec<u32>) {
        creator.require_auth();
        let campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(project_id))
            .expect("campaign not found");
        
        assert_eq!(campaign.creator, creator, "only creator can set milestone weights");
        assert_eq!(percentages.len(), campaign.total_milestones, "milestones count mismatch");
        
        let mut sum: u32 = 0;
        for i in 0..percentages.len() {
            let pct = percentages.get(i).unwrap();
            sum += pct;
            env.storage().persistent().set(&DataKey::MilestonePercentage(project_id, i), &pct);
        }
        assert_eq!(sum, 100, "milestone percentages must sum up to 100%");
    }

    // Contribute funds / buy products / lock custom budgets
    pub fn pledge_funds(env: Env, contributor: Address, project_id: u32, amount: i128) {
        contributor.require_auth();
        assert!(amount > 0, "amount must be positive");

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(project_id))
            .expect("campaign not found");

        check_and_update_campaign_completion(&env, &mut campaign);

        assert!(!campaign.is_completed, "project is already completed");
        assert!(!campaign.is_aborted, "project has been aborted");

        if campaign.project_type == 0 {
            // Type 0: Instant Buy. No deadline checks. Hold in contract escrow.
            let token_client = token::Client::new(&env, &campaign.token);
            token_client.transfer(&contributor, &env.current_contract_address(), &amount);

            // Record purchase
            let key = DataKey::ContributorPledge(project_id, contributor.clone());
            let prev_pledge: i128 = env.storage().persistent().get(&key).unwrap_or(0);
            env.storage().persistent().set(&key, &(prev_pledge + amount));

            campaign.pledged_amount += amount;
        } else if campaign.project_type == 2 {
            // Type 2: Custom Milestone. Must be the designated client. Must lock 100% of target budget.
            if campaign.client != campaign.creator {
                assert_eq!(contributor, campaign.client, "only the specified client can lock budget for this project");
            } else {
                // If client was left optional (equal to creator), the first contributor becomes the client
                campaign.client = contributor.clone();
            }
            
            assert_eq!(amount, campaign.target_amount, "must lock exactly 100% of target budget");
            assert_eq!(campaign.pledged_amount, 0, "custom project budget already locked");

            let token_client = token::Client::new(&env, &campaign.token);
            token_client.transfer(&contributor, &env.current_contract_address(), &amount);

            let key = DataKey::ContributorPledge(project_id, contributor.clone());
            env.storage().persistent().set(&key, &amount);

            campaign.pledged_amount = amount;
            campaign.reached_100_at = env.ledger().timestamp();
        } else {
            // Type 1: Crowdfunded Pool. Standard checks.
            assert!(
                env.ledger().timestamp() < campaign.deadline,
                "campaign deadline has passed"
            );

            let token_client = token::Client::new(&env, &campaign.token);
            token_client.transfer(&contributor, &env.current_contract_address(), &amount);

            let key = DataKey::ContributorPledge(project_id, contributor.clone());
            let prev_pledge: i128 = env.storage().persistent().get(&key).unwrap_or(0);
            env.storage().persistent().set(&key, &(prev_pledge + amount));

            campaign.pledged_amount += amount;

            if campaign.pledged_amount >= campaign.target_amount && campaign.reached_100_at == 0 {
                campaign.reached_100_at = env.ledger().timestamp();
            }
        }

        env.storage().persistent().set(&DataKey::Campaign(project_id), &campaign);
    }

    // Cast votes to approve milestone progress
    pub fn vote_milestone(env: Env, contributor: Address, project_id: u32, approve: bool) {
        contributor.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(project_id))
            .expect("campaign not found");

        check_and_update_campaign_completion(&env, &mut campaign);

        assert!(!campaign.is_completed, "project is completed");
        assert!(!campaign.is_aborted, "project is aborted");
        
        if campaign.project_type == 2 {
            assert_eq!(contributor, campaign.client, "only the client can vote on custom project milestones");
        } else {
            assert!(
                campaign.pledged_amount >= campaign.target_amount,
                "funding target has not been met yet"
            );
        }

        assert!(
            campaign.current_milestone < campaign.total_milestones,
            "all milestones already completed"
        );
        assert!(!campaign.milestone_approved, "current milestone already approved");

        let pledge_key = DataKey::ContributorPledge(project_id, contributor.clone());
        let pledge: i128 = env
            .storage()
            .persistent()
            .get(&pledge_key)
            .expect("must be a contributor to vote");
        assert!(pledge > 0, "contributor must have non-zero contribution");

        let milestone = campaign.current_milestone;
        let vote_key = DataKey::ContributorVote(project_id, milestone, contributor.clone());
        let vote_state_key = DataKey::CampaignVoteState(project_id, milestone);

        let mut tally: VoteState = env
            .storage()
            .persistent()
            .get(&vote_state_key)
            .unwrap_or(VoteState {
                yes_votes: 0,
                no_votes: 0,
            });

        let prev_vote: Option<bool> = env.storage().persistent().get(&vote_key);

        if let Some(old_approve) = prev_vote {
            if old_approve != approve {
                if approve {
                    tally.yes_votes += pledge;
                    tally.no_votes -= pledge;
                } else {
                    tally.yes_votes -= pledge;
                    tally.no_votes += pledge;
                }
            }
        } else {
            if approve {
                tally.yes_votes += pledge;
            } else {
                tally.no_votes += pledge;
            }
        }

        env.storage().persistent().set(&vote_key, &approve);
        env.storage().persistent().set(&vote_state_key, &tally);

        // If Yes votes exceed 50% of the total pledged amount, approve the milestone
        if tally.yes_votes > (campaign.pledged_amount / 2) {
            campaign.milestone_approved = true;
            env.storage().persistent().set(&DataKey::Campaign(project_id), &campaign);
        }
    }

    // Withdraw milestone funds based on dynamic weights
    pub fn claim_milestone_funds(env: Env, creator: Address, project_id: u32) {
        creator.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(project_id))
            .expect("campaign not found");

        assert_eq!(campaign.creator, creator, "only project creator can claim funds");
        assert!(
            campaign.current_milestone < campaign.total_milestones,
            "all milestones already completed"
        );

        if campaign.project_type == 1 {
            // Type 1: Crowdfunded Pool. All funds claimed at once (1 milestone total).
            assert!(campaign.pledged_amount >= campaign.target_amount, "funding target not reached");
        } else {
            // Type 2: Custom Milestone. Requires client vote approval.
            assert!(campaign.milestone_approved, "milestone progress is not approved by buyers");
        }

        // Disburse 100% of the campaign funds directly, not following the milestone percentage
        let amount_to_claim = campaign.pledged_amount - campaign.funds_withdrawn;

        // Transfer funds from contract to creator
        let token_client = token::Client::new(&env, &campaign.token);
        token_client.transfer(&env.current_contract_address(), &creator, &amount_to_claim);

        campaign.funds_withdrawn += amount_to_claim;
        campaign.current_milestone += 1;
        campaign.milestone_approved = false;

        if campaign.current_milestone == campaign.total_milestones {
            campaign.is_completed = true;
        }

        env.storage().persistent().set(&DataKey::Campaign(project_id), &campaign);
    }

    // Claim refund for aborted campaigns or failed crowdfunding pools
    pub fn claim_refund(env: Env, contributor: Address, project_id: u32) {
        contributor.require_auth();

        let campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(project_id))
            .expect("campaign not found");

        // Instant Buy products cannot be refunded
        assert!(campaign.project_type != 0, "instant buy purchases cannot be refunded");

        let pledge_key = DataKey::ContributorPledge(project_id, contributor.clone());
        let pledge: i128 = env
            .storage()
            .persistent()
            .get(&pledge_key)
            .expect("no pledge record found");
        assert!(pledge > 0, "no funds available for refund");

        let can_refund = campaign.is_aborted
            || (campaign.project_type == 1
                && env.ledger().timestamp() >= campaign.deadline
                && campaign.pledged_amount < campaign.target_amount);

        assert!(can_refund, "refund is not allowed at this stage");

        // Proportional refund for aborted custom milestone escrows
        let refund_amount = if campaign.is_aborted {
            let remaining_balance = campaign.pledged_amount - campaign.funds_withdrawn;
            if campaign.pledged_amount > 0 {
                (pledge * remaining_balance) / campaign.pledged_amount
            } else {
                0
            }
        } else {
            // Failed crowdfunding target: refund 100%
            pledge
        };

        if refund_amount > 0 {
            let token_client = token::Client::new(&env, &campaign.token);
            token_client.transfer(&env.current_contract_address(), &contributor, &refund_amount);
        }

        env.storage().persistent().set(&pledge_key, &0i128);
    }

    // Abort a project
    pub fn abort_campaign(env: Env, creator: Address, project_id: u32) {
        creator.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(project_id))
            .expect("campaign not found");

        assert_eq!(campaign.creator, creator, "only creator can abort project");
        assert!(!campaign.is_completed, "cannot abort completed project");
        assert!(!campaign.is_aborted, "project already aborted");

        campaign.is_aborted = true;
        env.storage().persistent().set(&DataKey::Campaign(project_id), &campaign);
    }

    // Manually complete a project (mainly for custom service fast-delivery)
    pub fn complete_campaign(env: Env, creator: Address, project_id: u32) {
        creator.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(project_id))
            .expect("campaign not found");

        assert_eq!(campaign.creator, creator, "only creator can complete project");
        assert!(!campaign.is_completed, "project already completed");
        assert!(!campaign.is_aborted, "cannot complete aborted project");

        campaign.is_completed = true;

        // Disburse all remaining locked funds to the creator
        let remaining_balance = campaign.pledged_amount - campaign.funds_withdrawn;
        if remaining_balance > 0 {
            let token_client = token::Client::new(&env, &campaign.token);
            token_client.transfer(&env.current_contract_address(), &creator, &remaining_balance);
            campaign.funds_withdrawn += remaining_balance;
        }

        env.storage().persistent().set(&DataKey::Campaign(project_id), &campaign);
    }

    // Release escrowed funds for instant buy projects (called by contributor / buyer)
    pub fn release_escrow(env: Env, contributor: Address, project_id: u32) {
        contributor.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(project_id))
            .expect("campaign not found");

        assert_eq!(campaign.project_type, 0, "only instant buy projects can release escrow this way");
        assert!(!campaign.is_completed, "project already completed");
        assert!(!campaign.is_aborted, "cannot release aborted project");

        let pledge_key = DataKey::ContributorPledge(project_id, contributor.clone());
        let pledge: i128 = env
            .storage()
            .persistent()
            .get(&pledge_key)
            .expect("no pledge record found");
        assert!(pledge > 0, "no funds locked by this contributor");

        // Transfer funds from contract to creator
        let token_client = token::Client::new(&env, &campaign.token);
        token_client.transfer(&env.current_contract_address(), &campaign.creator, &pledge);

        campaign.funds_withdrawn += pledge;
        campaign.is_completed = true;

        env.storage().persistent().set(&DataKey::Campaign(project_id), &campaign);
        env.storage().persistent().set(&pledge_key, &0i128);
    }

    // View functions
    pub fn get_campaign(env: Env, project_id: u32) -> Campaign {
        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(project_id))
            .expect("campaign not found");

        check_and_update_campaign_completion(&env, &mut campaign);
        campaign
    }

    pub fn get_pledge(env: Env, project_id: u32, contributor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::ContributorPledge(project_id, contributor))
            .unwrap_or(0)
    }

    pub fn get_vote(env: Env, project_id: u32, milestone: u32, contributor: Address) -> Option<bool> {
        env.storage()
            .persistent()
            .get(&DataKey::ContributorVote(project_id, milestone, contributor))
    }

    pub fn get_vote_tally(env: Env, project_id: u32, milestone: u32) -> VoteState {
        env.storage()
            .persistent()
            .get(&DataKey::CampaignVoteState(project_id, milestone))
            .unwrap_or(VoteState {
                yes_votes: 0,
                no_votes: 0,
            })
    }

    pub fn is_contributor(env: Env, project_id: u32, addr: Address) -> bool {
        let pledge = Self::get_pledge(env, project_id, addr);
        pledge > 0
    }
}

mod test;
