import { NextRequest, NextResponse } from 'next/server';
import { getProjectById, saveProject, deleteProject, ProjectMetadata } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProjectById(Number(id));
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching project detail:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);
    const body = await req.json();

    const existing = await getProjectById(projectId);
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify creator address matches
    const walletHeader = req.headers.get('x-wallet-address');
    if (walletHeader && existing.creatorAddress.toLowerCase() !== walletHeader.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized to modify this listing' }, { status: 401 });
    }

    // Construct updated metadata
    const updatedProject: ProjectMetadata = {
      ...existing,
      title: body.title !== undefined ? body.title : existing.title,
      description: body.description !== undefined ? body.description : existing.description,
      targetAmount: body.targetAmount !== undefined ? Number(body.targetAmount) : existing.targetAmount,
      category: body.category !== undefined ? body.category : existing.category,
      imageUrl: body.imageUrl !== undefined ? body.imageUrl : existing.imageUrl,
      milestoneDetails: body.milestoneDetails !== undefined ? body.milestoneDetails : existing.milestoneDetails,
      milestonePercentages: body.milestonePercentages !== undefined ? body.milestonePercentages : existing.milestonePercentages,
    };

    await saveProject(updatedProject);

    return NextResponse.json({ success: true, project: updatedProject });
  } catch (error: any) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);

    const existing = await getProjectById(projectId);
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const walletHeader = req.headers.get('x-wallet-address');
    if (walletHeader && existing.creatorAddress.toLowerCase() !== walletHeader.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized to delete this listing' }, { status: 401 });
    }

    await deleteProject(projectId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
