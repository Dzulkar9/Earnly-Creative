import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const transactionId = searchParams.get('transactionId');

    let query = supabase.from('project_disputes').select('*');

    if (projectId) {
      query = query.eq('project_id', Number(projectId));
    }
    if (transactionId) {
      query = query.eq('transaction_id', transactionId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching disputes:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const resolvedDisputes = [];
    if (data && data.length > 0) {
      for (const disp of data) {
        const { data: proj } = await supabase
          .from('projects')
          .select('title')
          .eq('id', disp.project_id)
          .maybeSingle();

        const { data: tx } = await supabase
          .from('transaction_history')
          .select('project_title, amount, xlm_amount')
          .eq('id', disp.transaction_id)
          .maybeSingle();

        resolvedDisputes.push({
          ...disp,
          projectTitle: proj?.title || tx?.project_title || 'Unknown Project',
          amount: tx?.amount || 0,
          xlmAmount: tx?.xlm_amount || 0
        });
      }
    }

    return NextResponse.json(resolvedDisputes);
  } catch (error: any) {
    console.error('Internal Server Error in GET disputes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, transactionId, buyerAddress, reason, photos } = body;

    if (!projectId || !transactionId || !buyerAddress || !reason || !photos) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const photoList = Array.isArray(photos) ? photos : (typeof photos === 'string' ? photos.split(',').filter(Boolean) : []);
    if (photoList.length < 2) {
      return NextResponse.json({ error: 'At least 2 evidence photos are required to file a dispute' }, { status: 400 });
    }

    // Check if dispute already exists for this transaction
    const { data: existing, error: existErr } = await supabase
      .from('project_disputes')
      .select('id')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Dispute already submitted for this purchase' }, { status: 400 });
    }

    // Insert dispute
    const { data, error: insertError } = await supabase
      .from('project_disputes')
      .insert({
        project_id: Number(projectId),
        transaction_id: transactionId,
        buyer_address: buyerAddress,
        reason,
        photos: photoList.join(','),
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting dispute:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Insert a notification into transaction_history for the seller/buyer
    try {
      const { data: proj } = await supabase
        .from('projects')
        .select('title')
        .eq('id', Number(projectId))
        .maybeSingle();

      const notifId = 'notif_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      await supabase.from('transaction_history').insert({
        id: notifId,
        project_id: Number(projectId),
        project_title: proj?.title || 'Project',
        type: 'refund',
        user_address: buyerAddress,
        message: `DISPUTE: Order has been reported by buyer (${buyerAddress}). Reason: "${reason}". Please submit defense evidence.`,
        timestamp: Date.now(),
        read: false
      });
    } catch (notifErr) {
      console.error('Failed to create dispute notification:', notifErr);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Internal Server Error in POST disputes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
