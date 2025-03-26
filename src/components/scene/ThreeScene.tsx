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
  const maxRetries = 3;
  
  // Referencia para mantener el timer de reintento
  const retryTimerRef = useRef<number | null>(null);

  const handleError = useCallback((e: Error) => {
    console.error("Failed to load model:", e);
    setError(`Failed to load model: ${e.message}`);
    setFallbackToDefault(true);
    setIsLoading(false);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

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
    }
  }, [currentModel]);

  const handleContextLost = useCallback(() => {
    console.warn('WebGL context lost');
    setContextLost(true);
    
    // Limpiar cualquier temporizador anterior
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }
    
    // Intentar recuperar el contexto automáticamente después de un breve retraso
    if (retryCount < maxRetries) {
      retryTimerRef.current = window.setTimeout(() => {
        console.log(`Attempting to restore WebGL context (attempt ${retryCount + 1}/${maxRetries})`);
        setRetryCount(prev => prev + 1);
        // Forzar la recreación del canvas
        setContextLost(false);
      }, 2000);
    } else {
      setError('WebGL context could not be restored. Please refresh the page.');
    }
  }, [retryCount, maxRetries]);

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
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
            depth: true,
            stencil: true,
            premultipliedAlpha: false
          }}
          // Reducir la sobrecarga en el sistema
          dpr={[1, 1.5]} 
          performance={{ min: 0.5 }}
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
          />
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