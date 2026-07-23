"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Eraser, Pen, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  onSign?: (data: { type: "draw" | "type"; value: string }) => void;
  className?: string;
}

export function SignaturePad({ onSign, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const [mode, setMode] = useState<"draw" | "type">("draw");

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#0d9488";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    initCanvas();
    window.addEventListener("resize", initCanvas);
    return () => window.removeEventListener("resize", initCanvas);
  }, [initCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext("2d");
    const pos = getPos(e);
    ctx?.beginPath();
    ctx?.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    const pos = getPos(e);
    ctx?.lineTo(pos.x, pos.y);
    ctx?.stroke();
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleApply = () => {
    if (mode === "draw" && canvasRef.current) {
      onSign?.({ type: "draw", value: canvasRef.current.toDataURL() });
    } else if (mode === "type" && typedSignature) {
      onSign?.({ type: "type", value: typedSignature });
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <Tabs value={mode} onValueChange={(v) => setMode(v as "draw" | "type")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="draw"><Pen className="h-4 w-4 mr-1" /> Draw</TabsTrigger>
          <TabsTrigger value="type"><Type className="h-4 w-4 mr-1" /> Type</TabsTrigger>
        </TabsList>
        <TabsContent value="draw" className="mt-4">
          <div className="relative rounded-lg border-2 border-dashed border-border bg-muted/30">
            <canvas
              ref={canvasRef}
              className="w-full h-40 cursor-crosshair touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={clearCanvas}>
              <Eraser className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Draw your signature above</p>
        </TabsContent>
        <TabsContent value="type" className="mt-4">
          <Input
            placeholder="Type your full name"
            value={typedSignature}
            onChange={(e) => setTypedSignature(e.target.value)}
            className="text-2xl font-display h-16 text-center"
          />
          {typedSignature && (
            <p className="mt-4 text-center font-display text-3xl italic text-primary">{typedSignature}</p>
          )}
        </TabsContent>
      </Tabs>
      <Button onClick={handleApply} className="w-full">Apply Signature</Button>
    </div>
  );
}
