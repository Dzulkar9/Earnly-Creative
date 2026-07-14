import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface ChatMessage {
  id: string;
  projectId: number;
  sender: string;
  message: string;
  timestamp: string;
  isCreator: boolean;
  buyerAddress: string;
}

const chatsFilePath = path.join(process.cwd(), 'src/lib/chats.json');

// In-memory fallback if writing to disk fails
let memoryChats: ChatMessage[] = [];

function getChatsFromFile(): ChatMessage[] {
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

function saveChatsToFile(chats: ChatMessage[]) {
  try {
    fs.mkdirSync(path.dirname(chatsFilePath), { recursive: true });
    fs.writeFileSync(chatsFilePath, JSON.stringify(chats, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write chat file, saving in memory:', error);
    memoryChats = chats;
  }
}

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

    const { searchParams } = new URL(req.url);
    const buyerAddress = searchParams.get('buyerAddress');

    const allChats = getChatsFromFile();
    let projectChats = allChats.filter((chat) => chat.projectId === projectId);

    if (buyerAddress) {
      projectChats = projectChats.filter(
        (chat) => chat.buyerAddress && chat.buyerAddress.toLowerCase() === buyerAddress.toLowerCase()
      );
    }

    return NextResponse.json(projectChats);
  } catch (error) {
    console.error('Error fetching chats:', error);
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
    const { sender, message, isCreator, buyerAddress } = body;

    if (!sender || !message || !buyerAddress) {
      return NextResponse.json({ error: 'Missing sender, message, or buyerAddress' }, { status: 400 });
    }

    const allChats = getChatsFromFile();
    const newChat: ChatMessage = {
      id: Math.random().toString(36).substring(2, 11),
      projectId,
      sender,
      message,
      timestamp: new Date().toISOString(),
      isCreator: !!isCreator,
      buyerAddress: buyerAddress
    };

    allChats.push(newChat);
    saveChatsToFile(allChats);

    return NextResponse.json(newChat, { status: 201 });
  } catch (error) {
    console.error('Error sending chat message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
