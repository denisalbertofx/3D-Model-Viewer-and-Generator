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
  
  uploadModelToStorage: async (modelUrl: string, modelId: string): Promise<string> => {
    try {
      console.log('Subiendo modelo a Storage...', { modelUrl, modelId });
      
      // Si la URL ya tiene un formato storage:// o es una URL local, no necesitamos descargarla
      if (modelUrl.startsWith('storage://') || modelUrl.startsWith('/')) {
        console.log('URL ya está en formato storage o es local, no es necesario subirla:', modelUrl);
        return modelUrl;
      }
      
      // Crear un nombre de archivo seguro basado en el ID del modelo
      const safeFileName = `models/${modelId}.glb`;
      
      // Verificar si el bucket existe, si no, intentar crearlo
      try {
        const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('models');
        
        if (bucketError) {
          console.warn('Error al verificar bucket:', bucketError);
          
          // Intentar crear el bucket si no existe
          const { data: createData, error: createError } = await supabase.storage.createBucket('models', {
            public: true,
            fileSizeLimit: 100000000, // 100MB
          });
          
          if (createError) {
            console.error('Error al crear bucket de almacenamiento:', createError);
            throw new Error(`No se pudo crear el bucket de almacenamiento: ${createError.message}`);
          }
          
          console.log('Bucket creado correctamente:', createData);
        } else {
          console.log('Bucket existente:', bucketData);
        }
      } catch (error) {
        console.error('Error al verificar/crear bucket:', error);
      }
      
      // Descargar el modelo desde la URL externa
      console.log('Descargando modelo desde URL externa...');
      
      try {
        // Usar la función proxy para modelos si está disponible
        const proxyUrl = `/api/proxy-model?url=${encodeURIComponent(modelUrl)}`;
        
        // Intentar descargar a través del proxy
        const modelResponse = await fetch(proxyUrl);
        
        if (!modelResponse.ok) {
          // Si el proxy falla, intentar directamente
          console.warn(`Proxy falló (${modelResponse.status}), intentando descarga directa...`);
          const directResponse = await fetch(modelUrl);
          
          if (!directResponse.ok) {
            throw new Error(`No se pudo descargar el modelo: ${directResponse.status}`);
          }
          
          const modelBlob = await directResponse.blob();
          
          // Subir el blob a Supabase Storage
          console.log(`Subiendo modelo a Storage (tamaño: ${modelBlob.size} bytes)...`);
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('models')
            .upload(safeFileName, modelBlob, {
              contentType: 'model/gltf-binary',
              upsert: true,
              cacheControl: '31536000', // 1 año
            });
          
          if (uploadError) {
            console.error('Error al subir modelo a Storage:', uploadError);
            throw new Error(`Error al subir modelo: ${uploadError.message}`);
          }
          
          console.log('Modelo subido exitosamente:', uploadData);
          
          // Generar URL pública
          const { data: publicUrlData } = supabase.storage
            .from('models')
            .getPublicUrl(safeFileName);
          
          return publicUrlData.publicUrl;
        } else {
          // Si el proxy funciona, usar esa respuesta
          const modelBlob = await modelResponse.blob();
          
          // Subir el blob a Supabase Storage
          console.log(`Subiendo modelo a Storage (tamaño: ${modelBlob.size} bytes)...`);
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('models')
            .upload(safeFileName, modelBlob, {
              contentType: 'model/gltf-binary',
              upsert: true,
              cacheControl: '31536000', // 1 año
            });
          
          if (uploadError) {
            console.error('Error al subir modelo a Storage:', uploadError);
            throw new Error(`Error al subir modelo: ${uploadError.message}`);
          }
          
          console.log('Modelo subido exitosamente:', uploadData);
          
          // Generar URL pública
          const { data: publicUrlData } = supabase.storage
            .from('models')
            .getPublicUrl(safeFileName);
          
          return publicUrlData.publicUrl;
        }
      } catch (error) {
        console.error('Error al subir modelo a storage:', error);
        // En caso de error, devolver la URL original
        return modelUrl;
      }
    } catch (error) {
      console.error('Error al subir el modelo a Storage:', error);
      // En caso de error general, devolver la URL original
      return modelUrl;
    }
  },
  
  generateModel: async (prompt: string): Promise<any> => {
    try {
      set({ isGenerating: true });
      console.log('Iniciando generación de modelo con prompt:', prompt);
      
      // URL de la función Edge de Supabase para generar modelos
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-model`;
      console.log('URL de la función Edge:', functionUrl);
      
      // Obtener sesión para autenticación
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        throw new Error('No hay sesión activa');
      }
      
      // Llamar a la función Edge para generar el modelo
      console.log('Llamando a la función Edge...');
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`
        },
        body: JSON.stringify({ prompt })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error al generar modelo: ${errorData.error || response.statusText}`);
      }
      
      // Procesar respuesta de la función Edge
      const data = await response.json();
      console.log('Respuesta de la función Edge:', data);
      
      if (!data.success) {
        throw new Error(`Error al generar modelo: ${data.message || 'Error desconocido'}`);
      }
      
      // Extraer datos del modelo generado
      const { model_id, model_url } = data;
      
      // Subir el modelo a Storage para tener una copia local
      console.log('Subiendo modelo a Storage...');
      let finalModelUrl = model_url;
      
      try {
        // Intentar subir el modelo a Storage usando la función del store
        const storageUrl = await get().uploadModelToStorage(model_url, model_id);
        
        if (storageUrl && storageUrl !== model_url) {
          console.log('Modelo subido a Storage exitosamente:', storageUrl);
          finalModelUrl = storageUrl;
          
          // Actualizar URL en la base de datos
          const { error: updateError } = await supabase
            .from('models')
            .update({
              model_url: finalModelUrl
            })
            .eq('id', model_id);
          
          if (updateError) {
            console.error('Error al actualizar URL del modelo en la base de datos:', updateError);
          } else {
            console.log('URL del modelo actualizada en la base de datos');
          }
        } else {
          console.log('Se utilizará la URL original del modelo:', model_url);
        }
      } catch (storageError) {
        console.error('Error al subir modelo a Storage:', storageError);
        // Continuar con la URL original si hay error
      }
      
      // Actualizar lista de modelos
      console.log('Actualizando lista de modelos...');
      await get().loadModels();
      
      // Establecer el modelo recién generado como el actual
      get().setCurrentModel(model_id);
      
      // Desactivar estado de generación
      set({ isGenerating: false });
      
      return {
        success: true,
        model_id,
        model_url: finalModelUrl
      };
    } catch (error) {
      console.error('Error al generar modelo:', error);
      set({ isGenerating: false });
      throw error;
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