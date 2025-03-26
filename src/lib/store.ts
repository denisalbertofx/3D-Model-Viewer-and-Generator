import { create } from 'zustand';
import { supabase } from './supabase';
import { uploadFile, downloadFile, ensureBucketExists } from './storage';
import { nanoid } from 'nanoid';

export interface Model {
  id: string;
  user_id: string;
  prompt: string;
  model_url: string;
  file_path?: string;
  format: string;
  created_at: string;
}

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  credits: number;
  subscription_tier: string;
  role: string;
  subscription_status: string;
  subscription_end_date: string | null;
  created_at: string;
  updated_at: string;
}

interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: string;
  credits_per_cycle: number;
  features: any;
  is_active: boolean;
}

interface UserState {
  user: any | null;
  profile: Profile | null;
  isGenerating: boolean;
  currentModel: Model | null;
  models: Model[];
  subscriptionTiers: SubscriptionTier[];
  setUser: (user: any | null) => void;
  setProfile: (profile: Profile | null) => void;
  setModels: (models: Model[]) => void;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
  loadModels: () => Promise<void>;
  loadSubscriptionTiers: () => Promise<void>;
  generateModel: (prompt: string) => Promise<void>;
  setCurrentModel: (model: Model | null) => void;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  checkoutSubscription: (tier: string) => Promise<string>;
  manageSubscription: () => Promise<string>;
  downloadModel: (modelId: string, format: string) => Promise<string>;
  deleteModel: (modelId: string) => Promise<void>;
  uploadModelToStorage: (modelUrl: string, modelId: string) => Promise<string>;
  supabase: typeof supabase;
}

// Model storage bucket name
const MODEL_BUCKET = 'model-files';

export const useStore = create<UserState>((set, get) => ({
  user: null,
  profile: null,
  isGenerating: false,
  currentModel: null,
  models: [],
  subscriptionTiers: [],
  supabase, // Expose supabase client
  
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setModels: (models) => set({ models }),
  setCurrentModel: (model) => set({ currentModel: model }),
  
  signIn: async (email, password) => {
    try {
      console.log("Iniciando proceso de inicio de sesión...");
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error("Error en inicio de sesión:", error);
        throw error;
      }
      
      console.log("Inicio de sesión exitoso, verificando sesión...");
      
      // Verificar que tenemos una sesión válida
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error("Error al obtener sesión:", sessionError);
        throw new Error('No se pudo obtener la sesión');
      }
      
      console.log("Sesión verificada, actualizando estado...");
      set({ user: session.user });
      
      // Cargar datos del usuario
      console.log("Cargando datos del usuario...");
      await get().loadProfile();
      await get().loadModels();
      
      // Ensure storage bucket exists
      try {
        console.log("Verificando bucket de almacenamiento...");
        const bucketExists = await ensureBucketExists(MODEL_BUCKET, true);
        if (!bucketExists) {
          console.warn("No se pudo crear el bucket de almacenamiento. Algunas funciones pueden estar limitadas.");
        }
      } catch (error) {
        console.warn("Error al verificar/crear bucket:", error);
      }
      
      console.log("Proceso de inicio de sesión completado");
      return session;
    } catch (error) {
      console.error('Error en signIn:', error);
      throw error;
    }
  },
  
  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    set({ user: data.user });
  },
  
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, models: [], currentModel: null });
  },
  
  loadProfile: async () => {
    try {
      const { user } = get();
      if (!user) {
        console.warn('No hay usuario activo para cargar el perfil');
        return;
      }
      
      console.log('Cargando perfil para usuario:', user.id);
      
      // Intentar cargar el perfil
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (error) {
        console.error('Error al cargar perfil:', error);
        // Si no se encuentra el perfil, crear uno por defecto
        if (error.message.includes('No rows found')) {
          console.log('Creando perfil por defecto...');
          const defaultProfile = {
            id: user.id,
            username: user.email?.split('@')[0] || null,
            avatar_url: null,
            credits: 5,
            subscription_tier: 'free',
            role: 'user',
            subscription_status: 'active',
            subscription_end_date: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const { error: insertError, data: newProfile } = await supabase
            .from('profiles')
            .insert([defaultProfile])
            .select()
            .single();
            
          if (insertError) {
            console.error('Error al crear perfil por defecto:', insertError);
            throw insertError;
          }
          
          console.log('Perfil por defecto creado:', newProfile);
          set({ profile: newProfile });
          return;
        }
        throw error;
      }
      
      console.log('Perfil cargado:', data);
      set({ profile: data });
    } catch (error) {
      console.error('Error en loadProfile:', error);
      // No lanzar el error, simplemente registrarlo
      console.log('Continuando sin perfil...');
    }
  },
  
  loadModels: async () => {
    try {
      const { user } = get();
      if (!user) {
        console.warn('No hay usuario activo para cargar modelos');
        return;
      }
      
      console.log('Cargando modelos para usuario:', user.id);
      
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error al cargar modelos:', error);
        throw error;
      }
      
      console.log('Modelos cargados:', data?.length || 0);
      set({ models: data || [] });
      
      // Set current model to the most recent one if available
      if (data && data.length > 0) {
        console.log('Estableciendo modelo actual:', data[0].id);
        set({ currentModel: data[0] });
      }
    } catch (error) {
      console.error('Error en loadModels:', error);
      throw error;
    }
  },
  
  loadSubscriptionTiers: async () => {
    try {
      console.log('Cargando planes de suscripción...');
      
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
        
      if (error) {
        console.error('Error al cargar planes:', error);
        throw error;
      }
      
      console.log('Planes cargados:', data?.length || 0);
      set({ subscriptionTiers: data || [] });
    } catch (error) {
      console.error('Error en loadSubscriptionTiers:', error);
      throw error;
    }
  },
  
  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) throw new Error('You must be logged in');
    
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);
      
    if (error) throw error;
  },
  
  checkoutSubscription: async (tier) => {
    const { user } = get();
    if (!user) throw new Error('You must be logged in');
    
    // Call the subscription-checkout edge function
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-checkout`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        tier,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create checkout session');
    }
    
    const { url } = await response.json();
    return url;
  },
  
  manageSubscription: async () => {
    const { user, profile } = get();
    if (!user) throw new Error('You must be logged in');
    if (!profile?.subscription_tier || profile.subscription_tier === 'free') {
      throw new Error('No active subscription');
    }
    
    // Call the subscription-portal edge function
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-portal`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create portal session');
    }
    
    const { url } = await response.json();
    return url;
  },
  
  uploadModelToStorage: async (modelUrl: string, modelId: string) => {
    if (!modelUrl) throw new Error('Model URL is required');
    
    try {
      // Create a unique filename that preserves file extension
      const extension = modelUrl.split('.').pop() || 'glb';
      const filename = `${modelId}.${extension}`;
      const filePath = `models/${filename}`;
      
      // First, try to download the file from the original URL
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session found');
      
      // We need to fetch the file through our proxy to avoid CORS issues
      const proxyUrl = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-model`);
      proxyUrl.searchParams.set('url', modelUrl);
      proxyUrl.searchParams.set('token', session.access_token);
      
      console.log("Fetching model file from proxy:", proxyUrl.toString());
      
      // Fetch the file data
      const response = await fetch(proxyUrl.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch model file: ${response.statusText}`);
      }
      
      // Convert to blob
      const modelBlob = await response.blob();
      
      // Make sure the bucket exists
      await ensureBucketExists(MODEL_BUCKET, true);
      
      // Upload the file to Supabase Storage
      const { data, error } = await supabase.storage
        .from(MODEL_BUCKET)
        .upload(filePath, modelBlob, {
          contentType: modelBlob.type,
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) throw error;
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from(MODEL_BUCKET)
        .getPublicUrl(filePath);
      
      // Update the model in the database with the new file path
      await supabase
        .from('models')
        .update({
          file_path: filePath,
          model_url: publicUrl
        })
        .eq('id', modelId);
      
      console.log("Model file uploaded to Storage:", publicUrl);
      return publicUrl;
      
    } catch (error) {
      console.error("Failed to upload model to storage:", error);
      throw error;
    }
  },
  
  generateModel: async (prompt: string) => {
    const { user, profile } = get();
    if (!user) throw new Error('Debes iniciar sesión para generar modelos');
    if (!profile) throw new Error('No se encontró tu perfil');
    if (profile.credits < 1) throw new Error('No tienes suficientes créditos');
        
    set({ isGenerating: true });
    
    try {
      console.log("Iniciando generación de modelo con prompt:", prompt);
      
      // Call the Supabase Edge Function
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-model`;
      console.log("URL de la función Edge:", apiUrl);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No se encontró una sesión activa');
      }
      
      console.log("Llamando a la función Edge...");
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          userId: user.id
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error en la función Edge:", errorData);
        throw new Error(errorData.error || 'Error al generar el modelo');
      }
      
      const result = await response.json();
      console.log("Respuesta de la función Edge:", result);
      
      // If model generation was successful and we have a URL, upload it to storage
      if (result.model_url && result.model_id) {
        try {
          console.log("Subiendo modelo a Storage...");
          await get().uploadModelToStorage(result.model_url, result.model_id);
        } catch (storageError) {
          console.error("Error al subir el modelo a Storage:", storageError);
          // Continuamos incluso si falla la subida a Storage, ya que tenemos la URL externa
        }
      }
      
      // Refresh models to include the newly created one
      console.log("Actualizando lista de modelos...");
      await get().loadModels();
      await get().loadProfile(); // Also reload profile to get updated credits
      
      return result;
      
    } catch (error) {
      console.error("Error en generateModel:", error);
      throw error;
    } finally {
      set({ isGenerating: false });
    }
  },
  
  downloadModel: async (modelId: string, format: string) => {
    const { user } = get();
    if (!user) throw new Error('Debes iniciar sesión para descargar modelos');
    
    try {
      // Verificar y refrescar la sesión si es necesario
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Sesión no válida. Por favor, vuelve a iniciar sesión.');
      }
      
      // Get the model data
      const { data: model, error: modelError } = await supabase
        .from('models')
        .select('*')
        .eq('id', modelId)
        .eq('user_id', user.id)
        .single();
      
      if (modelError || !model) {
        throw new Error('Modelo no encontrado o acceso denegado');
      }
      
      // Si el modelo tiene un file_path, está almacenado en Supabase Storage
      if (model.file_path) {
        console.log("Descargando modelo desde Storage:", model.file_path);
        
        // Crear una URL firmada para descarga (válida por 60 minutos)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from(MODEL_BUCKET)
          .createSignedUrl(model.file_path, 3600);
        
        if (signedUrlError) {
          throw new Error(`Error al crear URL firmada: ${signedUrlError.message}`);
        }
        
        return signedUrlData.signedUrl;
      }
      
      // Si no hay file_path, usar la URL externa a través del proxy
      console.log("Modelo no en Storage, usando proxy para:", model.model_url);
      
      // Llamar a la función Edge de Supabase para exportar el modelo
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-model`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId,
          format,
          userId: user.id
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al exportar el modelo');
      }
      
      const { downloadUrl } = await response.json();
      
      // Para la descarga, usar el proxy para evitar problemas de CORS
      const proxyUrl = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-model`);
      proxyUrl.searchParams.set('url', downloadUrl);
      proxyUrl.searchParams.set('token', session.access_token);
      
      return proxyUrl.toString();
    } catch (error) {
      console.error('Error al descargar modelo:', error);
      throw error;
    }
  },
  
  deleteModel: async (modelId: string) => {
    const { user } = get();
    if (!user) throw new Error('Debes iniciar sesión para eliminar modelos');
    
    const { error } = await supabase
      .from('models')
      .delete()
      .eq('id', modelId)
      .eq('user_id', user.id);
      
    if (error) throw error;
  },
}));