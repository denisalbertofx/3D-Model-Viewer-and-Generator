import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useStore();
  const { toast } = useToast();
  
  if (!isOpen) return null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      console.log("Iniciando proceso de autenticación...");
      if (isSignUp) {
        console.log("Creando nueva cuenta...");
        await signUp(email, password);
        console.log("Cuenta creada exitosamente");
        toast({
          title: "Cuenta creada",
          description: "Tu cuenta ha sido creada exitosamente. Por favor, verifica tu correo electrónico.",
        });
        onClose();
      } else {
        console.log("Iniciando sesión...");
        const result = await signIn(email, password);
        console.log("Sesión iniciada exitosamente:", result);
        
        if (result?.user) {
          toast({
            title: "Inicio de sesión exitoso",
            description: "Has iniciado sesión correctamente.",
          });
          onClose();
        } else {
          throw new Error("No se pudo iniciar sesión");
        }
      }
    } catch (err) {
      console.error('Error de autenticación:', err);
      let errorMessage = 'Ocurrió un error al autenticarte';
      
      if (err instanceof Error) {
        console.error('Detalles del error:', err.message);
        errorMessage = err.message;
      }
      
      toast({
        title: "Error de autenticación",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      console.log("Finalizando proceso de autenticación");
      setIsLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || !email || !password}
          >
            {isLoading ? (
              <span className="flex items-center">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isSignUp ? 'Creando cuenta...' : 'Iniciando sesión...'}
              </span>
            ) : (
              isSignUp ? 'Crear cuenta' : 'Iniciar sesión'
            )}
          </Button>
        </form>
        
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          {isSignUp ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            disabled={isLoading}
          >
            {isSignUp ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </p>
      </div>
    </div>
  );
}