import { NextRequest, NextResponse } from 'next/server';

const MAINNET_RPC = 'https://soroban.stellar.org';
const TESTNET_RPC = 'https://soroban-testnet.stellar.org';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = req.nextUrl.searchParams.get('network') === 'testnet' ? TESTNET_RPC : MAINNET_RPC;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'RPC proxy failed' }, { status: 500 });
  }
}
