import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);
    const body = await req.json();
    const { milestoneIndex, progressDescription, progressMediaUrl, progressMediaType } = body;

    if (milestoneIndex === undefined || !progressDescription) {
      return NextResponse.json({ error: 'Milestone index and progress description are required' }, { status: 400 });
    }

    // 1. Fetch project to verify creator address
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const walletHeader = req.headers.get('x-wallet-address');
    if (!walletHeader || project.creatorAddress.toLowerCase() !== walletHeader.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized. Only project creator can update milestone progress.' }, { status: 401 });
    }

    // 2. Update milestone details in DB
    const { error } = await supabase
      .from('project_milestones')
      .update({
        progress_description: progressDescription,
        progress_media_url: progressMediaUrl || null,
        progress_media_type: progressMediaType || null,
        progress_updated_at: new Date().toISOString()
      })
      .eq('project_id', projectId)
      .eq('index', Number(milestoneIndex));

    if (error) {
      console.error('Error updating milestone progress in database:', error);
      return NextResponse.json({ error: 'Failed to update milestone progress' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in milestones API:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
