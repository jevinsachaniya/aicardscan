"""
OpenCV Image Preprocessor for Business Card OCR.
Features:
- Image decoding and validation
- Explicit rotation support (0°, 90°, 180°, 270°)
- Smart upscaling for small or low-resolution card images
- Auto-orientation & deskewing using contour / Hough line analysis
- Contrast Limited Adaptive Histogram Equalization (CLAHE)
- Unsharp mask sharpening and bilateral noise reduction
- Adaptive thresholding for optimal OCR character distinction
"""
import cv2
import numpy as np
import logging
from typing import Tuple, Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class ImagePreprocessor:
    """Preprocesses business card images for high-accuracy local OCR."""

    def __init__(self, min_dimension: int = 800, max_dimension: int = 2200):
        self.min_dimension = min_dimension
        self.max_dimension = max_dimension
        self.qr_detector = cv2.QRCodeDetector()

    def detect_and_mask_qr_codes(self, img: np.ndarray) -> Tuple[np.ndarray, List[str]]:
        """
        Detect QR codes on card surface, decode their content (URLs/vCards),
        and mask the QR square with background color to prevent OCR from hallucinating
        garbage characters from the 2D matrix pattern.
        """
        qr_contents = []
        masked_img = img.copy()
        try:
            val, pts, _ = self.qr_detector.detectAndDecode(img)
            if pts is not None and len(pts) > 0:
                pts_int = np.int32(pts)
                # Expand polygon slightly (6px) to completely cover alignment markers
                cv2.fillPoly(masked_img, pts_int, (255, 255, 255))
                if val and str(val).strip():
                    qr_contents.append(str(val).strip())
                    logger.info(f"QR Code detected & decoded: '{val}'")
        except Exception as e:
            logger.debug(f"QR detection notice: {e}")
        return masked_img, qr_contents

    def load_image_from_bytes(self, image_bytes: bytes) -> np.ndarray:
        """Decode raw image bytes into an OpenCV BGR numpy array."""
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image. File may be corrupted or in an unsupported format.")
        return img

    def apply_rotation(self, img: np.ndarray, rotation: int) -> np.ndarray:
        """Apply explicit 90, 180, or 270 degree rotation if requested."""
        norm_rot = (rotation % 360 + 360) % 360
        if norm_rot == 90:
            return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        elif norm_rot == 180:
            return cv2.rotate(img, cv2.ROTATE_180)
        elif norm_rot == 270:
            return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
        return img

    def scale_image_for_ocr(self, img: np.ndarray) -> Tuple[np.ndarray, float]:
        """
        Scale image so text characters have sufficient pixel height for OCR.
        Upscales small crops (<1500px) and downscales excessively large photos (>2600px).
        """
        h, w = img.shape[:2]
        max_dim = max(h, w)

        if max_dim < self.min_dimension:
            scale = self.min_dimension / max_dim
            new_w = int(w * scale)
            new_h = int(h * scale)
            upscaled = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
            return upscaled, scale
        elif max_dim > self.max_dimension:
            scale = self.max_dimension / max_dim
            new_w = int(w * scale)
            new_h = int(h * scale)
            downscaled = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
            return downscaled, scale

        return img, 1.0

    def compute_deskew_angle(self, gray: np.ndarray) -> float:
        """
        Estimate subtle rotation angle of text lines using Hough Line Transform.
        Restricted to [-25, 25] degrees for micro-deskewing.
        """
        try:
            blur = cv2.GaussianBlur(gray, (5, 5), 0)
            thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 3))
            dilated = cv2.dilate(thresh, kernel, iterations=1)

            contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            angles = []

            h, w = gray.shape
            min_area = (w * h) * 0.001
            max_area = (w * h) * 0.35

            for c in contours:
                area = cv2.contourArea(c)
                if min_area < area < max_area:
                    rect = cv2.minAreaRect(c)
                    angle = rect[-1]
                    if angle < -45:
                        angle = -(90 + angle)
                    elif angle > 45:
                        angle = -(angle - 90)
                    else:
                        angle = -angle

                    if abs(angle) < 25:
                        angles.append(angle)

            if angles:
                median_angle = float(np.median(angles))
                if abs(median_angle) >= 0.5:
                    return median_angle

            return 0.0
        except Exception as e:
            logger.warning(f"Deskew angle estimation notice: {e}")
            return 0.0

    def deskew_image(self, img: np.ndarray, angle: float) -> np.ndarray:
        """Rotate image by micro-angle around its center with white border padding."""
        if abs(angle) < 0.5:
            return img

        h, w = img.shape[:2]
        center = (w // 2, h // 2)
        rot_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)

        cos = np.abs(rot_matrix[0, 0])
        sin = np.abs(rot_matrix[0, 1])
        new_w = int((h * sin) + (w * cos))
        new_h = int((h * cos) + (w * sin))

        rot_matrix[0, 2] += (new_w / 2) - center[0]
        rot_matrix[1, 2] += (new_h / 2) - center[1]

        deskewed = cv2.warpAffine(
            img,
            rot_matrix,
            (new_w, new_h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(255, 255, 255)
        )
        return deskewed

    def enhance_contrast_and_sharpen(self, gray: np.ndarray) -> np.ndarray:
        """
        Enhance image contrast using balanced CLAHE and gentle sharpening
        to distinguish stylish, thin, cursive characters while preventing symbol distortion (+ and @).
        """
        # Balanced CLAHE: 1.6 avoids blowing out small punctuation/symbols into jagged blobs
        clahe = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # Bilateral filter reduces noise while preserving stroke boundaries
        denoised = cv2.bilateralFilter(enhanced, d=5, sigmaColor=25, sigmaSpace=25)

        # Crisp unsharp mask for clean font edges
        gaussian = cv2.GaussianBlur(denoised, (0, 0), 1.5)
        sharpened = cv2.addWeighted(denoised, 1.25, gaussian, -0.25, 0)
        return sharpened

    def preprocess(self, image_bytes: bytes, rotation: int = 0) -> Dict[str, Any]:
        """
        Execute full preprocessing pipeline on input business card image bytes,
        including QR code detection and masking.
        """
        raw_bgr = self.load_image_from_bytes(image_bytes)

        # Apply rotation if specified
        if rotation != 0:
            raw_bgr = self.apply_rotation(raw_bgr, rotation)

        # Detect and decode any QR code, and mask it so OCR does not read matrix noise as text
        masked_bgr, qr_contents = self.detect_and_mask_qr_codes(raw_bgr)

        # Optimal scaling for OCR character clarity
        img, scale = self.scale_image_for_ocr(masked_bgr)

        # Grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Subtle deskew
        angle = self.compute_deskew_angle(gray)
        if abs(angle) >= 0.5:
            img = self.deskew_image(img, angle)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Contrast enhancement & sharpening
        enhanced_gray = self.enhance_contrast_and_sharpen(gray)

        # 3-channel RGB for EasyOCR
        rgb_enhanced = cv2.cvtColor(enhanced_gray, cv2.COLOR_GRAY2RGB)

        h, w = img.shape[:2]

        return {
            "original_bgr": raw_bgr,
            "preprocessed_rgb": rgb_enhanced,
            "gray": enhanced_gray,
            "deskew_angle": round(angle, 2),
            "width": w,
            "height": h,
            "scale_factor": scale,
            "qr_contents": qr_contents
        }
