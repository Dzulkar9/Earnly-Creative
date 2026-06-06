import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

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
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    if (r2Client) {
      try {
        const command = new GetObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
          Key: filename,
        });
        const response = await r2Client.send(command);
        if (response.Body) {
          const arrayBuffer = await response.Body.transformToByteArray();
          const buffer = Buffer.from(arrayBuffer);
          const res = new NextResponse(buffer);
          res.headers.set('Content-Type', response.ContentType || 'image/png');
          res.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          return res;
        }
      } catch (err) {
        console.error('Error fetching image from R2, trying local fallback:', err);
      }
    }
    
    // Local fallback
    const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const res = new NextResponse(buffer);
      const ext = path.extname(filename).toLowerCase();
      let contentType = 'image/png';
      if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      res.headers.set('Content-Type', contentType);
      res.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return res;
    }
    
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  } catch (error) {
    console.error('Error serving image:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
