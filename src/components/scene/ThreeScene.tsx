import React from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import * as THREE from 'three';
import { ModelTransform } from '@/components/scene/ModelEditor';
import { ModelViewer, DefaultModel } from './ModelViewer';

// Loading spinner para Three.js (dentro del canvas)
const ThreeLoadingSpinner = () => {
  const { camera } = useThree();
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      setRotation(prev => (prev + 0.05) % (Math.PI * 2));
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <group position={[0, 0, -5]} rotation={[0, rotation, 0]}>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#4f46e5" wireframe />
      </mesh>
    </group>
  );
};

// Loading spinner para DOM (fuera del canvas)
const DOMLoadingSpinner = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
    </div>
  );
};

// Controlador de rendimiento para WebGL
const PerformanceMonitor = () => {
  const { gl } = useThree();
  const statsRef = useRef<any>(null);
  const fpsCheckIntervalRef = useRef<number | null>(null);
  const performanceWarningRef = useRef<boolean>(false);
  
  useEffect(() => {
    // Solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      // Importar stats de forma dinámica
      const loadStats = async () => {
        try {
          // @ts-ignore - Importación dinámica
          const Stats = (await import('three/examples/jsm/libs/stats.module')).default;
          const stats = new Stats();
          stats.dom.style.position = 'absolute';
          stats.dom.style.top = '0px';
          stats.dom.style.left = '0px';
          stats.dom.style.zIndex = '1000';
          document.body.appendChild(stats.dom);
          statsRef.current = stats;
          
          // Actualizar stats en cada frame
          const animate = () => {
            statsRef.current?.update();
            requestAnimationFrame(animate);
          };
          animate();
        } catch (error) {
          console.error('Failed to load stats module:', error);
        }
      };
      
      loadStats();
    }
    
    // Verificar rendimiento periódicamente
    fpsCheckIntervalRef.current = window.setInterval(() => {
      if (statsRef.current && statsRef.current.getFPS) {
        const fps = statsRef.current.getFPS();
        if (fps < 20 && !performanceWarningRef.current) {
          console.warn('Performance degradation detected. FPS:', fps);
          performanceWarningRef.current = true;
          
          // Liberar recursos no esenciales
          try {
            THREE.Cache.clear();
          } catch (e) {
            console.error('Error clearing cache:', e);
          }
        } else if (fps > 30 && performanceWarningRef.current) {
          console.log('Performance has improved. FPS:', fps);
          performanceWarningRef.current = false;
        }
      }
    }, 5000);
    
    return () => {
      if (statsRef.current) {
        document.body.removeChild(statsRef.current.dom);
      }
      
      if (fpsCheckIntervalRef.current) {
        window.clearInterval(fpsCheckIntervalRef.current);
      }
    };
  }, []);
  
  return null;
};

interface ThreeSceneProps {
  modelTransform?: ModelTransform;
}

export function ThreeScene({ modelTransform }: ThreeSceneProps) {
  const { isGenerating, currentModel } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [fallbackToDefault, setFallbackToDefault] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [renderQuality, setRenderQuality] = useState<[number, number]>([1, 1.5]); // [min, max] DPR
  const maxRetries = 3;
  
  // Referencia para mantener el timer de reintento
  const retryTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Backoff exponencial para reintentos
  const getRetryDelay = useCallback((attempt: number) => {
    return Math.min(1000 * Math.pow(2, attempt), 8000); // 2s, 4s, 8s
  }, []);

  const handleError = useCallback((e: Error) => {
    console.error("Failed to load model:", e);
    setError(`Failed to load model: ${e.message}`);
    setFallbackToDefault(true);
    setIsLoading(false);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  // Reducir calidad de renderizado si hay problemas
  const reduceRenderQuality = useCallback(() => {
    if (renderQuality[0] > 0.5) {
      console.log('Reducing render quality to improve performance');
      setRenderQuality([0.5, 1]);
    }
  }, [renderQuality]);

  // Sistema de limpieza de memoria
  const cleanupMemory = useCallback(() => {
    console.log('Cleaning up WebGL resources');
    
    // Limpiar caché de texturas
    THREE.Cache.clear();
    
    // Liberar buffers no utilizados
    if (rendererRef.current) {
      try {
        const gl = rendererRef.current.getContext();
        if (gl && typeof gl.getExtension === 'function') {
          const ext = gl.getExtension('WEBGL_lose_context');
          if (ext && !contextLost) {
            console.log('Forcing WebGL context reset to clean resources');
            ext.loseContext();
            setTimeout(() => ext.restoreContext(), 1000);
          }
        }
      } catch (e) {
        console.error('Error during memory cleanup:', e);
      }
    }
  }, [contextLost]);

  // Limpiar temporizadores cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentModel?.model_url) {
      console.log('Current model changed:', currentModel);
      setError(null);
      setFallbackToDefault(false);
      setIsLoading(true);
      setContextLost(false);
      setRetryCount(0);
      
      // Limpiar cualquier temporizador anterior
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      
      // Limpiar memoria cuando cambia el modelo
      cleanupMemory();
    }
  }, [currentModel, cleanupMemory]);

  const handleContextLost = useCallback(() => {
    console.warn('WebGL context lost');
    setContextLost(true);
    
    // Limpiar cualquier temporizador anterior
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }
    
    // Intentar recuperar el contexto automáticamente después de un retraso con backoff
    if (retryCount < maxRetries) {
      const delay = getRetryDelay(retryCount);
      console.log(`Will attempt to restore context in ${delay}ms`);
      
      retryTimerRef.current = window.setTimeout(() => {
        console.log(`Attempting to restore WebGL context (attempt ${retryCount + 1}/${maxRetries})`);
        setRetryCount(prev => prev + 1);
        
        // Reducir calidad de renderizado después del primer intento
        if (retryCount > 0) {
          reduceRenderQuality();
        }
        
        // Forzar la recreación del canvas
        setContextLost(false);
      }, delay);
    } else {
      setError('WebGL context could not be restored. Please refresh the page.');
    }
  }, [retryCount, maxRetries, getRetryDelay, reduceRenderQuality]);

  const handleContextRestored = useCallback(() => {
    console.log('WebGL context restored');
    setContextLost(false);
    setRetryCount(0);
    setError(null);
    
    // Limpiar el temporizador cuando se restaura
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  return (
    <div className="w-full h-full min-h-[400px] relative">
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-500/90 backdrop-blur-sm text-white p-3 text-center z-10 shadow-lg rounded-md m-2">
          {error}
          <button 
            onClick={() => {
              setError(null);
              setRetryCount(0);
              setContextLost(false);
              
              // Forzar una recarga del canvas
              const timer = setTimeout(() => {
                setIsLoading(true);
                setTimeout(() => setIsLoading(false), 100);
              }, 100);
              
              return () => clearTimeout(timer);
            }}
            className="ml-2 text-white/80 hover:text-white underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {contextLost && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500/90 backdrop-blur-sm text-white p-3 text-center z-10 shadow-lg rounded-md m-2">
          WebGL context lost. {retryCount < maxRetries ? `Attempting to recover (${retryCount + 1}/${maxRetries})...` : 'Please refresh the page.'}
          {retryCount >= maxRetries && (
            <button 
              onClick={() => window.location.reload()}
              className="ml-2 text-white/80 hover:text-white underline"
            >
              Refresh Now
            </button>
          )}
        </div>
      )}
      
      <ErrorBoundary onError={handleError}>
        <Canvas 
          camera={{ position: [0, 0, 5], fov: 50 }}
          gl={{ 
            antialias: false, // Desactivar antialiasing para mejor rendimiento
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: "default", // En lugar de high-performance para reducir carga
            failIfMajorPerformanceCaveat: false,
            depth: true,
            stencil: false, // No necesitamos stencil buffer
            premultipliedAlpha: false
          }}
          // Reducir la sobrecarga en el sistema con calidad dinámica
          dpr={renderQuality} 
          performance={{ min: 0.5 }}
          frameloop={contextLost ? 'never' : 'demand'} // Solo renderizar cuando sea necesario
          onCreated={({ gl, scene, camera }) => {
            // Guardar referencias
            rendererRef.current = gl;
            canvasRef.current = gl.domElement;
            
            // Configuraciones para mejor rendimiento
            gl.setClearColor(0x000000, 0);
            gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            gl.info.autoReset = false;
            
            // Desactivar algunas características para mejorar rendimiento
            gl.shadowMap.enabled = false;
            
            // Configurar manejo de memoria
            const disposeUnusedObjects = () => {
              try {
                scene.traverse(object => {
                  if ((object as THREE.Mesh).isMesh) {
                    const mesh = object as THREE.Mesh;
                    if (!mesh.visible && mesh.parent === null) {
                      if (mesh.geometry) {
                        mesh.geometry.dispose();
                      }
                      if (mesh.material) {
                        const materials = Array.isArray(mesh.material) 
                          ? mesh.material 
                          : [mesh.material];
                        materials.forEach(material => material.dispose());
                      }
                    }
                  }
                });
                gl.info.reset();
              } catch (e) {
                console.error('Error disposing objects:', e);
              }
            };
            
            // Programar limpieza periódica
            const intervalId = window.setInterval(disposeUnusedObjects, 30000);
            
            console.log('Canvas created with WebGL context:', gl);
            
            // Manejar pérdida y restauración de contexto
            const canvas = gl.domElement;
            canvas.addEventListener('webglcontextlost', handleContextLost, false);
            canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

            return () => {
              window.clearInterval(intervalId);
              canvas.removeEventListener('webglcontextlost', handleContextLost);
              canvas.removeEventListener('webglcontextrestored', handleContextRestored);
              gl.dispose(); // Importante: limpiar todos los recursos
            };
          }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />
          
          <Suspense fallback={<ThreeLoadingSpinner />}>
            {isGenerating || isLoading ? (
              <ThreeLoadingSpinner />
            ) : currentModel?.model_url && !fallbackToDefault && !contextLost ? (
              <ModelViewer
                url={currentModel.model_url}
                transform={modelTransform}
                onError={handleError}
                onLoadingChange={handleLoadingChange}
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
            enableDamping={false} // Desactivar damping para mejor rendimiento
          />
          
          <PerformanceMonitor />
        </Canvas>
      </ErrorBoundary>
      {(isGenerating || !currentModel?.model_url) && <DOMLoadingSpinner />}
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