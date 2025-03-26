import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Save, User, CreditCard, History, Eye, Download } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface ProfileSettingsProps {
  onClose: () => void;
}

export function ProfileSettings({ onClose }: ProfileSettingsProps) {
  const { user, profile, updateProfile, loadProfile } = useStore();
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [activeTab, setActiveTab] = useState('profile');

  const { 
    loadModels, 
    models, 
    setCurrentModel, 
    downloadModel 
  } = useStore();

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setAvatarUrl(profile.avatar_url || '');
    }
    loadModels();
  }, [profile, loadModels]);

  const handleViewModel = (model) => {
    setCurrentModel(model);
    onClose();
  };

  const handleDownload = async (model) => {
    try {
      const downloadUrl = await downloadModel(model.id, 'gltf');
      if (!downloadUrl) {
        throw new Error('No se pudo obtener la URL de descarga');
      }

      // Crear un elemento temporal para la descarga
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `modelo-${model.id.substring(0, 8)}.gltf`;
      
      // Agregar el elemento al DOM
      document.body.appendChild(a);
      
      // Simular el clic
      a.click();
      
      // Limpiar
      document.body.removeChild(a);
      
      // Mostrar mensaje de éxito
      toast({
        title: "Descarga iniciada",
        description: "El modelo se está descargando en formato GLTF.",
      });
    } catch (error) {
      console.error('Error en la descarga:', error);
      toast({
        title: "Error en la descarga",
        description: error instanceof Error ? error.message : "No se pudo descargar el modelo",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ text: '', type: '' });

    try {
      await updateProfile({
        username,
        avatar_url: avatarUrl,
      });
      
      await loadProfile();
      setMessage({ text: 'Profile updated successfully', type: 'success' });
    } catch (error) {
      console.error('Failed to update profile:', error);
      setMessage({ 
        text: error instanceof Error ? error.message : 'Failed to update profile', 
        type: 'error' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user || !profile) return null;
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Account Settings</h2>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      
      <div className="mb-6">
        <div className="flex space-x-2 border-b">
          <button
            className={`px-4 py-2 ${activeTab === 'profile' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('profile')}
          >
            <User className="w-4 h-4 inline mr-2" />
            Profile
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'subscription' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('subscription')}
          >
            <CreditCard className="w-4 h-4 inline mr-2" />
            Subscription
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'history' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('history')}
          >
            <History className="w-4 h-4 inline mr-2" />
            Model History
          </button>
        </div>
      </div>
      
      {message.text && (
        <div className={`p-3 mb-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}
      
      {activeTab === 'profile' && (
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full p-2 border rounded-md bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Email cannot be changed
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-2 border rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Avatar URL
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
            
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
                {!isSaving && <Save className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </div>
        </form>
      )}
      
      {activeTab === 'subscription' && (
        <div>
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Current Plan</h3>
              <span className="capitalize text-sm px-2 py-1 rounded bg-indigo-100 text-indigo-800">
                {profile.subscription_tier || 'Free'}
              </span>
            </div>
            <div className="text-sm text-gray-600 mb-3">
              {profile.subscription_status === 'active' ? (
                <p>Your subscription is active until {profile.subscription_end_date ? new Date(profile.subscription_end_date).toLocaleDateString() : 'N/A'}</p>
              ) : (
                <p>You are currently on the free plan</p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="block font-semibold">Available Credits</span>
                <span className="text-2xl font-bold">{profile.credits}</span>
              </div>
              <Button onClick={() => window.location.href = '#pricing'}>
                {profile.subscription_tier === 'free' ? 'Upgrade Plan' : 'Manage Subscription'}
              </Button>
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="font-medium mb-4">Available Plans</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SubscriptionCard 
                name="Free" 
                price={0} 
                features={["5 models per month", "Basic rendering", "Standard export formats"]}
                isCurrentPlan={profile.subscription_tier === 'free'}
              />
              <SubscriptionCard 
                name="Pro" 
                price={9.99} 
                features={["30 models per month", "Priority rendering", "All export formats", "Model editing"]}
                isCurrentPlan={profile.subscription_tier === 'pro'}
                highlighted
              />
              <SubscriptionCard 
                name="Enterprise" 
                price={29.99} 
                features={["100 models per month", "Team collaboration", "API access", "Custom branding", "Priority support"]}
                isCurrentPlan={profile.subscription_tier === 'enterprise'}
              />
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'history' && (
        <ModelHistory 
          models={models} 
          onViewModel={handleViewModel} 
          onDownloadModel={handleDownload}
        />
      )}
    </div>
  );
}

interface SubscriptionCardProps {
  name: string;
  price: number;
  features: string[];
  isCurrentPlan?: boolean;
  highlighted?: boolean;
}

function SubscriptionCard({ name, price, features, isCurrentPlan, highlighted }: SubscriptionCardProps) {
  const { checkoutSubscription } = useStore();
  
  const handleSubscribe = async () => {
    try {
      const url = await checkoutSubscription(name.toLowerCase());
      window.location.href = url;
    } catch (error) {
      console.error('Checkout failed:', error);
    }
  };
  
  return (
    <div className={`border rounded-lg p-4 ${highlighted ? 'border-indigo-500 shadow-md' : ''}`}>
      <div className="text-center mb-4">
        <h4 className="text-xl font-bold">{name}</h4>
        <div className="my-2">
          <span className="text-3xl font-bold">${price}</span>
          <span className="text-gray-500">/month</span>
        </div>
      </div>
      
      <ul className="mb-4 space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>
      
      <div className="text-center">
        <Button 
          variant={isCurrentPlan ? "outline" : "default"}
          disabled={isCurrentPlan}
          className="w-full"
          onClick={handleSubscribe}
        >
          {isCurrentPlan ? 'Current Plan' : 'Subscribe'}
        </Button>
      </div>
    </div>
  );
}

interface ModelHistoryProps {
  models: any[];
  onViewModel: (model: any) => void;
  onDownloadModel: (model: any) => void;
}

function ModelHistory({ models, onViewModel, onDownloadModel }: ModelHistoryProps) {
  if (!models || models.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">You haven't generated any models yet.</p>
      </div>
    );
  }
  
  return (
    <div>
      <h3 className="font-medium mb-4">Your Generated Models</h3>
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Prompt</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 text-right text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {models.map((model) => (
              <tr key={model.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                  <div className="font-medium text-gray-900">{model.prompt.substring(0, 50)}{model.prompt.length > 50 ? '...' : ''}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {new Date(model.created_at).toLocaleDateString()}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm space-x-2">
                  <Button variant="outline" size="sm" onClick={() => onViewModel(model)}><Eye className="w-4 h-4 mr-1" />View</Button>
                  <Button variant="outline" size="sm" onClick={() => onDownloadModel(model)}><Download className="w-4 h-4 mr-1" />Download</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}