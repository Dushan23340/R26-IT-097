"""Occlusion-handling helpers shared conceptually with train_fused_model_v3.py
(see that file for the training-side Cutout augmentation - this module only
covers the region-weighting mask, which must be applied identically at both
training and inference time or the model sees a distribution shift).

Two occlusion-handling mechanisms, per the proposal (section 3.2):
  1. Synthetic occlusion data augmentation (Cutout) - training-time only,
     see train_fused_model_v3.py's `_random_cutout`.
  2. Facial region weighting - a geometric prior that emphasizes the eye
     band (~25-42% of a face-aligned crop's height) and mouth band
     (~63-82%), the two most emotion-discriminative regions and the ones
     most likely to remain visible when something else occludes the face
     (hand over the chin, object in front of the forehead, etc). This is a
     fixed anatomical prior rather than a per-image landmark-visibility
     check - MediaPipe's FaceLandmarker doesn't expose a per-point
     occlusion/visibility score the way e.g. its Pose Landmarker does, so
     a dynamic per-image mask would require guessing at occlusion from
     indirect signals. The fixed prior still directly implements "emphasize
     visible facial areas such as the eyes and mouth" and is applied
     identically at train and inference time, so there's no distribution
     shift between the two.
"""

from __future__ import annotations

import numpy as np

IMG_SIZE = 224
_EYE_BAND_CENTER = 0.33
_MOUTH_BAND_CENTER = 0.72
_BAND_SIGMA = 0.09
_WEIGHT_FLOOR = 0.55
_WEIGHT_PEAK = 1.0


def _region_weight_mask(img_size: int = IMG_SIZE) -> np.ndarray:
    """(img_size, img_size, 1) multiplicative weight in [_WEIGHT_FLOOR, 1.0],
    row-based (constant across each image row) since eye/mouth bands run
    horizontally across a face-aligned crop. Must match the TF-native
    version in train_fused_model_v3.py's `_region_weight_mask` exactly -
    same constants, same formula."""
    y = np.linspace(0.0, 1.0, img_size, dtype="float32")
    eye_band = np.exp(-((y - _EYE_BAND_CENTER) ** 2) / (2 * _BAND_SIGMA ** 2))
    mouth_band = np.exp(-((y - _MOUTH_BAND_CENTER) ** 2) / (2 * _BAND_SIGMA ** 2))
    row_weight = np.maximum(eye_band, mouth_band)
    weight = _WEIGHT_FLOOR + (_WEIGHT_PEAK - _WEIGHT_FLOOR) * row_weight
    weight = weight.reshape(img_size, 1, 1)
    return np.tile(weight, (1, img_size, 1)).astype("float32")


REGION_WEIGHT_MASK = _region_weight_mask()


def apply_region_weighting(image: np.ndarray) -> np.ndarray:
    """image: (H, W, 3) float array in the original [0, 255] pixel range
    (call this BEFORE preprocess_input, matching the training pipeline).
    Dampens non-eye/mouth rows toward the image's own mean color (a soft
    vignette) rather than toward black, so no artificial dark band is
    introduced as a spurious feature."""
    mean_color = image.mean(axis=(0, 1), keepdims=True)
    mask = REGION_WEIGHT_MASK
    if image.shape[0] != mask.shape[0] or image.shape[1] != mask.shape[1]:
        mask = _region_weight_mask(image.shape[0])
    return image * mask + mean_color * (1.0 - mask)
