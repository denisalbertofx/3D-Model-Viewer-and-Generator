import React, { useEffect, useState, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ModelTransform } from '@/components/scene/ModelEditor';
import { supabase } from '@/lib/supabaseClient';

// Carga progresiva de modelos
const LOAD_STAGES = {
  INIT: 'init',
  FETCH: 'fetch',
  PROCESS: 'process',
  COMPLETE: 'complete',
  ERROR: 'error',
};

interface ModelViewerProps {
  url: string;
  transform?: ModelTransform;
  onError: (error: Error) => void;
  onLoadingChange: (isLoading: boolean) => void;
}

export function ModelViewer({ url, transform, onError, onLoadingChange }: ModelViewerProps) {
  const [modelUrl, setModelUrl] = useState<string>('/models/cube.gltf');
  const [loadStage, setLoadStage] = useState(LOAD_STAGES.INIT);
  const { gl, scene } = useThree();
  const [contextLost, setContextLost] = useState(false);

  // Función para convertir URLs de Meshy a URLs locales en caché
  const cacheAndGetLocalUrl = useCallback(async (externalUrl: string): Promise<string> => {
    try {
      // Si ya es una URL local, devolver como está
      if (externalUrl.startsWith('/')) {
        return externalUrl;
      }
      
      // Extraer nombre de archivo de la URL
      const urlParts = externalUrl.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0] || 'model.glb';
      
      // Comprobar si ya tenemos este modelo en caché
      const cacheKey = `models/${btoa(externalUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
      
      console.log('Checking cached model:', cacheKey);
      
      // Intentar obtener el modelo cacheado
      try {
        const { data: cachedData } = await supabase.storage
          .from('models')
          .download(cacheKey);
        
        if (cachedData) {
          console.log('Using cached model');
          // Crear URL de objeto para el archivo cacheado
          return URL.createObjectURL(cachedData);
        }
      } catch (error) {
        console.log('No cached version found, will download');
      }
      
      // Si no hay versión en caché, probar ruta proxy
      const proxyUrl = `/api/proxy-model?url=${encodeURIComponent(externalUrl)}`;
      
      console.log('Using proxy URL:', proxyUrl);
      return proxyUrl;
    } catch (error) {
      console.error('Error processing URL:', error);
      throw new Error('Failed to process model URL');
    }
  }, []);

  useEffect(() => {
    const setupModelUrl = async () => {
      setLoadStage(LOAD_STAGES.INIT);
      onLoadingChange(true);
      
      try {
        if (!url) {
          throw new Error('No model URL provided');
        }

        console.log('Setting up model URL:', url);
        setLoadStage(LOAD_STAGES.FETCH);

        // Manejar URLs de Meshy directamente
        if (url.includes('meshy.ai') || url.includes('storage.googleapis.com')) {
          console.log('Processing Meshy URL');
          const localUrl = await cacheAndGetLocalUrl(url);
          setModelUrl(localUrl);
        } 
        // Manejar URLs externas
        else if (url.startsWith('http')) {
          console.log('Processing external URL');
          try {
            const localUrl = await cacheAndGetLocalUrl(url);
            setModelUrl(localUrl);
          } catch (error) {
            console.error('Error processing external URL:', error);
            throw new Error('Model URL not accessible');
          }
        } 
        // Manejar URLs locales
        else {
          const localUrl = url.startsWith('/') ? url : `/${url}`;
          try {
            const response = await fetch(localUrl, { method: 'HEAD' });
            if (!response.ok) {
              throw new Error(`Local model not found: ${response.status}`);
            }
            setModelUrl(localUrl);
            console.log('Local model URL verified:', localUrl);
          } catch (error) {
            console.error('Error verifying local model:', error);
            throw new Error('Local model not found');
          }
        }
      } catch (error) {
        console.error('Error setting up model URL:', error);
        onError(error instanceof Error ? error : new Error('Failed to setup model URL'));
        setModelUrl('/models/cube.gltf');
        setLoadStage(LOAD_STAGES.ERROR);
      }
    };
    
    setupModelUrl();
  }, [url, onError, cacheAndGetLocalUrl, onLoadingChange]);

  const { scene: gltfScene } = useGLTF(modelUrl, true, undefined, (error) => {
    console.error('GLTF loading error:', error);
    onError(new Error('Failed to load model: Check console for details'));
    setLoadStage(LOAD_STAGES.ERROR);
    onLoadingChange(false);
  });

  useEffect(() => {
    if (!gltfScene) {
      console.warn('No scene loaded from GLTF');
      return;
    }

    try {
      setLoadStage(LOAD_STAGES.PROCESS);
      console.log('Processing loaded model:', gltfScene);
      
      // Centrar y escalar el modelo
      const box = new THREE.Box3().setFromObject(gltfScene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = maxDim > 0 ? 2 / maxDim : 1;
      
      gltfScene.position.x = -center.x * scale;
      gltfScene.position.y = -center.y * scale;
      gltfScene.position.z = -center.z * scale;
      gltfScene.scale.set(scale, scale, scale);
      
      // Configurar materiales
      gltfScene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach(material => {
              if (material instanceof THREE.Material) {
                material.side = THREE.DoubleSide;
                if (material instanceof THREE.MeshStandardMaterial) {
                  material.metalness = 0.5;
                  material.roughness = 0.5;
                }
              }
            });
          }
        }
      });
      
      console.log('Model processed successfully');
      setLoadStage(LOAD_STAGES.COMPLETE);
      onLoadingChange(false);
    } catch (error) {
      console.error("Error processing model:", error);
      onError(error instanceof Error ? error : new Error('Failed to process model'));
      setLoadStage(LOAD_STAGES.ERROR);
      onLoadingChange(false);
    }
  }, [gltfScene, onError, onLoadingChange]);

  // Aplicar transformaciones del editor
  useEffect(() => {
    if (!gltfScene || !transform) return;
    
    try {
      gltfScene.scale.multiplyScalar(transform.scale);
      gltfScene.rotation.x = THREE.MathUtils.degToRad(transform.rotationX);
      gltfScene.rotation.y = THREE.MathUtils.degToRad(transform.rotationY);
      gltfScene.rotation.z = THREE.MathUtils.degToRad(transform.rotationZ);
      
      gltfScene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach(material => {
              if (material instanceof THREE.MeshStandardMaterial) {
                if (transform.color) {
                  material.color = new THREE.Color(transform.color);
                }
                if (transform.wireframe !== undefined) {
                  material.wireframe = transform.wireframe;
                }
              }
            });
          }
        }
      });
    } catch (error) {
      console.error("Error applying transformations:", error);
    }
  }, [gltfScene, transform]);

  useEffect(() => {
    const handleContextLost = () => {
      console.log(" WebGL context lost");
      setContextLost(true);
    };

    const handleContextRestored = () => {
      console.log(" WebGL context restored");
      setContextLost(false);
    };

    gl.domElement.addEventListener('webglcontextlost', handleContextLost);
    gl.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
      gl.domElement.removeEventListener('webglcontextlost', handleContextLost);
      gl.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl]);

  useEffect(() => {
    if (contextLost) {
      onError(new Error('WebGL context lost. Please refresh the page.'));
    }
  }, [contextLost, onError]);

  if (!gltfScene) {
    console.warn('Rendering default model due to missing scene');
    return <DefaultModel />;
  }

  return <primitive object={gltfScene} />;
}

export function DefaultModel() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={new THREE.Color("#4f46e5")} />
      </mesh>
    </group>
  );
} 