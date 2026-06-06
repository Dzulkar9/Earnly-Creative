import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects, saveProject, ProjectMetadata } from '@/lib/db';

export async function GET() {
  try {
    const projects = await getAllProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      title,
      description,
      creatorAddress,
      targetAmount,
      milestonesCount,
      milestoneDetails,
      fileDetails,
      category,
      projectType,
      clientAddress,
      milestonePercentages,
      imageUrl
    } = body;

    if (!id || !title || !creatorAddress || !targetAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newProject: ProjectMetadata = {
      id: Number(id),
      title,
      description: description || '',
      creatorAddress,
      targetAmount: Number(targetAmount),
      category: category || 'Technology',
      milestonesCount: Number(milestonesCount || 0),
      milestoneDetails: milestoneDetails || [],
      fileDetails: fileDetails || null,
      createdAt: new Date().toISOString(),
      projectType: Number(projectType ?? 1),
      clientAddress: clientAddress || '',
      milestonePercentages: milestonePercentages || [],
      imageUrl: imageUrl || ''
    };

    await saveProject(newProject);
    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error('Error saving project:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
