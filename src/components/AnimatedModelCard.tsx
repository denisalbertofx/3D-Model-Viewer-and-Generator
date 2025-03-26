import { Model } from "@/lib/store";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Download, Eye, Trash } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { Button } from "./ui/button";

interface AnimatedModelCardProps {
  model: Model;
  onSelect: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

export function AnimatedModelCard({
  model,
  onSelect,
  onDownload,
  onDelete,
}: AnimatedModelCardProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      whileHover={{ scale: 1.02 }}
      className="bg-card rounded-lg overflow-hidden shadow-md border"
    >
      <div className="relative aspect-square bg-primary/5">
        {model.model_url ? (
          <div className="w-full h-full flex items-center justify-center">
            {/* Model thumbnail or placeholder */}
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No preview available</p>
          </div>
        )}
        
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4"
        >
          <Button variant="outline" size="sm" onClick={onSelect} className="mr-2">
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-medium text-sm line-clamp-1">
            {model.prompt.length > 40
              ? `${model.prompt.substring(0, 40)}...`
              : model.prompt}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 -mt-1 -mr-2 h-8 w-8 p-0"
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Created {formatDistanceToNow(new Date(model.created_at), { addSuffix: true })}
        </p>
      </div>
    </motion.div>
  );
}