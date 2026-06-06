#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, token, Address, Env, Vec};

#[test]
fn test_campaign_lifecycle_custom_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    // Register contract
    let contract_id = env.register(EarnlyCoFundContract, ());
    let client_contract = EarnlyCoFundContractClient::new(&env, &contract_id);

    // Setup accounts
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let client_wallet = Address::generate(&env);
    let token_admin = Address::generate(&env);

    // Initialize admin and approve creator
    client_contract.initialize(&admin);
    client_contract.set_creator_status(&admin, &creator, &true);
    assert!(client_contract.is_creator_approved(&creator));

    // Register token contract (v2)
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    let token = token::Client::new(&env, &token_address);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    // Mint test tokens for the client
    token_admin_client.mint(&client_wallet, &1000);
    assert_eq!(token.balance(&client_wallet), 1000);

    // Set ledger time
    env.ledger().with_mut(|li| {
        li.timestamp = 1000;
    });

    // Configure milestones weight (30% for first, 70% for second)
    let mut weights = Vec::new(&env);
    weights.push_back(30);
    weights.push_back(70);

    // 1. Create custom milestone campaign (type 2): target 500, 2 milestones, client_wallet specified
    let project_id = client_contract.create_campaign(
        &creator, 
        &token_address, 
        &500i128, 
        &2u32, 
        &2000u64, 
        &2u32, // type 2 (Custom Milestone)
        &client_wallet,
        &weights
    );
    assert_eq!(project_id, 1);

    let campaign = client_contract.get_campaign(&1);
    assert_eq!(campaign.creator, creator);
    assert_eq!(campaign.target_amount, 500i128);
    assert_eq!(campaign.project_type, 2);
    assert_eq!(campaign.client, client_wallet);

    // 2. Client locks 100% of funds
    client_contract.pledge_funds(&client_wallet, &1, &500i128);
    assert_eq!(token.balance(&client_wallet), 500);
    assert_eq!(token.balance(&contract_id), 500);

    let campaign = client_contract.get_campaign(&1);
    assert_eq!(campaign.pledged_amount, 500i128);

    // 3. Vote on milestone 0 (current milestone)
    client_contract.vote_milestone(&client_wallet, &1, &true);
    let campaign = client_contract.get_campaign(&1);
    assert!(campaign.milestone_approved);

    // 4. Claim first milestone (30% of 500 = 150)
    client_contract.claim_milestone_funds(&creator, &1);
    assert_eq!(token.balance(&creator), 150);
    assert_eq!(token.balance(&contract_id), 350);

    let campaign = client_contract.get_campaign(&1);
    assert_eq!(campaign.current_milestone, 1);
    assert!(!campaign.milestone_approved);

    // 5. Vote and claim second milestone (70% of 500 = 350)
    client_contract.vote_milestone(&client_wallet, &1, &true);
    client_contract.claim_milestone_funds(&creator, &1);
    assert_eq!(token.balance(&creator), 500);
    assert_eq!(token.balance(&contract_id), 0);

    let campaign = client_contract.get_campaign(&1);
    assert!(campaign.is_completed);
}

#[test]
fn test_ready_instant_buy() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EarnlyCoFundContract, ());
    let client_contract = EarnlyCoFundContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let buyer = Address::generate(&env);
    let token_admin = Address::generate(&env);

    client_contract.initialize(&admin);
    client_contract.set_creator_status(&admin, &creator, &true);

    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = token_contract.address();
    let token = token::Client::new(&env, &token_address);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    token_admin_client.mint(&buyer, &200);

    // Create Instant Buy project (type 0), price is 120 USDC
    let empty_weights = Vec::new(&env);
    client_contract.create_campaign(
        &creator, 
        &token_address, 
        &120i128, 
        &0u32, 
        &0u64, 
        &0u32, // type 0 (Instant Buy)
        &creator, // fallback client
        &empty_weights
    );

    // Buyer purchases the product
    client_contract.pledge_funds(&buyer, &1, &120i128);

    // Funds must go directly to creator (not contract escrow)
    assert_eq!(token.balance(&buyer), 80);
    assert_eq!(token.balance(&creator), 120);
    assert_eq!(token.balance(&contract_id), 0);

    // Access gating verification
    assert!(client_contract.is_contributor(&1, &buyer));
    assert_eq!(client_contract.get_pledge(&1, &buyer), 120i128);
}

#[test]
#[should_panic(expected = "creator address is not verified by admin")]
fn test_identity_gated_creator_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EarnlyCoFundContract, ());
    let client_contract = EarnlyCoFundContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);

    client_contract.initialize(&admin);
    assert!(!client_contract.is_creator_approved(&creator));

    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = token_contract.address();

    // Trying to create campaign with unapproved creator should panic
    let empty_weights = Vec::new(&env);
    client_contract.create_campaign(
        &creator, 
        &token_address, 
        &500i128, 
        &1u32, 
        &2000u64, 
        &1u32, 
        &creator,
        &empty_weights
    );
}

#[test]
fn test_identity_gated_creator_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EarnlyCoFundContract, ());
    let client_contract = EarnlyCoFundContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);

    client_contract.initialize(&admin);
    client_contract.set_creator_status(&admin, &creator, &true);
    assert!(client_contract.is_creator_approved(&creator));

    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = token_contract.address();

    // Creating campaign should now succeed
    let empty_weights = Vec::new(&env);
    let project_id = client_contract.create_campaign(
        &creator, 
        &token_address, 
        &500i128, 
        &1u32, 
        &2000u64, 
        &1u32, 
        &creator,
        &empty_weights
    );
    assert_eq!(project_id, 1);
}

#[test]
fn test_refund_on_failure() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EarnlyCoFundContract, ());
    let client_contract = EarnlyCoFundContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let contributor = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = token_contract.address();
    let token = token::Client::new(&env, &token_address);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    token_admin_client.mint(&contributor, &1000);

    // Create crowdfunding pool campaign (type 1): target 500, deadline at 2000
    let empty_weights = Vec::new(&env);
    client_contract.create_campaign(&creator, &token_address, &500i128, &1u32, &2000u64, &1u32, &creator, &empty_weights);

    // Pledge 300 (fails to reach target of 500)
    client_contract.pledge_funds(&contributor, &1, &300i128);
    assert_eq!(token.balance(&contributor), 700);

    // Fast forward past deadline
    env.ledger().with_mut(|li| {
        li.timestamp = 2500;
    });

    // Claim refund
    client_contract.claim_refund(&contributor, &1);
    assert_eq!(token.balance(&contributor), 1000);
    assert_eq!(token.balance(&contract_id), 0);
}

#[test]
fn test_proportional_refund_on_abort() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EarnlyCoFundContract, ());
    let client_contract = EarnlyCoFundContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let client_wallet = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = token_contract.address();
    let token = token::Client::new(&env, &token_address);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    token_admin_client.mint(&client_wallet, &1000);

    // Setup equal weights (50% each)
    let mut weights = Vec::new(&env);
    weights.push_back(50);
    weights.push_back(50);

    // Create Custom Milestone project (type 2), 2 milestones
    client_contract.create_campaign(&creator, &token_address, &1000i128, &2u32, &2000u64, &2u32, &client_wallet, &weights);

    client_contract.pledge_funds(&client_wallet, &1, &1000i128);

    // Approve milestone 0 and claim funds (creator gets 500)
    client_contract.vote_milestone(&client_wallet, &1, &true);
    client_contract.claim_milestone_funds(&creator, &1);
    assert_eq!(token.balance(&creator), 500);
    assert_eq!(token.balance(&contract_id), 500);

    // Creator aborts campaign before milestone 1
    client_contract.abort_campaign(&creator, &1);

    // Client can claim proportional refund of the remaining locked funds (500)
    client_contract.claim_refund(&client_wallet, &1);
    assert_eq!(token.balance(&client_wallet), 500);
    assert_eq!(token.balance(&contract_id), 0);
}

#[test]
#[should_panic(expected = "Nullifier already registered (identity clone detected)")]
fn test_zk_anti_sybil() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EarnlyCoFundContract, ());
    let client_contract = EarnlyCoFundContractClient::new(&env, &contract_id);

    let creator_a = Address::generate(&env);
    let creator_b = Address::generate(&env);

    let nullifier = soroban_sdk::BytesN::from_array(&env, &[42; 32]);
    let proof = soroban_sdk::Bytes::from_array(&env, &[0; 8]); // matches default zero key

    // Verify creator A using verify_creator_zk
    client_contract.verify_creator_zk(&creator_a, &nullifier, &proof);
    assert!(client_contract.is_creator_approved(&creator_a));

    // Try to verify creator B using the SAME nullifier (should panic)
    client_contract.verify_creator_zk(&creator_b, &nullifier, &proof);
}

#[test]
#[should_panic(expected = "Invalid ZK Proof mathematical validation failed")]
fn test_zk_invalid_proof() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EarnlyCoFundContract, ());
    let client_contract = EarnlyCoFundContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client_contract.initialize(&admin);

    // Set a custom ZK Verifier Key
    let verifier_key = soroban_sdk::Bytes::from_array(&env, &[7, 7, 7, 7]);
    client_contract.set_verifier_key(&admin, &verifier_key);

    let nullifier = soroban_sdk::BytesN::from_array(&env, &[99; 32]);
    let bad_proof = soroban_sdk::Bytes::from_array(&env, &[1, 2, 3, 4]); // does not match verifier_key

    // Try to verify creator with invalid proof (should panic)
    client_contract.verify_creator_zk(&creator, &nullifier, &bad_proof);
}
