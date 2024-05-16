import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({ 
  cloud_name: process.env.CLOUDYNARY_CLOUD_NAME, 
  api_key: process.env.CLOUDYNARY_API_KEY, 
  api_secret: process.env.CLOUDYNARY_KEY_SECERET 
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"  
        });
        fs.unlinkSync(localFilePath);
        return response;

        //console.log("File is uploaded to Cloudinary", result.url);
        //return response;

    } catch (error) {
        fs.unlinkSync(localFilePath);
        return null;
    }
}

export { uploadOnCloudinary };
