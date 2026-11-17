"""
Local OCR Engine for Business Card Text Extraction.
Supports EasyOCR as the primary local neural network OCR engine.
Features:
- Multi-orientation detection & auto-rotation (0°, 90°, 180°, 270°)
- User-specified manual rotation
- High-precision token coordinate normalization
100% on-device inference using CPU/CUDA.
"""
import uuid
import re
import logging
import numpy as np
import torch
from typing import List, Tuple, Dict, Any, Optional

from app.schemas import OCRToken, BoundingBox
from app.preprocessor import ImagePreprocessor

logger = logging.getLogger(__name__)


class LocalOCRService:
    """Singleton-style OCR Engine running entirely on local CPU or GPU."""

    _instance: Optional["LocalOCRService"] = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, use_gpu: Optional[bool] = None):
        if self._initialized:
            return

        self.device = "cuda" if (use_gpu if use_gpu is not None else torch.cuda.is_available()) else "cpu"
        self.preprocessor = ImagePreprocessor()
        self.reader = None
        self.engine_name = "EasyOCR (PyTorch Local)"
        self.is_ready = False

        self._initialize_engine()
        self._initialized = True

    def _initialize_engine(self):
        """Initialize EasyOCR reader with English and common Latin scripts."""
        try:
            import easyocr
            import os
            # Set 1 thread to minimize RAM consumption under Render 512MB limit
            torch.set_num_threads(1)
            if hasattr(torch, "set_grad_enabled"):
                torch.set_grad_enabled(False)
            gpu_flag = (self.device == "cuda")
            logger.info(f"Initializing EasyOCR reader on device: {self.device} (GPU={gpu_flag})...")
            self.reader = easyocr.Reader(['en'], gpu=gpu_flag, verbose=False)
            self.is_ready = True
            logger.info("EasyOCR engine successfully initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize EasyOCR: {e}. Will attempt fallback.")
            self.is_ready = False

    def _run_easyocr_on_image(self, img_rgb: np.ndarray, width: int, height: int) -> List[OCRToken]:
        """Execute ultra-fast EasyOCR text detection and recognition optimized for low RAM (Render 512MB)."""
        # Optimal 600px canvas and batch_size 1 for low RAM environments (Render 512MB limit)
        optimal_canvas = min(600, max(width, height))
        with torch.no_grad():
            raw_results = self.reader.readtext(
                img_rgb,
                paragraph=False,
                canvas_size=optimal_canvas,
                mag_ratio=1.0,
                batch_size=1,
                width_ths=0.7,
                contrast_ths=0.05,     # Detect low-contrast and light stylish text
                adjust_contrast=0.5,   # Boost contrast on stylized cards
                text_threshold=0.50,   # Capture stylized glyphs and thin fonts
                low_text=0.28,         # Preserve cursive flourishes
                link_threshold=0.38,   # Link spaced letters in stylish typefaces
                add_margin=0.10        # Prevent ascenders and descenders from being cut off
            )

        tokens: List[OCRToken] = []
        for idx, (box, text, prob) in enumerate(raw_results):
            clean_text = str(text).strip()
            if not clean_text:
                continue

            # Filter isolated low-confidence noise tokens (e.g. background artifacts, watermark noise)
            if prob < 0.15:
                continue

            # Strip decorative symbols often misrecognized as text prefix (e.g. '~Bldg' -> 'Bldg')
            clean_text = re.sub(r"^[\s~|_*•#—–\-;,.]+", "", clean_text).strip()
            if not clean_text:
                continue

            # Normalize common OCR symbol misreads
            # Fix 1: Plus sign misrecognized as 4 in country code (+91 -> 491)
            if re.match(r"^491[\s\-]?[6-9]\d{4}", clean_text):
                clean_text = "+91" + clean_text[3:]

            # Fix 2: wWw, WwW, vvv., wwwfoodoraimpex com -> www.foodoraimpex.com
            clean_text = re.sub(r"^(?:wWw|WwW|vvv|vvvv)[\.\s]", "www.", clean_text, flags=re.IGNORECASE)
            clean_text = re.sub(r"\b(?:www|wWw|WwW|vvv)\s*([a-zA-Z0-9-]+)\s+(com|org|net|in|io|co|ai)\b", r"www.\1.\2", clean_text, flags=re.IGNORECASE)
            clean_text = re.sub(r"\b(?:www|wWw|WwW|vvv)([a-zA-Z0-9-]+)\s+(com|org|net|in|io|co|ai)\b", r"www.\1.\2", clean_text, flags=re.IGNORECASE)

            # Fix 3: Normalize emails where @ was misread as e or space before domain (e.g., 'onkar jadhav@foodora com' -> 'onkar.jadhav@foodora.com')
            clean_text = re.sub(r"([a-zA-Z0-9_+-]+)\s+([a-zA-Z0-9_+-]+)@", r"\1.\2@", clean_text)
            if re.search(r"\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\s+com\b", clean_text):
                clean_text = re.sub(r"\s+com\b", ".com", clean_text)

            pts = np.array(box, dtype=np.int32)
            px0 = int(np.min(pts[:, 0]))
            py0 = int(np.min(pts[:, 1]))
            px1 = int(np.max(pts[:, 0]))
            py1 = int(np.max(pts[:, 1]))

            px0 = max(0, min(px0, width))
            py0 = max(0, min(py0, height))
            px1 = max(0, min(px1, width))
            py1 = max(0, min(py1, height))

            norm_x0 = round(px0 / max(1, width), 4)
            norm_y0 = round(py0 / max(1, height), 4)
            norm_x1 = round(px1 / max(1, width), 4)
            norm_y1 = round(py1 / max(1, height), 4)

            polygon_list = [[int(pt[0]), int(pt[1])] for pt in pts]

            token = OCRToken(
                id=f"token-{idx + 1}",
                text=clean_text,
                confidence=round(float(prob), 4),
                bbox=BoundingBox(
                    x_min=norm_x0,
                    y_min=norm_y0,
                    x_max=norm_x1,
                    y_max=norm_y1,
                    pixel_x0=px0,
                    pixel_y0=py0,
                    pixel_x1=px1,
                    pixel_y1=py1,
                    polygon=polygon_list
                ),
                category="OTHER"
            )
            tokens.append(token)

        return tokens

    def _evaluate_token_quality(self, tokens: List[OCRToken]) -> float:
        """
        Compute entity-aware quality score based on recognizable business card
        entities, contact tokens, and coherent words, penalizing vertical/chopped fragments.
        """
        if not tokens:
            return 0.0

        import re
        score = 0.0
        email_pat = re.compile(r'[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}', re.IGNORECASE)
        url_pat = re.compile(r'(?:www\.|\.com|\.org|\.io|\.net|\.co|\.id)', re.IGNORECASE)
        phone_pat = re.compile(r'(?:tel|phone|fax|mobile|cel|\+?\d{2,4}[\s().-]*\d{3,})', re.IGNORECASE)
        biz_pat = re.compile(r'\b(?:pt|cv|inc|llc|ltd|gmbh|corp|corporation|manager|director|officer|engineer|executive|specialist|tower|jalan|street|jakarta|blok|no\.)\b', re.IGNORECASE)

        for t in tokens:
            text = t.text.strip()
            conf = t.confidence
            if conf < 0.15:
                continue

            # Heavy bonuses for recognized business card anchor entities
            if email_pat.search(text):
                score += 30.0 * conf
            if url_pat.search(text):
                score += 25.0 * conf
            if phone_pat.search(text):
                score += 25.0 * conf
            if biz_pat.search(text):
                score += 20.0 * conf

            # Coherent word length bonus
            for w in text.split():
                clean_w = re.sub(r'[^a-zA-Z0-9]', '', w)
                if len(clean_w) >= 4:
                    score += 2.0 * conf
                elif len(clean_w) >= 2:
                    score += 0.5 * conf

        return score

    def extract_from_bytes(
        self,
        image_bytes: bytes,
        rotation: int = 0
    ) -> Tuple[List[OCRToken], Dict[str, Any], np.ndarray]:
        """
        Run preprocessing followed by ultra-fast local OCR inference.
        Supports explicit rotation and single-pass auto-orientation with early exit.
        """
        if not self.is_ready or self.reader is None:
            self._initialize_engine()

        if not self.is_ready or self.reader is None:
            raise RuntimeError("Local OCR engine is not ready. Please verify installation.")

        # Inspect initial image orientation
        initial_img = self.preprocessor.load_image_from_bytes(image_bytes)
        orig_h, orig_w = initial_img.shape[:2]
        is_portrait = (orig_h > orig_w * 1.05)

        # Standard business cards: fast 1-pass execution
        if rotation != 0:
            candidate_rotations = [rotation]
        elif is_portrait:
            candidate_rotations = [270, 0]
        else:
            candidate_rotations = [0, 270]

        best_tokens: List[OCRToken] = []
        best_score = -1.0
        best_prep = None
        chosen_rotation = candidate_rotations[0]

        for cand_rot in candidate_rotations:
            cand_prep = self.preprocessor.preprocess(image_bytes, rotation=cand_rot)
            cand_tokens = self._run_easyocr_on_image(
                cand_prep["preprocessed_rgb"],
                cand_prep["width"],
                cand_prep["height"]
            )
            cand_score = self._evaluate_token_quality(cand_tokens)

            if cand_score > best_score:
                best_score = cand_score
                best_tokens = cand_tokens
                best_prep = cand_prep
                chosen_rotation = cand_rot

            # Blazing Fast Early Exit:
            # If tokens were detected and text was found, do NOT waste 30s testing other rotations!
            if len(cand_tokens) >= 2 or cand_score >= 1.0 or cand_prep.get("qr_contents"):
                break

        tokens = best_tokens
        prep_result = best_prep or self.preprocessor.preprocess(image_bytes, rotation=chosen_rotation)
        img_rgb = prep_result["preprocessed_rgb"]
        width = prep_result["width"]
        height = prep_result["height"]

        # Clean up temporary prep references
        del best_prep
        import gc
        gc.collect()

        # Append decoded QR codes as high-confidence tokens so the NLP pipeline receives verified URLs/contact data
        qr_contents = prep_result.get("qr_contents", [])
        for q_idx, q_val in enumerate(qr_contents):
            q_clean = str(q_val).strip()
            if q_clean and not any(t.text.lower() == q_clean.lower() for t in tokens):
                qr_token = OCRToken(
                    id=f"token-qr-{q_idx + 1}",
                    text=q_clean,
                    confidence=1.0,
                    bbox=BoundingBox(
                        x_min=0.3, y_min=0.1, x_max=0.7, y_max=0.5,
                        pixel_x0=int(width * 0.3), pixel_y0=int(height * 0.1),
                        pixel_x1=int(width * 0.7), pixel_y1=int(height * 0.5),
                        polygon=[[int(width * 0.3), int(height * 0.1)], [int(width * 0.7), int(height * 0.1)],
                                 [int(width * 0.7), int(height * 0.5)], [int(width * 0.3), int(height * 0.5)]]
                    ),
                    category="WEBSITE" if ("http" in q_clean.lower() or "www" in q_clean.lower()) else "OTHER"
                )
                tokens.append(qr_token)

        metadata = {
            "width": width,
            "height": height,
            "deskew_angle": prep_result["deskew_angle"],
            "scale_factor": prep_result["scale_factor"],
            "rotation_applied": chosen_rotation,
            "token_count": len(tokens),
            "qr_detected": bool(qr_contents)
        }

        return tokens, metadata, img_rgb


# Global singleton instance accessor
_ocr_service_instance: Optional[LocalOCRService] = None


def get_ocr_service() -> LocalOCRService:
    global _ocr_service_instance
    if _ocr_service_instance is None:
        _ocr_service_instance = LocalOCRService()
    return _ocr_service_instance
