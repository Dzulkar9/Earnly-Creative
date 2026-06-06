import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getProjectById } from '@/lib/db';
import { verifyContributorAccess } from '@/lib/stellar';

const r2Client = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID && process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  ? new S3Client({
      region: 'auto',
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Address query parameter is required' }, { status: 400 });
    }

    // 1. Get project metadata
    const project = await getProjectById(projectId);
    if (!project || !project.fileDetails) {
      return NextResponse.json({ error: 'Project or file not found' }, { status: 404 });
    }

    // 2. Gate access: Verify contributor status on-chain
    const isAllowed = await verifyContributorAccess(projectId, address);
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Access Denied: You must be a contributor to download this asset.' },
        { status: 403 }
      );
    }

    // 3. Get the encrypted file buffer
    const fileDetails = project.fileDetails;
    let encryptedBuffer: Buffer;

    if (fileDetails.storageType === 'cloudinary' && fileDetails.cloudinaryUrl) {
      try {
        const res = await fetch(fileDetails.cloudinaryUrl);
        if (!res.ok) {
          throw new Error(`Failed to fetch file from Cloudinary: ${res.statusText}`);
        }
        const arrayBuffer = await res.arrayBuffer();
        encryptedBuffer = Buffer.from(arrayBuffer);
      } catch (err) {
        console.error('Failed to download from Cloudinary, trying local fallback:', err);
        const encryptedFilePath = path.join(process.cwd(), 'public', fileDetails.encryptedPath);
        if (!fs.existsSync(encryptedFilePath)) {
          return NextResponse.json({ error: 'Encrypted file not found' }, { status: 404 });
        }
        encryptedBuffer = fs.readFileSync(encryptedFilePath);
      }
    } else if (r2Client && fileDetails.storageType === 'r2') {
      try {
        const command = new GetObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
          Key: fileDetails.r2Key || fileDetails.name,
        });
        const response = await r2Client.send(command);
        if (!response.Body) {
          throw new Error('Empty body response from R2');
        }
        const arrayBuffer = await response.Body.transformToByteArray();
        encryptedBuffer = Buffer.from(arrayBuffer);
      } catch (err) {
        console.error('Failed to download from R2, falling back to local:', err);
        // Fallback to local
        const encryptedFilePath = path.join(process.cwd(), 'public', fileDetails.encryptedPath);
        if (!fs.existsSync(encryptedFilePath)) {
          return NextResponse.json({ error: 'Encrypted file not found' }, { status: 404 });
        }
        encryptedBuffer = fs.readFileSync(encryptedFilePath);
      }
    } else {
      // Local fallback
      const encryptedFilePath = path.join(process.cwd(), 'public', fileDetails.encryptedPath);
      if (!fs.existsSync(encryptedFilePath)) {
        return NextResponse.json({ error: 'Encrypted file not found on disk' }, { status: 404 });
      }
      encryptedBuffer = fs.readFileSync(encryptedFilePath);
    }
    
    // Decrypt AES-256-CBC
    const keyBuffer = Buffer.from(fileDetails.key, 'hex');
    const ivBuffer = Buffer.from(fileDetails.iv, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    // 4. Return decrypted file as stream/download
    const response = new NextResponse(decryptedBuffer);
    response.headers.set('Content-Type', fileDetails.type || 'application/octet-stream');
    response.headers.set(
      'Content-Disposition',
      `attachment; filename="${fileDetails.name}"`
    );
    
    return response;
  } catch (error) {
    console.error('Error decrypting and downloading file:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
