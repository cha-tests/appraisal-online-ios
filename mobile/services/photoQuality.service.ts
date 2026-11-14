import * as ImageManipulator from 'expo-image-manipulator';
import * as base64js from 'base64-js';
import { decode as decodeJpeg } from 'jpeg-js';

/**
 * Best-effort, on-device blur/glare check for KYC photos (ID + selfie),
 * run right after capture in broker/onboarding.tsx — catches an obviously
 * bad photo immediately instead of making the broker wait for a human
 * reviewer to reject it later. It is not the real gatekeeper: the admin
 * KYC review panel (web/app/admin) is, and still makes the final call on
 * anything this check lets through.
 *
 * Pure pixel-brightness heuristics, not a trained classifier, so the two
 * checks have different reliability:
 *  - Blur (variance of the Laplacian over a downsampled grayscale grid) is
 *    robust — a blurry photo collapses this score by orders of magnitude
 *    versus a sharp one, verified against synthetic test images.
 *  - Glare (bright AND locally flat pixels — a blown-out reflection has no
 *    texture left) can't fully distinguish a reflection from a
 *    legitimately light-colored ID background or a plain white design
 *    element, which scores similarly on this metric. The threshold below
 *    is set conservatively (only flags a large, obvious blowout) to avoid
 *    blocking legitimate photos — expect to retune both thresholds once
 *    real submissions come in.
 */
export interface PhotoQualityResult {
  ok: boolean;
  reason?: 'blurry' | 'glare';
  message?: string;
}

const ANALYSIS_WIDTH = 200; // downsized before pixel analysis, to keep the JS-side decode fast
const GRID = 120;
const BLUR_VARIANCE_THRESHOLD = 300;
const GLARE_BRIGHT_LEVEL = 250;
const GLARE_FLAT_VARIANCE_THRESHOLD = 4;
const GLARE_AREA_FRACTION_THRESHOLD = 0.2;

export async function checkPhotoQuality(uri: string): Promise<PhotoQualityResult> {
  try {
    const resized = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: ANALYSIS_WIDTH } }], {
      base64: true,
      compress: 0.6,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    if (!resized.base64) {
      return { ok: true };
    }

    const bytes = base64js.toByteArray(resized.base64);
    const { width, height, data } = decodeJpeg(bytes, { useTArray: true });

    // Downsample to a fixed-size grayscale grid — keeps the thresholds
    // below meaningful regardless of the source photo's resolution.
    const gray = new Float32Array(GRID * GRID);
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const x = Math.min(width - 1, Math.floor((gx / GRID) * width));
        const y = Math.min(height - 1, Math.floor((gy / GRID) * height));
        const idx = (y * width + x) * 4;
        gray[gy * GRID + gx] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      }
    }

    let lapSum = 0;
    let lapSumSq = 0;
    let lapCount = 0;
    let glareCount = 0;

    for (let gy = 1; gy < GRID - 1; gy++) {
      for (let gx = 1; gx < GRID - 1; gx++) {
        const c = gray[gy * GRID + gx];
        const lap =
          4 * c - gray[(gy - 1) * GRID + gx] - gray[(gy + 1) * GRID + gx] - gray[gy * GRID + gx - 1] - gray[gy * GRID + gx + 1];
        lapSum += lap;
        lapSumSq += lap * lap;
        lapCount++;

        if (c >= GLARE_BRIGHT_LEVEL) {
          let sum = 0;
          const neighbors: number[] = [];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const v = gray[(gy + dy) * GRID + (gx + dx)];
              neighbors.push(v);
              sum += v;
            }
          }
          const mean = sum / neighbors.length;
          const variance = neighbors.reduce((acc, v) => acc + (v - mean) ** 2, 0) / neighbors.length;
          if (variance < GLARE_FLAT_VARIANCE_THRESHOLD) glareCount++;
        }
      }
    }

    const lapMean = lapSum / lapCount;
    const blurScore = lapSumSq / lapCount - lapMean * lapMean;

    if (blurScore < BLUR_VARIANCE_THRESHOLD) {
      return {
        ok: false,
        reason: 'blurry',
        message: 'This photo looks blurry. Please retake it somewhere well-lit and hold the camera steady.',
      };
    }

    const glareFraction = glareCount / lapCount;
    if (glareFraction >= GLARE_AREA_FRACTION_THRESHOLD) {
      return {
        ok: false,
        reason: 'glare',
        message: "There's glare or a reflection on this photo. Please retake it away from direct light or flash.",
      };
    }

    return { ok: true };
  } catch (error) {
    // Fail open — a broken quality check shouldn't block a legitimate signup.
    console.warn('Photo quality check failed, allowing photo through:', error);
    return { ok: true };
  }
}
