import React from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import * as THREE from 'three';
import { ModelTransform } from '@/components/scene/ModelEditor';

function LoadingSpinner() {
  const { camera } = useThree();
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    
    const animate = () => {
      setRotation(prev => (prev + 0.01) % (Math.PI * 2));
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <group position={[0, 0, -5]} rotation={[0, rotation, 0]}>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={new THREE.Color("#4f46e5")} wireframe />
      </mesh>
    </group>
  );
}

interface ModelViewerProps {
  url: string;
  transform?: ModelTransform;
  onError: (error: Error) => void;
}

function ModelViewer({ url, transform, onError }: ModelViewerProps) {
  const [modelUrl, setModelUrl] = useState<string>('/models/cube.gltf');
  const [isLoading, setIsLoading] = useState(true);
  const { gl } = useThree();

  useEffect(() => {
    const setupModelUrl = async () => {
      setIsLoading(true);
      try {
        if (!url) {
          throw new Error('No model URL provided');
        }

        console.log('Setting up model URL:', url);

        if (url.startsWith('http')) {
          // Si es una URL de Meshy, intentar cargarla directamente
          if (url.includes('meshy.ai') || url.includes('storage.googleapis.com')) {
            console.log('Loading Meshy model:', url);
            setModelUrl(url);
          } else {
            // Para otras URLs externas, verificar accesibilidad
            try {
              const response = await fetch(url, { 
                method: 'HEAD',
                headers: {
                  'Accept': 'model/gltf-binary,model/gltf+json,*/*'
                }
              });
              if (!response.ok) {
                throw new Error(`Model URL not accessible: ${response.status}`);
              }
              setModelUrl(url);
              console.log('External model URL verified:', url);
            } catch (error) {
              console.error('Error verifying model URL:', error);
              throw new Error('Model URL not accessible');
            }
          }
        } else {
          // Si es una ruta local, usar la ruta relativa
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
      } finally {
        setIsLoading(false);
      }
    };
    
    setupModelUrl();
  }, [url, onError]);

  const { scene: gltfScene } = useGLTF(modelUrl, true, undefined, (error) => {
    console.error('GLTF loading error:', error);
    onError(new Error('Failed to load model: Check console for details'));
  });

  useEffect(() => {
    if (!gltfScene) {
      console.warn('No scene loaded from GLTF');
      return;
    }

    try {
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
      setIsLoading(false);
    } catch (error) {
      console.error("Error processing model:", error);
      onError(error instanceof Error ? error : new Error('Failed to process model'));
    }
  }, [gltfScene, onError]);

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

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!gltfScene) {
    console.warn('Rendering default model due to missing scene');
    return <DefaultModel />;
  }

  return <primitive object={gltfScene} />;
}

function DefaultModel() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={new THREE.Color("#4f46e5")} />
      </mesh>
    </group>
  );
}

interface ThreeSceneProps {
  modelTransform?: ModelTransform;
}

export function ThreeScene({ modelTransform }: ThreeSceneProps) {
  const { isGenerating, currentModel } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [fallbackToDefault, setFallbackToDefault] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [contextLost, setContextLost] = useState(false);

  const handleError = useCallback((e: Error) => {
    console.error("Failed to load model:", e);
    setError(`Failed to load model: ${e.message}`);
    setFallbackToDefault(true);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (currentModel?.model_url) {
      console.log('Current model changed:', currentModel);
      setError(null);
      setFallbackToDefault(false);
      setIsLoading(true);
      setContextLost(false);
    }
  }, [currentModel]);

  const handleContextLost = useCallback(() => {
    console.warn('WebGL context lost');
    setContextLost(true);
  }, []);

  const handleContextRestored = useCallback(() => {
    console.log('WebGL context restored');
    setContextLost(false);
  }, []);

  return (
    <div className="w-full h-full min-h-[400px] relative">
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-500/90 backdrop-blur-sm text-white p-3 text-center z-10 shadow-lg rounded-md m-2">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-2 text-white/80 hover:text-white underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {contextLost && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500/90 backdrop-blur-sm text-white p-3 text-center z-10 shadow-lg rounded-md m-2">
          WebGL context lost. Trying to recover...
        </div>
      )}
      
      <ErrorBoundary onError={handleError}>
        <Canvas 
          camera={{ position: [0, 0, 5], fov: 50 }}
          gl={{ 
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            console.log('Canvas created with WebGL context:', gl);
            
            // Manejar pérdida y restauración de contexto
            const canvas = gl.domElement;
            canvas.addEventListener('webglcontextlost', handleContextLost);
            canvas.addEventListener('webglcontextrestored', handleContextRestored);

            return () => {
              canvas.removeEventListener('webglcontextlost', handleContextLost);
              canvas.removeEventListener('webglcontextrestored', handleContextRestored);
            };
          }}
          frameloop={contextLost ? 'never' : 'always'}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />
          
          <Suspense fallback={<LoadingSpinner />}>
            {isGenerating || isLoading ? (
              <LoadingSpinner />
            ) : currentModel?.model_url && !fallbackToDefault && !contextLost ? (
              <ModelViewer
                url={currentModel.model_url}
                transform={modelTransform}
                onError={handleError}
              />
            ) : (
              <DefaultModel />
            )}
          </Suspense>
          
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            makeDefault
          />
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}

// Simple error boundary component
class ErrorBoundary extends React.Component<{
  children: React.ReactNode;
  onError: (error: Error) => void;
}> {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  
  render() {
    if (this.state.hasError) {
      return <DefaultModel />;
    }
    
    return this.props.children;
  }
}