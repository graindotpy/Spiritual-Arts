import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface ImageCropEditorProps {
  imageUrl: string;
  onSave: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
}

const CANVAS_SIZE = 300;
const CROP_SIZE = 200;
const CROP_START = (CANVAS_SIZE - CROP_SIZE) / 2;

export default function ImageCropEditor({ imageUrl, onSave, onCancel }: ImageCropEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const scale = baseScale * zoom;

  const centerImage = useCallback(
    (nextScale = scale) => {
      const image = imageRef.current;
      if (!image) return;
      setImagePosition({
        x: (CANVAS_SIZE - image.naturalWidth * nextScale) / 2,
        y: (CANVAS_SIZE - image.naturalHeight * nextScale) / 2,
      });
    },
    [scale],
  );

  useEffect(() => {
    setImageLoaded(false);
    setZoom(1);
  }, [imageUrl]);

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image) return;
    const nextBaseScale = Math.max(
      CROP_SIZE / image.naturalWidth,
      CROP_SIZE / image.naturalHeight,
    );
    setBaseScale(nextBaseScale);
    setZoom(1);
    centerImage(nextBaseScale);
    setImageLoaded(true);
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const image = imageRef.current;
    if (!canvas || !context || !image || !imageLoaded) return;

    context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    context.drawImage(
      image,
      imagePosition.x,
      imagePosition.y,
      image.naturalWidth * scale,
      image.naturalHeight * scale,
    );

    context.save();
    context.fillStyle = "rgba(0, 0, 0, 0.55)";
    context.beginPath();
    context.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    context.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    context.fill("evenodd");
    context.restore();

    context.strokeStyle = "#7c3aed";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    context.stroke();
  }, [imageLoaded, imagePosition, scale]);

  useEffect(() => drawCanvas(), [drawCanvas]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = event.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: event.clientX - bounds.left - imagePosition.x,
      y: event.clientY - bounds.top - imagePosition.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setImagePosition({
      x: event.clientX - bounds.left - dragOffset.current.x,
      y: event.clientY - bounds.top - dragOffset.current.y,
    });
  };

  const handleZoomChange = ([nextZoom]: number[]) => {
    const ratio = nextZoom / zoom;
    const center = CANVAS_SIZE / 2;
    setImagePosition((position) => ({
      x: center - (center - position.x) * ratio,
      y: center - (center - position.y) * ratio,
    }));
    setZoom(nextZoom);
  };

  const handleSave = () => {
    const image = imageRef.current;
    if (!image) return;
    const cropCanvas = document.createElement("canvas");
    const context = cropCanvas.getContext("2d");
    if (!context) return;

    cropCanvas.width = CROP_SIZE;
    cropCanvas.height = CROP_SIZE;
    context.beginPath();
    context.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    context.clip();
    context.drawImage(
      image,
      (CROP_START - imagePosition.x) / scale,
      (CROP_START - imagePosition.y) / scale,
      CROP_SIZE / scale,
      CROP_SIZE / scale,
      0,
      0,
      CROP_SIZE,
      CROP_SIZE,
    );
    cropCanvas.toBlob((blob) => blob && onSave(blob), "image/png");
  };

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        Drag to position the image and use the slider to zoom.
      </p>
      <div className="flex justify-center">
        <div className="overflow-hidden rounded-lg border-2 border-gray-200 dark:border-gray-700">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="touch-none cursor-move bg-gray-100 dark:bg-gray-800"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setIsDragging(false)}
            onPointerCancel={() => setIsDragging(false)}
            aria-label="Portrait crop preview"
          />
          <img ref={imageRef} src={imageUrl} alt="" className="hidden" onLoad={handleImageLoad} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ZoomOut className="h-4 w-4 text-gray-500" />
          <Slider
            value={[zoom]}
            onValueChange={handleZoomChange}
            min={1}
            max={3}
            step={0.05}
            className="flex-1"
            aria-label="Portrait zoom"
          />
          <ZoomIn className="h-4 w-4 text-gray-500" />
        </div>
        <div className="text-center">
          <Button onClick={() => centerImage()} variant="outline" size="sm">
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset Position
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={!imageLoaded}
          className="flex-1 bg-spiritual-600 hover:bg-spiritual-700"
        >
          <Check className="mr-2 h-4 w-4" />
          Save Portrait
        </Button>
        <Button onClick={onCancel} variant="outline" className="flex-1">
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
