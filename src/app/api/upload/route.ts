import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const isCloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

function uploadToCloudinary(
  buffer: Buffer,
  options: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const isImage = formData.get('isImage') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    let keyBuffer: Buffer | null = null;
    let ivBuffer: Buffer | null = null;
    let finalBuffer = buffer;

    // Only encrypt if NOT a public image
    if (!isImage) {
      // Generate random AES encryption key and IV
      keyBuffer = crypto.randomBytes(32); // 256 bits key
      ivBuffer = crypto.randomBytes(16);  // 128 bits iv

      // Encrypt the file buffer
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, ivBuffer);
      finalBuffer = Buffer.concat([cipher.update(buffer), cipher.final()]);
    }

    const fileHash = crypto.randomBytes(8).toString('hex');
    const fileName = isImage ? `${fileHash}_${file.name}` : `${fileHash}_${file.name}.enc`;

    if (isCloudinaryConfigured) {
      try {
        const options = isImage
          ? {
              folder: 'earnly_covers',
              resource_type: 'image',
              public_id: path.parse(fileName).name,
            }
          : {
              folder: 'earnly_products',
              resource_type: 'raw',
              public_id: fileName,
            };

        const uploadResult = await uploadToCloudinary(finalBuffer, options);

        return NextResponse.json({
          name: file.name,
          size: file.size,
          type: file.type,
          storageType: 'cloudinary',
          cloudinaryUrl: uploadResult.secure_url,
          encryptedPath: `/uploads/${fileName}`, // Dummy path for schema compatibility
          imageUrl: isImage ? uploadResult.secure_url : undefined,
          key: keyBuffer ? keyBuffer.toString('hex') : undefined,
          iv: ivBuffer ? ivBuffer.toString('hex') : undefined,
        });
      } catch (err) {
        console.error('Failed to upload to Cloudinary, falling back to local:', err);
      }
    }

    // Local Storage Fallback
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, finalBuffer);

    return NextResponse.json({
      name: file.name,
      size: file.size,
      type: file.type,
      storageType: 'local',
      encryptedPath: `/uploads/${fileName}`,
      imageUrl: isImage ? `/uploads/${fileName}` : undefined,
      key: keyBuffer ? keyBuffer.toString('hex') : undefined,
      iv: ivBuffer ? ivBuffer.toString('hex') : undefined,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
