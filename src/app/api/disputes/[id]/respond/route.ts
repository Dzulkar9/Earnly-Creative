import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const disputeId = Number(resolvedParams.id);
    const body = await req.json();
    const { sellerDefense, sellerPhotos } = body;

    if (!sellerDefense) {
      return NextResponse.json({ error: 'Missing seller defense description' }, { status: 400 });
    }

    const photoList = Array.isArray(sellerPhotos) 
      ? sellerPhotos 
      : (typeof sellerPhotos === 'string' ? sellerPhotos.split(',').filter(Boolean) : []);

    // 1. Fetch dispute record
    const { data: dispute, error: dispErr } = await supabase
      .from('project_disputes')
      .select('*')
      .eq('id', disputeId)
      .maybeSingle();

    if (dispErr || !dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    if (dispute.status !== 'pending') {
      return NextResponse.json({ error: 'Dispute is already resolved' }, { status: 400 });
    }

    // 2. Update dispute with seller response
    const { data, error: updateErr } = await supabase
      .from('project_disputes')
      .update({
        seller_defense: sellerDefense,
        seller_photos: photoList.join(','),
        seller_responded_at: new Date().toISOString()
      })
      .eq('id', disputeId)
      .select()
      .single();

    if (updateErr) {
      console.error('Error updating dispute with defense:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, dispute: data });
  } catch (error: any) {
    console.error('Internal Server Error in respond disputes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
