import QRCode from "qrcode";

export async function generateQrDataUrl(
  url: string,
  size = 128
): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: size,
    errorCorrectionLevel: "M",
  });
}
