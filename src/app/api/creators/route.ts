import { NextRequest, NextResponse } from 'next/server';
import { getAllApplications, getApplicationByAddress, saveApplication, CreatorApplication, supabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    if (address) {
      const app = await getApplicationByAddress(address);
      return NextResponse.json(app);
    }
    const apps = await getAllApplications();
    return NextResponse.json(apps);
  } catch (error) {
    console.error('Error fetching creator applications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, realName, email, portfolio, zkProof, nullifierHash, action, status } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    if (action === 'verify') {
      // Admin verification update
      const app = await getApplicationByAddress(walletAddress);
      if (!app) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      }
      app.status = status || 'approved';
      await saveApplication(app);
      return NextResponse.json(app);
    }

    if (action === 'update_name') {
      const { newName } = body;
      if (!newName) {
        return NextResponse.json({ error: 'Nama tidak boleh kosong.' }, { status: 400 });
      }

      // 1. Validate format: must start with @ and contain 2-30 alphanumeric/underscore characters
      if (!newName.startsWith('@')) {
        return NextResponse.json({ error: 'Nama harus diawali dengan karakter @ (contoh: @username).' }, { status: 400 });
      }
      const handleRegex = /^@[a-zA-Z0-9_]{2,30}$/;
      if (!handleRegex.test(newName)) {
        return NextResponse.json({ error: 'Nama hanya boleh berisi huruf, angka, dan underscore setelah @ (2-30 karakter).' }, { status: 400 });
      }

      // 2. Validate uniqueness (case-insensitive check)
      const { data: duplicateUser } = await supabase
        .from('creator_applications')
        .select('wallet_address')
        .ilike('real_name', newName)
        .not('wallet_address', 'ilike', walletAddress)
        .maybeSingle();

      if (duplicateUser) {
        return NextResponse.json({ error: 'Nama pengguna ini sudah digunakan oleh orang lain.' }, { status: 400 });
      }

      let app = await getApplicationByAddress(walletAddress);
      
      // 3. Validate cooldown (30 days) if they have changed their name before
      if (app && app.lastNameChangeAt) {
        const lastChange = new Date(app.lastNameChangeAt).getTime();
        const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
        const nextAllowed = lastChange + COOLDOWN_MS;
        const now = Date.now();
        
        if (now < nextAllowed) {
          const daysRemaining = Math.ceil((nextAllowed - now) / (24 * 60 * 60 * 1000));
          return NextResponse.json({ 
            error: `Anda hanya dapat mengubah nama sekali dalam sebulan. Silakan tunggu ${daysRemaining} hari lagi.` 
          }, { status: 400 });
        }
      }

      // 4. Save name update
      if (!app) {
        app = {
          walletAddress,
          realName: newName,
          email: `${walletAddress.slice(0, 8).toLowerCase()}@earnly.creative`,
          portfolio: 'https://earnly.creative',
          zkProof: 'zk_verification_key_default',
          nullifierHash: `zk_nullifier_${walletAddress.slice(0, 16)}`,
          status: 'approved',
          appliedAt: new Date().toISOString(),
          lastNameChangeAt: new Date().toISOString()
        };
      } else {
        app.realName = newName;
        app.lastNameChangeAt = new Date().toISOString();
      }
      
      await saveApplication(app);
      return NextResponse.json(app);
    }

    // Submit new application
    if (!realName || !email || !portfolio) {
      return NextResponse.json({ error: 'Missing required registration fields' }, { status: 400 });
    }

    const newApp: CreatorApplication = {
      walletAddress,
      realName,
      email,
      portfolio,
      zkProof: zkProof || '',
      nullifierHash: nullifierHash || '',
      status: 'approved',
      appliedAt: new Date().toISOString()
    };

    await saveApplication(newApp);
    return NextResponse.json(newApp, { status: 201 });
  } catch (error) {
    console.error('Error processing creator application:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
