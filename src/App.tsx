import React from 'react';
import { useState, useEffect } from 'react';
import { ThreeScene } from './components/scene/ThreeScene';
import { ModelEditor, ModelTransform } from './components/scene/ModelEditor';
import { Button } from './components/ui/button';
import { AuthModal } from './components/auth/AuthModal';
import { ProfileSettings } from './components/user/ProfileSettings';
import { Cuboid as Cube, Sparkles, RotateCcw, Download, User, Moon, Sun } from 'lucide-react';
import { useStore } from './lib/store';
import { supabase } from './lib/supabase';
import { ModeToggle } from './components/ModeToggle';
import { AnimatedModeToggle } from './components/ModeToggle';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from './hooks/use-toast';

function App() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [modelTransform, setModelTransform] = useState<ModelTransform>({
    scale: 1,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    color: '#ffffff',
    wireframe: false
  });
  
  const { 
    user, 
    profile, 
    signOut, 
    generateModel, 
    isGenerating, 
    loadProfile, 
    models, 
    currentModel, 
    setCurrentModel, 
    loadSubscriptionTiers,
    downloadModel,
    loadModels
  } = useStore();
  
  const { toast } = useToast();

  // Efecto para la inicialización inicial
  useEffect(() => {
    const initializeApp = async () => {
      if (sessionChecked) return;

      try {
        console.log("Verificando sesión inicial...");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error al verificar sesión:', sessionError);
          toast({
            title: "Error de sesión",
            description: "No se pudo verificar tu sesión.",
            variant: "destructive",
          });
          setSessionChecked(true);
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          console.log("Sesión encontrada, inicializando datos...");
          useStore.getState().setUser(session.user);
          await Promise.all([
            loadProfile(),
            loadModels(),
            loadSubscriptionTiers()
          ]);
          console.log("Datos inicializados correctamente");
        } else {
          console.log("No hay sesión activa");
        }
      } catch (error) {
        console.error('Error en la inicialización:', error);
      } finally {
        setSessionChecked(true);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Efecto separado para manejar cambios de autenticación
  useEffect(() => {
    if (!sessionChecked) return;

    let isSubscribed = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isSubscribed) return;
      console.log("Cambio de estado de autenticación:", event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log("Usuario inició sesión, cargando datos...");
        setIsLoading(true);
        try {
          useStore.getState().setUser(session.user);
          await Promise.all([
            loadProfile(),
            loadModels(),
            loadSubscriptionTiers()
          ]);
          console.log("Datos cargados correctamente después del inicio de sesión");
        } catch (error) {
          console.error('Error al cargar datos:', error);
          toast({
            title: "Error",
            description: "No se pudieron cargar los datos del usuario.",
            variant: "destructive",
          });
        } finally {
          if (isSubscribed) {
            setIsLoading(false);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log("Usuario cerró sesión, limpiando datos...");
        useStore.getState().setUser(null);
        useStore.getState().setProfile(null);
        useStore.getState().setModels([]);
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      console.log("Limpiando suscripción de autenticación");
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, [sessionChecked]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt vacío",
        description: "Por favor, ingresa un texto para generar el modelo.",
        variant: "destructive",
      });
      return;
    }

    if (!profile) {
      toast({
        title: "Error de perfil",
        description: "No se encontró tu perfil. Por favor, recarga la página.",
        variant: "destructive",
      });
      return;
    }

    if (profile.credits < 1) {
      toast({
        title: "Sin créditos",
        description: "No tienes suficientes créditos. Por favor, actualiza tu plan.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Iniciando generación con prompt:", prompt);
      await generateModel(prompt);
      setPrompt(''); // Clear prompt after successful generation
      toast({
        title: "Modelo generado",
        description: "Tu modelo 3D ha sido generado exitosamente.",
      });
    } catch (error) {
      console.error('Error en la generación:', error);
      toast({
        title: "Error en la generación",
        description: error instanceof Error ? error.message : "Ocurrió un error al generar el modelo",
        variant: "destructive",
      });
    }
  };
  
  const handleExport = async (format: string) => {
    if (!currentModel) return;
    
    try {
      // Check if the user has access to this format based on subscription
      if (profile?.subscription_tier === 'free' && format.toLowerCase() !== 'gltf') {
        throw new Error(`Format ${format} not available in your current plan. Please upgrade to access more formats.`);
      }
      
      const downloadUrl = await downloadModel(currentModel.id, format);
      
      // Create an anchor element to trigger the download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `model-${currentModel.id.substring(0, 8)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: `Your model has been exported in ${format.toUpperCase()} format.`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="min-h-screen bg-background text-foreground">
          <header className="border-b">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <motion.div 
                className="flex items-center space-x-2"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                <Cube className="w-8 h-8 text-primary" />
                <span className="text-xl font-bold">3D Generator</span>
              </motion.div>
              <div className="flex items-center space-x-4">
                {user && profile && (
                  <div className="text-sm text-muted-foreground">
                    Credits: <span className="font-bold">{profile.credits}</span>
                  </div>
                )}
                <AnimatedModeToggle />
                {user ? (
                  <motion.div 
                    className="flex items-center space-x-2"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                  >
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsProfileOpen(true)} 
                      className="flex items-center"
                    >
                      <User className="w-4 h-4 mr-2" />
                      {profile?.username || 'My Account'}
                    </Button>
                    <Button variant="outline" onClick={signOut}>
                      Sign Out
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                  >
                    <Button variant="outline" onClick={() => setIsAuthOpen(true)}>
                      Sign In
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </header>
          
          <main className="container mx-auto px-4 py-8">
            <motion.div 
              className="max-w-5xl mx-auto"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div className="text-center mb-8" variants={itemVariants}>
                <h1 className="text-4xl font-bold mb-4">
                  Generate Amazing 3D Objects
                  <Sparkles className="inline-block ml-2 text-yellow-500" />
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Transform your ideas into stunning 3D models with just a text prompt
                </p>
              </motion.div>
              
              <motion.div 
                className="bg-card rounded-xl shadow-md p-6 mb-8 border"
                variants={itemVariants}
              >
                <div className="mb-4">
                  <textarea
                    className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    placeholder="Describe your 3D object (e.g., 'A metallic sphere with a rough surface')"
                    disabled={isGenerating}
                  />
                </div>
                <div className="flex justify-between">
                  <div>
                    {models && models.length > 0 && (
                      <div className="flex space-x-2">
                        <select 
                          className="border rounded-md px-3 py-2 bg-background text-foreground"
                          onChange={(e) => {
                            const modelId = e.target.value;
                            const selectedModel = models.find(m => m.id === modelId);
                            if (selectedModel) {
                              setCurrentModel(selectedModel);
                            }
                          }}
                          value={currentModel?.id || ''}
                        >
                          <option value="">-- Select previous model --</option>
                          {models.map(model => (
                            <option key={model.id} value={model.id}>
                              {model.prompt.substring(0, 30)}...
                            </option>
                          ))}
                        </select>
                        {currentModel && (
                          <Button variant="outline" size="sm" onClick={() => handleExport('gltf')}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleGenerate}
                    disabled={!user || isGenerating || !prompt.trim()}
                    className="relative overflow-hidden"
                  >
                    {isGenerating ? (
                      <span className="flex items-center">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          className="mr-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </motion.div>
                        Generating...
                      </span>
                    ) : (
                      <span>Generate Model</span>
                    )}
                    
                    {!isGenerating && (
                      <motion.div
                        className="absolute inset-0 bg-primary/10"
                        initial={{ scale: 0, borderRadius: "100%" }}
                        whileHover={{ scale: 1.5, borderRadius: "100%" }}
                        transition={{ duration: 0.5 }}
                      />
                    )}
                  </Button>
                </div>
              </motion.div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <motion.div 
                  className="md:col-span-2 bg-card rounded-xl shadow-md aspect-video border"
                  variants={itemVariants}
                >
                  <ThreeScene modelTransform={modelTransform} />
                </motion.div>
                
                {currentModel && (
                  <motion.div
                    variants={itemVariants}
                    className="md:col-span-1"
                  >
                    <ModelEditor 
                      model={currentModel}
                      onTransformChange={setModelTransform}
                      onExport={handleExport}
                    />
                  </motion.div>
                )}
              </div>
              
              {/* Subscription Plans Section */}
              <motion.div 
                id="pricing" 
                className="mt-20 mb-12"
                variants={itemVariants}
              >
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
                  <p className="text-muted-foreground">
                    Select the perfect plan to unlock your creative potential
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <motion.div 
                    className="bg-card rounded-xl shadow-md p-8 border"
                    whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                  >
                    <h3 className="text-xl font-bold mb-4">Free</h3>
                    <p className="text-3xl font-bold mb-4">$0<span className="text-muted-foreground text-lg">/mo</span></p>
                    <ul className="mb-8 space-y-3">
                      <li className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>5 models per month</span>
                      </li>
                      <li className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>Basic rendering</span>
                      </li>
                      <li className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>Standard export formats</span>
                      </li>
                    </ul>
                    <Button className="w-full" onClick={() => setIsAuthOpen(true)}>Get Started</Button>
                  </motion.div>
                  
                  <motion.div 
                    className="bg-card rounded-xl shadow-lg p-8 border-2 border-primary relative"
                    initial={{ scale: 1.05, y: -8 }}
                    whileHover={{ y: -13, boxShadow: "0 15px 30px -5px rgba(0, 0, 0, 0.2)" }}
                  >
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                      Popular
                    </div>
                    <h3 className="text-xl font-bold mb-4">Pro</h3>
                    <p className="text-3xl font-bold mb-4">$9.99<span className="text-muted-foreground text-lg">/mo</span></p>
                    <ul className="mb-8 space-y-3">
                      <li className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>30 models per month</span>
                      </li>
                      <li className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>Priority rendering</span>
                      </li>
                      <li className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>All export formats</span>
                      </li>
                      <li className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>Model editing</span>
                      </li>
                    </ul>
                    <Button className="w-full" onClick={() => user ? useStore.getState().checkoutSubscription('pro') : setIsAuthOpen(true)}>
                      Upgrade to Pro
                    </Button>
                  </motion.div>
                  
                  <motion.div 
                    className="bg-card rounded-xl shadow-md p-8 border"
                    whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                  >
                    <h3 className="text-xl font-bold mb-4">Enterprise</h3>
                    <p className="text-3xl font-bold mb-4">$29.99<span className="text-muted-foreground text-lg">/mo</span></p>
                    <ul className="mb-8 space-y-3">
                      <li className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>100 models per month</span>
                      </li>
                      <li className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>Team collaboration</span>
                      </li>
                      <li className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>API access</span>
                      </li>
                      <li className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>Priority support</span>
                      </li>
                      <li className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>Custom branding</span>
                      </li>
                    </ul>
                    <Button className="w-full" onClick={() => user ? useStore.getState().checkoutSubscription('enterprise') : setIsAuthOpen(true)}>
                      Get Enterprise
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </main>
          
          <footer className="bg-card text-card-foreground dark:bg-gray-900 dark:text-gray-100 py-12 border-t">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Cube className="w-6 h-6 text-primary" />
                    <span className="text-lg font-bold">3D Generator</span>
                  </div>
                  <p className="text-muted-foreground">
                    Transform your ideas into stunning 3D models with the power of AI
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                  <ul className="space-y-2">
                    <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Home</a></li>
                    <li><a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Gallery</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a></li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Legal</h3>
                  <ul className="space-y-2">
                    <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a></li>
                    <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Cookie Policy</a></li>
                  </ul>
                </div>
              </div>
              <div className="border-t border-muted mt-8 pt-8 text-center text-muted-foreground">
                <p>&copy; {new Date().getFullYear()} 3D Generator. All rights reserved.</p>
              </div>
            </div>
          </footer>
          
          <AnimatePresence>
            {isAuthOpen && (
              <AuthModal
                isOpen={isAuthOpen}
                onClose={() => setIsAuthOpen(false)}
              />
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {isProfileOpen && (
              <motion.div 
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                >
                  <ProfileSettings onClose={() => setIsProfileOpen(false)} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default App;