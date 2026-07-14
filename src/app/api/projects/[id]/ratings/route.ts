import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);

    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // 1. Get creator (seller) address of this project
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('creator_address')
      .eq('id', projectId)
      .maybeSingle();

    if (projError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const sellerAddress = project.creator_address;

    // 2. Fetch all ratings for this seller (via join)
    const { data: ratings, error: ratingsError } = await supabase
      .from('project_ratings')
      .select('project_id, rating, comment, buyer_address, created_at, transaction_id, projects!inner(creator_address)')
      .eq('projects.creator_address', sellerAddress);

    if (ratingsError) {
      console.warn('Ratings query failed (table may not exist yet):', ratingsError);
      // Graceful fallback to default rating to prevent app crash before migration is run
      return NextResponse.json({
        averageRating: 5.0,
        ratingsCount: 0,
        ratings: []
      });
    }

    const ratingsList = ratings || [];
    const count = ratingsList.length;
    const sum = ratingsList.reduce((acc, curr) => acc + curr.rating, 0);
    const average = count > 0 ? Number((sum / count).toFixed(1)) : 5.0;

    return NextResponse.json({
      averageRating: average,
      ratingsCount: count,
      ratings: ratingsList.map((r: any) => ({
        rating: r.rating,
        comment: r.comment,
        buyerAddress: r.buyer_address,
        createdAt: r.created_at,
        projectId: r.project_id,
        transactionId: r.transaction_id
      }))
    });
  } catch (error) {
    console.error('Error fetching ratings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);

    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const body = await req.json();
    const { rating, comment, buyerAddress, isMock, transactionId } = body;

    if (!rating || !buyerAddress) {
      return NextResponse.json({ error: 'Missing rating or buyerAddress' }, { status: 400 });
    }

    const val = Number(rating);
    if (isNaN(val) || val < 1 || val > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
    }

    // Insert new rating to Supabase
    const { error: insertError } = await supabase
      .from('project_ratings')
      .insert({
        project_id: projectId,
        rating: val,
        comment: comment || '',
        buyer_address: buyerAddress,
        transaction_id: transactionId || null
      });

    if (insertError) {
      console.error('Error inserting rating to Supabase:', insertError);
      return NextResponse.json({ error: 'Failed to submit rating to database' }, { status: 500 });
    }

    // On-chain Testnet Escrow Disbursement logic
    if (!isMock) {
      try {
        const { data: project, error: projErr } = await supabase
          .from('projects')
          .select('creator_address')
          .eq('id', projectId)
          .maybeSingle();

        if (!projErr && project) {
          const creatorAddress = project.creator_address;

          let xlmAmountToRelease = 0;
          if (transactionId) {
            const { data: tx } = await supabase
              .from('transaction_history')
              .select('xlm_amount')
              .eq('id', transactionId)
              .maybeSingle();
            if (tx && tx.xlm_amount) {
              xlmAmountToRelease = Number(tx.xlm_amount);
            }
          }

          if (!xlmAmountToRelease) {
            // Fallback to latest purchase transaction for this project
            const { data: txs } = await supabase
              .from('transaction_history')
              .select('xlm_amount')
              .eq('project_id', projectId)
              .in('type', ['purchase', 'lock_budget'])
              .order('timestamp', { ascending: false })
              .limit(1);
            if (txs && txs.length > 0 && txs[0].xlm_amount) {
              xlmAmountToRelease = Number(txs[0].xlm_amount);
            }
          }

          if (xlmAmountToRelease > 0) {
            const { disburseEscrowOnChain } = require('@/lib/stellar');
            const xlmToRelease = xlmAmountToRelease.toFixed(7);
            await disburseEscrowOnChain(creatorAddress, xlmToRelease);
            console.log(`On-chain Escrow: successfully disbursed ${xlmToRelease} XLM to creator ${creatorAddress}`);
          }
        }
      } catch (escrowErr) {
        console.error('Failed to disburse on-chain escrow funds:', escrowErr);
      }
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error submitting rating:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
