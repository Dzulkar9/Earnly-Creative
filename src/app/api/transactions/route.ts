import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    // 1. Fetch transactions initiated by the user
    const { data: userTx, error: userError } = await supabase
      .from('transaction_history')
      .select('*')
      .ilike('user_address', address);

    if (userError) {
      console.error('Error fetching user transactions:', userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // 2. Fetch projects created by this user
    const { data: userProjects, error: projectsError } = await supabase
      .from('projects')
      .select('id')
      .ilike('creator_address', address);

    if (projectsError) {
      console.error('Error fetching user projects:', projectsError);
      return NextResponse.json({ error: projectsError.message }, { status: 500 });
    }

    const projectIds = (userProjects || []).map(p => p.id);
    let finalData = userTx || [];

    if (projectIds.length > 0) {
      // 3. Fetch transactions for projects created by this user
      const { data: projectTx, error: projectTxError } = await supabase
        .from('transaction_history')
        .select('*')
        .in('project_id', projectIds);

      if (projectTxError) {
        console.error('Error fetching project transactions:', projectTxError);
        return NextResponse.json({ error: projectTxError.message }, { status: 500 });
      }

      // Merge and remove duplicates by ID
      const txMap = new Map();
      finalData.forEach(tx => txMap.set(tx.id, tx));
      (projectTx || []).forEach(tx => txMap.set(tx.id, tx));
      finalData = Array.from(txMap.values());
    }

    // Sort by timestamp desc
    finalData.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

    // Map database keys to camelCase format
    const mapped = finalData.map((item: any) => ({
      id: item.id,
      projectId: Number(item.project_id),
      projectTitle: item.project_title,
      type: item.type,
      amount: item.amount ? Number(item.amount) : undefined,
      xlmAmount: item.xlm_amount ? Number(item.xlm_amount) : undefined,
      xlmPrice: item.xlm_price ? Number(item.xlm_price) : undefined,
      userAddress: item.user_address,
      message: item.message,
      timestamp: Number(item.timestamp),
      read: item.read
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error in GET transactions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      projectId,
      projectTitle,
      type,
      amount,
      xlmAmount,
      xlmPrice,
      userAddress,
      message,
      timestamp,
      read
    } = body;

    if (!id || !projectId || !projectTitle || !type || !userAddress || !message) {
      return NextResponse.json({ error: 'Missing required transaction fields' }, { status: 400 });
    }

    const { error } = await supabase
      .from('transaction_history')
      .upsert({
        id,
        project_id: projectId,
        project_title: projectTitle,
        type,
        amount: amount || null,
        xlm_amount: xlmAmount || null,
        xlm_price: xlmPrice || null,
        user_address: userAddress,
        message,
        timestamp: timestamp || Date.now(),
        read: !!read
      });

    if (error) {
      console.error('Error saving transaction to Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error in POST transactions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
