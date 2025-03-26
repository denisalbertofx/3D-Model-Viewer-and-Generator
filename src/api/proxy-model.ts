import { createClient } from '@supabase/supabase-js';

// Definir tipos para Express
interface Request {
  query: {
    url?: string;
    token?: string;
  }
}

interface Response {
  status: (code: number) => Response;
  json: (data: any) => void;
  send: (data: any) => void;
  setHeader: (name: string, value: string) => void;
}

export default async function handler(req: Request, res: Response) {
  try {
    // Extraer la URL del modelo y el token de la consulta
    const { url, token } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Intentar obtener el modelo desde la URL externa
    console.log('Proxying model URL:', url);
    
    const headers: Record<string, string> = {
      'Accept': 'model/gltf-binary,model/gltf+json,*/*'
    };
    
    // Si se proporciona un token, agregarlo a los encabezados de la solicitud
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Fetching de la URL del modelo
    const modelResponse = await fetch(url, {
      headers,
      method: 'GET'
    });
    
    if (!modelResponse.ok) {
      throw new Error(`Failed to fetch model: ${modelResponse.status} ${modelResponse.statusText}`);
    }
    
    // Obtener el tipo de contenido de la respuesta
    const contentType = modelResponse.headers.get('content-type') || 'application/octet-stream';
    const contentLength = modelResponse.headers.get('content-length');
    
    // Obtener el archivo como blob
    const modelBlob = await modelResponse.blob();
    const arrayBuffer = await modelBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Configurar headers para la respuesta
    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    // Enviar el buffer como respuesta
    return res.status(200).send(buffer);
    
  } catch (error: unknown) {
    console.error('Error proxying model:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy model',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
} 