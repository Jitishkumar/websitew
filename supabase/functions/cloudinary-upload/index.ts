// Setup type definitions for built-in Supabase Runtime APIs
import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Interface for request payload
interface CloudinaryUploadPayload {
  file: string; // base64 encoded file
  type: 'image' | 'video';
  folder?: string;
}

// SECRETS STORED SECURELY ON SERVER (not in client code)
const CLOUDINARY_CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')
const CLOUDINARY_API_KEY = Deno.env.get('CLOUDINARY_API_KEY')
const CLOUDINARY_API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET')

// Debug: Check if environment variables are loaded
console.log('Environment check:', {
  hasCloudName: !!CLOUDINARY_CLOUD_NAME,
  hasApiKey: !!CLOUDINARY_API_KEY,
  hasApiSecret: !!CLOUDINARY_API_SECRET
})

console.info('Cloudinary upload server started');

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    // Check if environment variables are available
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      console.error('Missing Cloudinary environment variables')
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Server configuration error: Missing Cloudinary credentials'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Unauthorized - invalid token')
    }

    const { file, type, folder }: CloudinaryUploadPayload = await req.json()
    
    if (!file || !type) {
      throw new Error('Missing required fields: file and type')
    }

    // Generate secure signature on server
    const timestamp = Math.round(Date.now() / 1000)
    const params: Record<string, any> = { timestamp }
    
    if (folder) {
      params.folder = folder
    }

    const signature = await generateSignature(params, CLOUDINARY_API_SECRET)
    
    // Prepare form data for Cloudinary
    const formData = new FormData()
    formData.append('file', file)
    formData.append('timestamp', timestamp.toString())
    formData.append('signature', signature)
    formData.append('api_key', CLOUDINARY_API_KEY)
    
    if (folder) {
      formData.append('folder', folder)
    }

    // Upload to Cloudinary with server-side credentials
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${type}/upload`,
      { 
        method: 'POST', 
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Cloudinary API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    
    if (result.error) {
      throw new Error(`Cloudinary error: ${result.error.message}`)
    }

    // Return successful upload result
    return new Response(JSON.stringify({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
      format: result.format,
      bytes: result.bytes
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
    
  } catch (error) {
    console.error('Upload error:', error)
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
})

// Generate signature for Cloudinary API
async function generateSignature(params: Record<string, any>, apiSecret: string): Promise<string> {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')
  
  const stringToSign = sortedParams + apiSecret
  
  // Use Web Crypto API (available in Deno)
  const encoder = new TextEncoder()
  const data = encoder.encode(stringToSign)
  
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
