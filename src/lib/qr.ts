/* QR codes, made in the browser (no outside service). */
import { toDataURL, toString } from 'qrcode';

/* "M" = the code still scans with ~15% of it damaged or covered: good for posters. */
const OPTIONS = { errorCorrectionLevel: 'M' as const, margin: 2, color: { dark: '#000000', light: '#ffffff' } };

/** PNG picture, 1200 px wide: sharp enough to print up to ~10 cm. */
export function qrPng(text: string): Promise<string> {
  return toDataURL(text, { ...OPTIONS, width: 1200 });
}

/** SVG drawing: any size without losing quality. Best for the print shop. */
export function qrSvg(text: string): Promise<string> {
  return toString(text, { ...OPTIONS, type: 'svg' });
}

/** Saves a file to the computer's Downloads folder. */
export function download(fileName: string, data: string | Blob): void {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(url), 1000);
}
