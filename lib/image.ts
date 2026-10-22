export interface ResizedPhoto {
  data: string;
  type: string;
  preview: string;
}

// Downscales a photo client-side so uploads stay small and fast on rural connections.
// maxDimension defaults to 1024 (soil photos); builder screenshots pass 1200
// since UI detail benefits from a bit more resolution.
export function readPhoto(file: File, maxDimension = 1024): Promise<ResizedPhoto> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      URL.revokeObjectURL(url);
      resolve({ data: dataUrl.split(",")[1], type: "image/jpeg", preview: dataUrl });
    };
    img.onerror = reject;
    img.src = url;
  });
}

// For non-image uploads (PDFs) headed to Claude as native document blocks —
// no resizing possible, just base64-encode as-is.
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
