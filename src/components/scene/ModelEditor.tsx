import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  RotateCcw, 
  MoveHorizontal, 
  Maximize, 
  Palette, 
  RotateCw,
  ArrowDownToLine,
  Copy
} from 'lucide-react';
import { Model } from '@/lib/store';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { HexColorPicker } from '@/components/ui/color-picker';
import { motion } from 'framer-motion';

interface ModelEditorProps {
  model: Model;
  onTransformChange: (transform: ModelTransform) => void;
  onExport: (format: string) => void;
}

export interface ModelTransform {
  scale: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  color: string;
  wireframe: boolean;
}

const EXPORT_FORMATS = [
  { value: 'gltf', label: 'GLTF (.gltf)' },
  { value: 'glb', label: 'GLB (.glb)' },
  { value: 'obj', label: 'OBJ (.obj)' },
  { value: 'fbx', label: 'FBX (.fbx)' },
  { value: 'stl', label: 'STL (.stl)' },
];

export function ModelEditor({ model, onTransformChange, onExport }: ModelEditorProps) {
  const [transform, setTransform] = useState<ModelTransform>({
    scale: 1,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    color: '#ffffff',
    wireframe: false
  });
  
  const [selectedFormat, setSelectedFormat] = useState('gltf');
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  useEffect(() => {
    onTransformChange(transform);
  }, [transform, onTransformChange]);
  
  const handleReset = () => {
    setTransform({
      scale: 1,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      color: '#ffffff',
      wireframe: false
    });
  };
  
  const handleTransformChange = (property: keyof ModelTransform, value: number | string | boolean) => {
    setTransform(prev => ({
      ...prev,
      [property]: value
    }));
  };
  
  return (
    <div className="bg-card rounded-xl shadow-md p-6 border">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium">Model Editor</h3>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>
      
      <div className="space-y-6">
        {/* Scale */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center">
              <Maximize className="h-4 w-4 mr-2" />
              Scale
            </Label>
            <span className="text-sm text-muted-foreground">{transform.scale.toFixed(2)}x</span>
          </div>
          <Slider
            value={[transform.scale]}
            min={0.1}
            max={3}
            step={0.1}
            onValueChange={(value) => handleTransformChange('scale', value[0])}
          />
        </div>
        
        {/* Rotation */}
        <div className="space-y-4">
          <Label className="flex items-center">
            <RotateCw className="h-4 w-4 mr-2" />
            Rotation
          </Label>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">X-Axis</span>
              <span className="text-sm text-muted-foreground">{transform.rotationX}°</span>
            </div>
            <Slider
              value={[transform.rotationX]}
              min={0}
              max={360}
              step={1}
              onValueChange={(value) => handleTransformChange('rotationX', value[0])}
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Y-Axis</span>
              <span className="text-sm text-muted-foreground">{transform.rotationY}°</span>
            </div>
            <Slider
              value={[transform.rotationY]}
              min={0}
              max={360}
              step={1}
              onValueChange={(value) => handleTransformChange('rotationY', value[0])}
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Z-Axis</span>
              <span className="text-sm text-muted-foreground">{transform.rotationZ}°</span>
            </div>
            <Slider
              value={[transform.rotationZ]}
              min={0}
              max={360}
              step={1}
              onValueChange={(value) => handleTransformChange('rotationZ', value[0])}
            />
          </div>
        </div>
        
        {/* Material */}
        <div className="space-y-4">
          <Label className="flex items-center">
            <Palette className="h-4 w-4 mr-2" />
            Material
          </Label>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Color</span>
            <div className="relative">
              <button
                className="w-8 h-8 rounded-md border border-input"
                style={{ backgroundColor: transform.color }}
                onClick={() => setShowColorPicker(!showColorPicker)}
              />
              
              {showColorPicker && (
                <motion.div 
                  className="absolute right-0 mt-2 z-10 bg-card rounded-md shadow-lg p-2 border"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <HexColorPicker 
                    color={transform.color}
                    onChange={(color) => handleTransformChange('color', color)}
                  />
                  <div className="flex justify-between mt-2">
                    <span className="text-xs">{transform.color}</span>
                    <button 
                      className="text-xs text-blue-500"
                      onClick={() => setShowColorPicker(false)}
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="wireframe"
              checked={transform.wireframe}
              onCheckedChange={(checked) => handleTransformChange('wireframe', checked)}
            />
            <Label htmlFor="wireframe">Wireframe mode</Label>
          </div>
        </div>
        
        {/* Export */}
        <div className="space-y-4 pt-4 border-t">
          <Label className="flex items-center">
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Export
          </Label>
          
          <div className="flex items-center space-x-2">
            <Select
              value={selectedFormat}
              onValueChange={setSelectedFormat}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_FORMATS.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button onClick={() => onExport(selectedFormat)}>
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
        
        <div className="pt-4 border-t">
          <Button variant="outline" className="w-full" onClick={() => navigator.clipboard.writeText(model.prompt)}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Prompt
          </Button>
        </div>
      </div>
    </div>
  );
}