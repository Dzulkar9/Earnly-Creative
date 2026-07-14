import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { disburseEscrowOnChain } from '@/lib/stellar';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const disputeId = Number(resolvedParams.id);
    const body = await req.json();
    const { action } = body; // 'refund' or 'release'

    if (!action || !['refund', 'release'].includes(action)) {
      return NextResponse.json({ error: 'Invalid or missing action parameter' }, { status: 400 });
    }

    // 1. Fetch dispute record
    const { data: dispute, error: dispErr } = await supabase
      .from('project_disputes')
      .select('*')
      .eq('id', disputeId)
      .maybeSingle();

    if (dispErr || !dispute) {
      return NextResponse.json({ error: 'Dispute record not found' }, { status: 404 });
    }

    if (dispute.status !== 'pending') {
      return NextResponse.json({ error: 'Dispute has already been resolved' }, { status: 400 });
    }

    // 2. Fetch project details (for creator address)
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('creator_address')
      .eq('id', dispute.project_id)
      .maybeSingle();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 3. Fetch transaction details (for amount)
    const { data: tx, error: txErr } = await supabase
      .from('transaction_history')
      .select('xlm_amount')
      .eq('id', dispute.transaction_id)
      .maybeSingle();

    if (txErr || !tx || !tx.xlm_amount) {
      return NextResponse.json({ error: 'Associated transaction history not found' }, { status: 404 });
    }

    const xlmToTransfer = Number(tx.xlm_amount).toFixed(7);
    const buyerAddress = dispute.buyer_address;
    const creatorAddress = project.creator_address;

    let destinationAddress = '';
    let nextStatus = '';

    if (action === 'refund') {
      destinationAddress = buyerAddress;
      nextStatus = 'resolved_refunded';
    } else {
      destinationAddress = creatorAddress;
      nextStatus = 'resolved_released';
    }

    console.log(`Disputing Mediation: releasing ${xlmToTransfer} XLM to ${destinationAddress} on action ${action}...`);

    // 4. Perform on-chain transfer
    try {
      await disburseEscrowOnChain(destinationAddress, xlmToTransfer);
      console.log(`On-chain mediation payment successful! Released ${xlmToTransfer} XLM to ${destinationAddress}`);
    } catch (stellarErr: any) {
      console.error('Stellar disbursement failed during mediation resolve:', stellarErr);
      return NextResponse.json({
        error: `Stellar blockchain transaction failed: ${stellarErr.message || stellarErr}`
      }, { status: 500 });
    }

    // 5. Update dispute status in Supabase
    const { data: updatedDispute, error: updateErr } = await supabase
      .from('project_disputes')
      .update({
        status: nextStatus,
        resolved_at: new Date().toISOString()
      })
      .eq('id', disputeId)
      .select()
      .single();

    if (updateErr) {
      console.error('Failed to update dispute status in Supabase:', updateErr);
      return NextResponse.json({ error: 'Transaction succeeded but failed to update status in DB' }, { status: 500 });
    }

    return NextResponse.json({ success: true, dispute: updatedDispute });
  } catch (error: any) {
    console.error('Error resolving dispute:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
