import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { CampaignDialogBody, CampaignDialogFooter } from "@/components/campaign-dialog";

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
    const pointerX = (event.clientX - bounds.left) * (CANVAS_SIZE / bounds.width);
    const pointerY = (event.clientY - bounds.top) * (CANVAS_SIZE / bounds.height);
    dragOffset.current = {
      x: pointerX - imagePosition.x,
      y: pointerY - imagePosition.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = (event.clientX - bounds.left) * (CANVAS_SIZE / bounds.width);
    const pointerY = (event.clientY - bounds.top) * (CANVAS_SIZE / bounds.height);
    setImagePosition({
      x: pointerX - dragOffset.current.x,
      y: pointerY - dragOffset.current.y,
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
    <>
      <CampaignDialogBody className="space-y-5">
        <p className="text-center text-sm text-[var(--wuxia-dialog-muted)]">
          Drag to position the image and use the slider to zoom.
        </p>
        <div className="flex justify-center">
          <div className="wuxia-dialog-section w-full max-w-[300px] overflow-hidden border-2">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="block h-auto w-full touch-none cursor-move bg-[var(--wuxia-dialog-field)]"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={() => setIsDragging(false)}
              onPointerCancel={() => setIsDragging(false)}
              aria-label="Portrait crop preview"
            />
            <img ref={imageRef} src={imageUrl} alt="" className="hidden" onLoad={handleImageLoad} />
          </div>
        </div>

        <div className="wuxia-dialog-section space-y-3 p-4">
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-[var(--wuxia-dialog-muted)]" />
            <Slider
              value={[zoom]}
              onValueChange={handleZoomChange}
              min={1}
              max={3}
              step={0.05}
              className="flex-1"
              aria-label="Portrait zoom"
            />
            <ZoomIn className="h-4 w-4 text-[var(--wuxia-dialog-muted)]" />
          </div>
          <div className="text-center">
            <Button
              type="button"
              onClick={() => centerImage()}
              variant="outline"
              size="sm"
              className="wuxia-secondary-action"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset Position
            </Button>
          </div>
        </div>
      </CampaignDialogBody>

      <CampaignDialogFooter>
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="wuxia-secondary-action w-full sm:w-auto"
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!imageLoaded}
          className="wuxia-primary-action w-full sm:w-auto"
        >
          <Check className="mr-2 h-4 w-4" />
          Save Portrait
        </Button>
      </CampaignDialogFooter>
    </>
  );
}
