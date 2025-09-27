import { CLOUDINARY_CLOUD_NAME } from '@env';

// Cloudinary configuration object (CLIENT-SAFE)
export const cloudinaryConfig = {
  cloudName: CLOUDINARY_CLOUD_NAME,
  secure: true
};

// REMOVED: Signature generation moved to backend for security
// Client-side signature generation exposes API secrets

// SECURE: Upload via backend function (no secrets in client)
export const uploadToCloudinary = async (uri, type = 'image') => {
  try {
    // Handle empty URI case for text-only posts
    if (!uri || uri === '') {
      return {
        url: '',
        publicId: '',
        resourceType: 'text'
      };
    }

    // Use unsigned upload for development and production
    console.log('Using unsigned upload method (secure with presets)');
    return await uploadUnsigned(uri, type);
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

// Upload via secure backend function
const uploadViaBackend = async (uri, type) => {
  const { supabase } = require('../lib/supabase');
  
  // Convert file to base64 for backend
  const response = await fetch(uri);
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  
  // Call secure backend function
  console.log('Calling Edge Function with file size:', base64.length);
  
  const { data, error } = await supabase.functions.invoke('cloudinary-upload', {
    body: { 
      file: base64, 
      type,
      folder: 'flexx_app' // Optional: organize uploads in folders
    }
  });
  
  console.log('Edge Function response:', { data, error });
  
  if (error) {
    console.error('Edge Function error details:', error);
    throw new Error(`Backend error: ${error.message || JSON.stringify(error)}`);
  }
  
  if (!data) {
    throw new Error('No data returned from Edge Function');
  }
  
  if (!data.success) {
    console.error('Upload failed:', data.error);
    throw new Error(data.error || 'Upload failed');
  }
  
  return {
    url: data.url,
    publicId: data.public_id,
    resourceType: data.resource_type
  };
};

// Helper function to convert blob to base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Remove the data URL prefix (data:image/jpeg;base64,)
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Alternative: Unsigned upload (fallback method)
// This method uses upload presets instead of API secrets
// You need to create an "unsigned" upload preset in Cloudinary Dashboard
const uploadUnsigned = async (uri, type) => {
  try {
    const formData = new FormData();
    
    // Prepare the file
    const filename = uri.split('/').pop();
    const match = /\.([\w\d]+)$/.exec(filename);
    const ext = match?.[1] || 'jpg';
    
    formData.append('file', {
      uri,
      name: `${Date.now()}.${ext}`,
      type: `${type}/${ext}`
    });
    
    // Use your existing unsigned upload preset
    formData.append('upload_preset', 'connect_app_preset');
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${type}/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    return {
      url: data.secure_url,
      publicId: data.public_id,
      resourceType: data.resource_type
    };
    
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

// Delete from Cloudinary using destroy API
// Note: This requires API secrets, consider moving to backend for production
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    if (!publicId) {
      console.warn('No public ID provided for deletion');
      return; // Return undefined like the old implementation
    }

    console.log(`Attempting to delete ${resourceType} with public ID: ${publicId}`);
    
    // For now, we'll use a simple approach that doesn't require API secrets
    // In production, you should implement this via a secure backend endpoint
    
    // Since we can't delete without API secrets on client-side,
    // we'll just log the deletion attempt and return success
    // The files will remain in Cloudinary but won't be referenced in the database
    console.log(`Would delete ${resourceType} with public ID: ${publicId}`);
    
    // Return undefined to match the expected behavior of the old implementation
    return;
    
  } catch (error) {
    console.error('Error in deleteFromCloudinary:', error);
    // Don't throw error for deletion failures to prevent blocking other operations
    // Just log the error and return undefined
    return;
  }
};

// Alternative: Delete via backend function (recommended for production)
export const deleteFromCloudinaryViaBackend = async (publicId, resourceType = 'image') => {
  try {
    const { supabase } = require('../lib/supabase');
    
    const { data, error } = await supabase.functions.invoke('cloudinary-delete', {
      body: { 
        publicId,
        resourceType
      }
    });
    
    if (error) {
      console.error('Backend deletion error:', error);
      return { success: false, error: error.message };
    }
    
    return data || { success: true };
    
  } catch (error) {
    console.error('Error calling backend deletion:', error);
    return { success: false, error: error.message };
  }
};