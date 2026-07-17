const MAX_EDGE_PX = 2000;
const JPEG_QUALITY = 0.82;
const MAX_OUTPUT_BYTES = 900_000;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read the selected image."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

export async function compressScorecardImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Upload a valid image file.");
  }

  const image = await loadImageFromFile(file);
  const longestEdge = Math.max(image.width, image.height);
  const scale =
    longestEdge > MAX_EDGE_PX ? MAX_EDGE_PX / longestEdge : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare the image for upload.");
  }

  context.drawImage(image, 0, 0, width, height);

  let quality = JPEG_QUALITY;
  let blob = await canvasToBlob(canvas, quality);

  while (blob && blob.size > MAX_OUTPUT_BYTES && quality > 0.5) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }

  if (!blob) {
    throw new Error("Could not compress the scorecard image.");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "scorecard";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
