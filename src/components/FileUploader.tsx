import { ChangeEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { uploadFile } from "@/lib/storage";
import { formatBytes } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Check, File as FileIcon } from "lucide-react";

interface FileUploaderProps {
  bucketName: string;
  path?: string;
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  onUploadComplete?: (url: string, path: string) => void;
  onUploadError?: (error: Error) => void;
}

export function FileUploader({
  bucketName,
  path = "",
  maxSize = 50 * 1024 * 1024, // 50MB default
  allowedTypes = [],
  onUploadComplete,
  onUploadError,
}: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (!selectedFile) return;
    
    // Check file size
    if (selectedFile.size > maxSize) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${formatBytes(maxSize)}`,
        variant: "destructive",
      });
      return;
    }
    
    // Check file type if allowedTypes is specified
    if (allowedTypes.length > 0) {
      const fileType = selectedFile.type;
      if (!allowedTypes.includes(fileType)) {
        toast({
          title: "Unsupported file type",
          description: `Allowed types: ${allowedTypes.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }
    
    setFile(selectedFile);
    setUploadComplete(false);
  };

  const simulateProgress = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        return prev + 5;
      });
    }, 100);
    return interval;
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    const progressInterval = simulateProgress();
    
    try {
      const { url, path: filePath } = await uploadFile(file, {
        bucketName,
        path,
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadComplete(true);
      
      onUploadComplete?.(url, filePath);
      
      toast({
        title: "Upload complete",
        description: "Your file has been uploaded successfully.",
      });
    } catch (error) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      
      const err = error instanceof Error ? error : new Error("Unknown error occurred");
      onUploadError?.(err);
      
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploadProgress(0);
    setUploadComplete(false);
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <div className="border-2 border-dashed border-primary/20 rounded-lg p-6 text-center hover:bg-primary/5 transition-colors">
          <input
            type="file"
            id="file-upload"
            className="sr-only"
            onChange={handleFileChange}
            disabled={uploading}
          />
          
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center justify-center"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Upload className="h-10 w-10 text-primary/60 mb-2" />
            </motion.div>
            
            <p className="text-sm text-muted-foreground mb-1">
              {file ? file.name : "Click to select a file or drag and drop"}
            </p>
            
            <p className="text-xs text-muted-foreground">
              {allowedTypes.length > 0 
                ? `Allowed formats: ${allowedTypes.join(", ")}` 
                : "Any file format"}
              {maxSize && ` (Max size: ${formatBytes(maxSize)})`}
            </p>
          </label>
        </div>
      </div>

      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-card rounded-lg p-4 mb-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-md">
                <FileIcon className="h-6 w-6 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              
              <button
                onClick={resetUpload}
                className="text-muted-foreground hover:text-foreground p-1 rounded-full"
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {(uploading || uploadComplete) && (
              <div className="mt-3">
                <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: "0%" }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ ease: "easeInOut" }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>
                    {uploadComplete
                      ? "Complete"
                      : uploading
                      ? "Uploading..."
                      : "Ready to upload"}
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end gap-2">
        {file && !uploadComplete && (
          <Button
            onClick={handleUpload}
            disabled={uploading || !file || uploadComplete}
            className="gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : uploadComplete ? (
              <>
                <Check className="h-4 w-4" /> 
                Complete
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> 
                Upload
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}