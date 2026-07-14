import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);
    const body = await req.json();
    const { name, size, type, encryptedPath, key, iv, storageType, cloudinaryUrl, r2Key } = body;

    if (!name || !size || !type) {
      return NextResponse.json({ error: 'File details (name, size, type) are required' }, { status: 400 });
    }

    // 1. Verify project creator
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const walletHeader = req.headers.get('x-wallet-address');
    if (!walletHeader || project.creatorAddress.toLowerCase() !== walletHeader.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized. Only the project creator can upload deliverables.' }, { status: 401 });
    }

    // 2. Delete existing file details for this project
    await supabase
      .from('project_files')
      .delete()
      .eq('project_id', projectId);

    // 3. Insert new deliverables file details
    const { error } = await supabase
      .from('project_files')
      .insert({
        project_id: projectId,
        name,
        size: Number(size),
        type,
        encrypted_path: encryptedPath || null,
        encryption_key: key || null,
        encryption_iv: iv || null,
        storage_type: storageType || 'local',
        cloudinary_url: cloudinaryUrl || null,
        r2_key: r2Key || null
      });

    if (error) {
      console.error('Error saving deliverables file details in database:', error);
      return NextResponse.json({ error: 'Failed to save deliverable file details' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in deliverables API:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
