// Importamos las dependencias necesarias de Supabase
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { cors } from 'https://deno.land/x/cors@v1.2.2/mod.ts';

// Función para hacer proxy de modelos 3D
const proxyModel = async (req: Request) => {
  try {
    // Obtener la URL del modelo desde los parámetros de consulta
    const url = new URL(req.url).searchParams.get('url');
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Proxying model URL:', url);
    
    // Configurar los encabezados para la solicitud
    const headers = new Headers({
      'Accept': 'model/gltf-binary,model/gltf+json,*/*',
      'User-Agent': 'Supabase Edge Function'
    });
    
    // Obtener el token de autenticación si está presente
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      headers.set('Authorization', authHeader);
    }
    
    // Realizar la solicitud a la URL del modelo
    const modelResponse = await fetch(url, {
      headers,
      method: 'GET'
    });
    
    if (!modelResponse.ok) {
      throw new Error(`Failed to fetch model: ${modelResponse.status} ${modelResponse.statusText}`);
    }
    
    // Obtener los encabezados y el cuerpo de la respuesta
    const modelData = await modelResponse.arrayBuffer();
    const contentType = modelResponse.headers.get('content-type') || 'application/octet-stream';
    
    // Configurar encabezados para la respuesta
    const responseHeaders = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    
    // Devolver la respuesta con el modelo
    return new Response(modelData, {
      status: 200,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('Error proxying model:', error);
    
    // Devolver un error
    return new Response(
      JSON.stringify({ 
        error: 'Failed to proxy model', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        } 
      }
    );
  }
};

// Manejar solicitudes CORS
const handleCors = (req: Request) => {
  // Para solicitudes OPTIONS (preflight), devolver encabezados CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  // Para otras solicitudes, continuar con el proxy
  return proxyModel(req);
};

// Iniciar el servidor con la función de manejo
serve(handleCors);