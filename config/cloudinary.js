const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** Upload an in-memory buffer to Cloudinary. Returns { url, publicId }. */
const uploadBuffer = (buffer, folder = 'darazify/products') =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
      (err, result) => (err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id }))
    );
    stream.end(buffer);
  });

const deleteImage = (publicId) => cloudinary.uploader.destroy(publicId).catch(() => null);

module.exports = { cloudinary, uploadBuffer, deleteImage };
