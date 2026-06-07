import { NextRequest, NextResponse } from 'next/server';

const MAINNET_RPC = 'https://mainnet.sorobanrpc.com';
const TESTNET_RPC = 'https://soroban-testnet.stellar.org';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const net = req.nextUrl.searchParams.get('network') || 'mainnet';
    const targetUrl = net === 'testnet' ? TESTNET_RPC : MAINNET_RPC;

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('RPC proxy error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
