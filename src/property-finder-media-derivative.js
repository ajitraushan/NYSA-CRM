import path from 'node:path';

export const PROPERTY_FINDER_DERIVATIVE_CONFIRMATION = 'CREATE_PROPERTY_FINDER_MEDIA_DERIVATIVE';
export const PROPERTY_FINDER_DERIVATIVE_VERSION = 'pf-media-derivative-v1';
export const PROPERTY_FINDER_WATERMARK_STYLES = Object.freeze(['none', 'nysa_text_v1']);
export const PROPERTY_FINDER_WATERMARK_POSITIONS = Object.freeze(['bottom_right', 'bottom_left', 'top_right', 'top_left']);

const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;

export function fitPropertyFinderDimensions(width, height, maxWidth = 1920, maxHeight = 1080) {
  width = finite(width); height = finite(height);
  if (!width || !height || width < 1 || height < 1) return null;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function normalizePropertyFinderDerivativeTransform(value = {}) {
  const sourceWidth = finite(value.sourceWidth), sourceHeight = finite(value.sourceHeight), outputWidth = finite(value.outputWidth), outputHeight = finite(value.outputHeight);
  const watermarkStyle = String(value.watermarkStyle || 'none');
  const watermarkPosition = String(value.watermarkPosition || 'bottom_right');
  const watermarkOpacity = finite(value.watermarkOpacity ?? 0.32), watermarkScale = finite(value.watermarkScale ?? 0.12), jpegQuality = finite(value.jpegQuality ?? 0.9);
  if (![sourceWidth, sourceHeight, outputWidth, outputHeight].every(item => Number.isInteger(item) && item > 0)) return { error: 'Verified source and output dimensions are required' };
  const fitted = fitPropertyFinderDimensions(sourceWidth, sourceHeight);
  if (!fitted || fitted.width !== outputWidth || fitted.height !== outputHeight) return { error: 'Output dimensions must preserve the source ratio within the PF 1920 x 1080 boundary' };
  if (!PROPERTY_FINDER_WATERMARK_STYLES.includes(watermarkStyle)) return { error: 'Select an approved watermark style' };
  if (!PROPERTY_FINDER_WATERMARK_POSITIONS.includes(watermarkPosition)) return { error: 'Select an approved watermark position' };
  if (watermarkOpacity < 0.2 || watermarkOpacity > 0.6 || watermarkScale < 0.08 || watermarkScale > 0.2) return { error: 'Watermark opacity or scale is outside the governed range' };
  if (jpegQuality < 0.82 || jpegQuality > 0.94) return { error: 'JPEG quality must remain between 82% and 94%' };
  return {
    version: PROPERTY_FINDER_DERIVATIVE_VERSION,
    sourceWidth, sourceHeight, outputWidth, outputHeight,
    outputMediaType: 'image/jpeg', jpegQuality,
    watermarkStyle,
    watermarkPosition: watermarkStyle === 'none' ? null : watermarkPosition,
    watermarkOpacity: watermarkStyle === 'none' ? null : watermarkOpacity,
    watermarkScale: watermarkStyle === 'none' ? null : watermarkScale,
    originalPreserved: true,
    approvalRequired: true
  };
}

export function propertyFinderDerivativeFileName(sourceFileName) {
  const stem = path.parse(String(sourceFileName || 'property-photo')).name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 90) || 'property-photo';
  return `${stem}-pf-ready.jpg`;
}
