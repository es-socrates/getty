function ensureFetchPolyfill() {
  if (typeof global.fetch !== 'undefined' && typeof global.Response !== 'undefined') {
    return;
  }
  try {
    const undici = require('undici');
    if (typeof global.fetch === 'undefined') global.fetch = undici.fetch;
    if (typeof global.Headers === 'undefined') global.Headers = undici.Headers;
    if (typeof global.Request === 'undefined') global.Request = undici.Request;
    if (typeof global.Response === 'undefined') global.Response = undici.Response;
    if (typeof global.FormData === 'undefined') global.FormData = undici.FormData;
    if (typeof global.File === 'undefined') global.File = undici.File;
    if (typeof global.Blob === 'undefined') global.Blob = undici.Blob;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[supabase-storage] Missing fetch polyfill:', error.message);
    }
  }
}

ensureFetchPolyfill();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

class SupabaseStorage {
  constructor() {
    if (!supabase) {
      throw new Error('Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }
    this.provider = 'supabase';
  }

  /**
   * Upload a file to Supabase Storage
   * @param {string} bucket - The storage bucket name
   * @param {string} fileName - The original filename
   * @param {Buffer|Blob|File} fileData - The file data
   * @param {Object|string} options - Additional options or content type
   * @returns {Promise<Object>} Upload result with public URL
   */
  async uploadFile(bucket, fileName, fileData, options = {}) {
    try {
      let uploadOptions = { cacheControl: '3600', upsert: true };
      if (typeof options === 'string') {
        uploadOptions.contentType = options;
      } else if (typeof options === 'object') {
        uploadOptions = { ...uploadOptions, ...options };
      }

      const fileExt = fileName.split('.').pop();
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const uniqueFileName = `${timestamp}-${randomId}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(uniqueFileName, fileData, uploadOptions);

      if (error) {
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(uniqueFileName);

      return {
        success: true,
        path: data.path,
        publicUrl,
        bucket,
        fileName: uniqueFileName,
        originalName: fileName,
        provider: 'supabase'
      };
    } catch (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Delete a file from Supabase Storage
   * @param {string} bucket - The storage bucket name
   * @param {string|string[]} filePath - The file path(s) to delete
   * @returns {Promise<Object>} Delete result
   */
  async deleteFile(bucket, filePath) {
    try {
      const filesToDelete = Array.isArray(filePath) ? filePath : [filePath];
      const { data, error } = await supabase.storage
        .from(bucket)
        .remove(filesToDelete);

      if (error) {
        throw error;
      }

      return {
        success: true,
        deleted: data.length > 0
      };
    } catch (error) {
      console.error('Supabase delete error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Get public URL for a file
   * @param {string} bucket - The storage bucket name
   * @param {string} filePath - The file path
   * @returns {string} Public URL
   */
  getPublicUrl(bucket, filePath) {
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrl;
  }

  /**
   * Check if Supabase is configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return !!supabase;
  }
}

let storageInstance = null;

function getStorage() {
  if (!storageInstance) {
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase storage not configured. File uploads will fail.');
      return null;
    }
    storageInstance = new SupabaseStorage();
  }
  return storageInstance;
}

module.exports = {
  SupabaseStorage,
  getStorage
};