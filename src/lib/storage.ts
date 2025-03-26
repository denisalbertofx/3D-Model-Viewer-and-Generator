import { supabase } from './supabase';
import { nanoid } from 'nanoid';

export interface UploadOptions {
  bucketName: string;
  path?: string;
  upsert?: boolean;
  fileMetadata?: Record<string, any>;
}

/**
 * Uploads a file to Supabase Storage
 */
export async function uploadFile(
  file: File | Blob, 
  options: UploadOptions
): Promise<{ path: string; url: string }> {
  const { bucketName, path = '', upsert = false, fileMetadata = {} } = options;
  
  // Generate a unique file path to avoid collisions
  let fullPath;
  if (file instanceof File) {
    const ext = file.name.split('.').pop();
    fullPath = path 
      ? `${path}/${nanoid()}.${ext}` 
      : `${nanoid()}.${ext}`;
  } else {
    // For Blob objects that don't have a name
    fullPath = path 
      ? `${path}/${nanoid()}` 
      : nanoid();
  }
  
  // Ensure bucket exists
  await ensureBucketExists(bucketName);
  
  const { data, error } = await supabase
    .storage
    .from(bucketName)
    .upload(fullPath, file, {
      upsert,
      contentType: file instanceof File ? file.type : 'application/octet-stream',
      cacheControl: '3600',
      ...(Object.keys(fileMetadata).length > 0 && { metadata: fileMetadata }),
    });
  
  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
  
  // Get public URL
  const { data: { publicUrl } } = supabase
    .storage
    .from(bucketName)
    .getPublicUrl(data.path);
  
  return {
    path: data.path,
    url: publicUrl,
  };
}

/**
 * Downloads a file from Supabase Storage
 */
export async function downloadFile(
  bucketName: string,
  filePath: string
): Promise<Blob> {
  const { data, error } = await supabase
    .storage
    .from(bucketName)
    .download(filePath);
  
  if (error || !data) {
    throw new Error(`Download failed: ${error?.message || 'Unknown error'}`);
  }
  
  return data;
}

/**
 * Downloads a file from a URL (including external URLs) and returns as a Blob
 */
export async function downloadFileFromUrl(url: string): Promise<Blob> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    throw new Error(`Failed to download file: ${error.message}`);
  }
}

/**
 * Deletes a file from Supabase Storage
 */
export async function deleteFile(
  bucketName: string,
  filePath: string
): Promise<void> {
  const { error } = await supabase
    .storage
    .from(bucketName)
    .remove([filePath]);
  
  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

/**
 * Lists files in a Supabase Storage bucket
 */
export async function listFiles(
  bucketName: string,
  path?: string
) {
  const { data, error } = await supabase
    .storage
    .from(bucketName)
    .list(path || '');
  
  if (error) {
    throw new Error(`List failed: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Creates a signed URL for temporary access to a file
 */
export async function createSignedUrl(
  bucketName: string,
  filePath: string,
  expiresIn = 60 // seconds
) {
  const { data, error } = await supabase
    .storage
    .from(bucketName)
    .createSignedUrl(filePath, expiresIn);
  
  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
  
  return data.signedUrl;
}

/**
 * Check if a bucket exists, and create it if it doesn't
 */
export async function ensureBucketExists(
  bucketName: string,
  isPublic = false
) {
  try {
    // Verificar la sesión actual
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('No active session found');
    }

    // Verificar permisos del usuario
    const { data: userRole, error: roleError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (roleError) {
      throw new Error(`Failed to check user role: ${roleError.message}`);
    }

    // Solo permitir crear buckets si el usuario tiene el rol adecuado
    if (userRole?.role !== 'admin' && userRole?.role !== 'service_role') {
      console.warn(`User ${session.user.id} does not have permission to create buckets`);
      return false;
    }

    // Check if the bucket exists
    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets();
    
    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      // Create the bucket if it doesn't exist
      const { error: createError } = await supabase
        .storage
        .createBucket(bucketName, {
          public: isPublic,
        });
      
      if (createError) {
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }
      
      console.log(`Storage bucket '${bucketName}' created successfully`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error ensuring bucket exists: ${error.message}`);
    // No lanzar el error, solo retornar false
    return false;
  }
}

/**
 * Get a public URL for a file
 */
export function getPublicUrl(bucketName: string, filePath: string): string {
  const { data } = supabase
    .storage
    .from(bucketName)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

/**
 * Calculate file size in human-readable format
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}