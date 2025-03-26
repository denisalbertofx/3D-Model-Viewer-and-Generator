import { useState, useEffect, useRef, useCallback } from 'react';

interface HexColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function HexColorPicker({ color, onChange }: HexColorPickerProps) {
  const [currentColor, setCurrentColor] = useState(color || '#ffffff');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Draw color wheel on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 5;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw color wheel
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      const hue = angle;
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fill();
    }

    // Draw inner saturation/lightness square
    const squareSize = radius * 1.4;
    const squareX = centerX - squareSize / 2;
    const squareY = centerY - squareSize / 2;

    const gradientX = ctx.createLinearGradient(squareX, 0, squareX + squareSize, 0);
    gradientX.addColorStop(0, '#fff');
    gradientX.addColorStop(1, `hsl(${hexToHsl(currentColor).h}, 100%, 50%)`);
    
    ctx.fillStyle = gradientX;
    ctx.fillRect(squareX, squareY, squareSize, squareSize);

    const gradientY = ctx.createLinearGradient(0, squareY, 0, squareY + squareSize);
    gradientY.addColorStop(0, 'rgba(0,0,0,0)');
    gradientY.addColorStop(1, '#000');
    
    ctx.fillStyle = gradientY;
    ctx.fillRect(squareX, squareY, squareSize, squareSize);

    // Draw color indicator
    ctx.beginPath();
    ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
    ctx.fillStyle = currentColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [currentColor]);

  // Handle canvas click/drag
  const handleColorSelect = useCallback((e: MouseEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get pixel color at click position
    const imageData = ctx.getImageData(x, y, 1, 1).data;
    const r = imageData[0];
    const g = imageData[1];
    const b = imageData[2];
    
    // Convert to hex
    const hex = rgbToHex(r, g, b);
    setCurrentColor(hex);
    onChange(hex);
  }, [onChange]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleColorSelect(e);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      handleColorSelect(e);
    }
  }, [isDragging, handleColorSelect]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove event listeners for drag support
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="color-picker">
      <canvas 
        ref={canvasRef} 
        width={200} 
        height={200}
        onMouseDown={handleMouseDown}
        className="cursor-pointer rounded-md"
      />

      <div className="flex mt-2 items-center space-x-2">
        <div 
          className="w-8 h-8 rounded-md border border-input" 
          style={{ backgroundColor: currentColor }} 
        />
        <input
          type="text"
          value={currentColor}
          onChange={(e) => {
            setCurrentColor(e.target.value);
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
              onChange(e.target.value);
            }
          }}
          className="bg-background text-foreground text-sm px-2 py-1 rounded-md border border-input w-full"
        />
      </div>
    </div>
  );
}

// Helper color conversion functions
function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 255, g: 255, b: 255 };
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
      case gNorm: h = (bNorm - rNorm) / d + 2; break;
      case bNorm: h = (rNorm - gNorm) / d + 4; break;
    }
    h *= 60;
  }
  
  return { h, s, l };
}