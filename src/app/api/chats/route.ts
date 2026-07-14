import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAllProjects } from '@/lib/db';

const chatsFilePath = path.join(process.cwd(), 'src/lib/chats.json');
let memoryChats: any[] = [];

function getChatsFromFile(): any[] {
  try {
    if (!fs.existsSync(chatsFilePath)) {
      // Ensure the directory exists
      fs.mkdirSync(path.dirname(chatsFilePath), { recursive: true });
      fs.writeFileSync(chatsFilePath, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const data = fs.readFileSync(chatsFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to read chat file, using memory storage:', error);
    return memoryChats;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('address');

    if (!userAddress) {
      return NextResponse.json({ error: 'Missing address query parameter' }, { status: 400 });
    }

    const allChats = getChatsFromFile();
    const projects = await getAllProjects();
    const projectMap = new Map();
    projects.forEach((p) => {
      projectMap.set(p.id, {
        title: p.title,
        price: p.targetAmount,
        creatorAddress: p.creatorAddress,
        imageUrl: p.imageUrl,
        projectType: p.projectType
      });
    });

    // Filter chats where user is either buyer or seller
    const userChats = allChats.filter((chat) => {
      const isBuyer = chat.buyerAddress && chat.buyerAddress.toLowerCase() === userAddress.toLowerCase();
      const project = projectMap.get(chat.projectId);
      const isSeller = project && project.creatorAddress && project.creatorAddress.toLowerCase() === userAddress.toLowerCase();
      return isBuyer || isSeller;
    }).map((chat) => {
      const project = projectMap.get(chat.projectId);
      return {
        ...chat,
        projectDetails: project ? {
          title: project.title,
          price: project.price,
          imageUrl: project.imageUrl,
          projectType: project.projectType,
          creatorAddress: project.creatorAddress
        } : null
      };
    });

    return NextResponse.json(userChats);
  } catch (error) {
    console.error('Error fetching global chats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
