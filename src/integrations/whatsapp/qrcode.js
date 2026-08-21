import QRCode from "qrcode";

export async function qrStringToDataUrl(qr) {
  return QRCode.toDataURL(qr, { margin: 1, width: 280 });
}
