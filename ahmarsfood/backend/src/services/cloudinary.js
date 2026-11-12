import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure: true,
});

export function uploadImage(buffer) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: 'ahmarsfood/menu', resource_type: 'image' }, (err, result) =>
        err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id })
      )
      .end(buffer);
  });
}

export const deleteImage = (publicId) => (publicId ? cloudinary.uploader.destroy(publicId) : null);
