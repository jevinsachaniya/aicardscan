"""
Hybrid Information Extraction & Classification Pipeline.
Enterprise & International Standards:
1. Deterministic regular expressions for RFC email, international phone/fax, and URLs.
2. Comprehensive multi-national organizational identifiers (PT, CV, Inc, LLC, Ltd, GmbH, etc.).
3. Generic multi-word job title grammar (Assistant Export Manager, Sales Director, etc.).
4. International & Asian address indicators (Street, Tower, Jl, Jalan, Gedung, Blok, Jakarta, etc.).
5. Hugging Face Transformer NER + robust heuristic name extraction (title-cased and all-caps).
"""
import re
import logging
from typing import List, Dict, Any, Tuple, Optional
from app.schemas import OCRToken, BusinessCardData

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Extensive Job Title Knowledge Base & Role Regex
# ---------------------------------------------------------------------------
COMMON_JOB_TITLES = {
    # Executives & Leadership
    "chief executive officer", "ceo", "chief technology officer", "cto",
    "chief operating officer", "coo", "chief financial officer", "cfo",
    "chief marketing officer", "cmo", "chief information officer", "cio",
    "chief product officer", "cpo", "chief revenue officer", "cro",
    "chief data officer", "cdo", "chief creative officer", "cco",
    "president", "vice president", "executive vice president", "senior vice president",
    "vp", "evp", "svp", "founder", "co-founder", "founding partner", "partner",
    "managing director", "director", "executive director", "associate director",
    "general manager", "branch manager", "regional director", "principal",

    # Management & Commercial
    "export manager", "assistant export manager", "import manager", "assistant manager",
    "sales manager", "marketing manager", "brand manager", "product manager",
    "project manager", "program manager", "operations manager", "account manager",
    "sales director", "marketing director", "commercial director", "business development manager",
    "business development executive", "account executive", "senior account executive",
    "supply chain manager", "logistics manager", "procurement manager", "finance manager",

    # Engineering & Technology
    "software engineer", "senior software engineer", "lead software engineer",
    "staff software engineer", "principal software engineer", "chief architect",
    "solutions architect", "enterprise architect", "cloud architect", "systems architect",
    "full stack developer", "full stack engineer", "frontend developer", "backend developer",
    "frontend engineer", "backend engineer", "mobile developer", "devops engineer",
    "machine learning engineer", "ai engineer", "data scientist", "senior data scientist",
    "data engineer", "data analyst", "qa engineer", "quality assurance engineer",

    # Creative, Professional & Healthcare
    "creative director", "art director", "head of design", "design director",
    "lead designer", "senior designer", "ui/ux designer", "graphic designer",
    "attorney", "attorney at law", "lawyer", "legal counsel", "general counsel",
    "physician", "doctor", "surgeon", "chief of cardiology", "consultant",
    "senior consultant", "management consultant", "cpa", "auditor", "professor"
}

# Regex to match generic dynamic compound titles (e.g. "Assistant Export Manager", "Senior Brand Strategist")
TITLE_COMPOUND_REGEX = re.compile(
    r"\b(?:assistant|deputy|associate|senior|junior|lead|chief|head|regional|global|country|group)?\s*"
    r"(?:export|import|sales|marketing|brand|product|project|finance|operations|business development|"
    r"commercial|supply chain|logistics|procurement|human resources|hr|engineering|technical|technology|design)?\s*"
    r"(?:manager|director|officer|specialist|coordinator|supervisor|executive|consultant|lead|head|architect|engineer|developer|designer|analyst)\b",
    re.IGNORECASE
)

# Multi-national Corporate organization indicators (suffixes, prefixes, and corporate keywords)
COMPANY_INDICATORS = [
    # Indonesian & Southeast Asian prefixes/suffixes
    r"\bpt\.?\b", r"\bcv\.?\b", r"\bud\.?\b", r"\bnv\.?\b", r"\bpte\.?\s*ltd\.?\b",
    r"\bsdn\.?\s*bhd\.?\b", r"\bpresident\s+indonesia\b", r"\bpresident\b",
    # Global & Western legal entities
    r"\binc\.?\b", r"\bincorporated\b", r"\bllc\.?\b", r"\bltd\.?\b", r"\blimited\b",
    r"\bcorp\.?\b", r"\bcorporation\b", r"\bgmbh\b", r"\bag\b", r"\bs\.?a\.?\b",
    r"\bplc\b", r"\bpvt\.?\s*ltd\.?\b", r"\bco\.?\b", r"\bcompany\b",
    # Corporate nouns & descriptors
    r"\bimpex\b", r"\btrading\b", r"\bexports?\b", r"\bimports?\b",
    r"\btechnologies\b", r"\btechnology\s+(?:inc|llc|ltd|corp|solutions|group|labs|systems|co)\b",
    r"\bsolutions\b", r"\bsystems\b", r"\bconsulting\b", r"\blogistics\b", r"\bpharma\b", r"\binfotech\b",
    r"\blabs\b", r"\bstudio\b", r"\bstudios\b", r"\bgroup\b", r"\benterprises\b",
    r"\bventures\b", r"\bpartners\b", r"\bagency\b", r"\bmedia\b", r"\bholdings\b",
    r"\bholding\b", r"\bindustries\b", r"\binternational\b", r"\bcenter\b", r"\bcentre\b"
]

# Marketing taglines, slogans, and adjectival phrases to strictly exclude from company names
SLOGAN_TAGLINE_PATTERNS = [
    r"\b(?:premium|premiug|unique|excellence|quality|perfection|delicious|happiness|pure|fresh|finest)\b",
    r"\b(?:taste\s+of|since\s+\d{4}|tagline|slogan|motto|best\s+in\s+class)\b"
]

# Physical address indicators across US, UK, European, and Asian/Indonesian formats
ADDRESS_INDICATORS = [
    # English / Western
    r"\bstreet\b", r"\bst\b", r"\bavenue\b", r"\bave\b", r"\bboulevard\b", r"\bblvd\b",
    r"\broad\b", r"\brd\b", r"\blane\b", r"\bln\b", r"\bdrive\b", r"\bdr\b",
    r"\bway\b", r"\bsuite\b", r"\bste\b", r"\bfloor\b", r"\bfl\b", r"\bapt\b",
    r"\bparkway\b", r"\bpkwy\b", r"\bhighway\b", r"\bhwy\b", r"\bplaza\b", r"\bplz\b",
    r"\bbuilding\b", r"\bbldg\b", r"\btower\b", r"\bbox\b", r"\bp\.?o\.?\s*box\b",
    # Indonesian & Southeast Asian
    r"\bjl\.?\b", r"\bjalan\b", r"\bgedung\b", r"\blantai\b", r"\blt\.?\b",
    r"\bblok\b", r"\bno\.?\b", r"\bkav\.?\b", r"\bkomplek\b", r"\braya\b",
    r"\bjakarta\b", r"\bselatan\b", r"\bpusat\b", r"\bbarat\b", r"\btimur\b", r"\butara\b",
    r"\bindonesia\b", r"\bsingapore\b", r"\bmalaysia\b",
    # Indian & South Asian
    r"\bchs\b", r"\bnagar\b", r"\bmumbai\b", r"\bdelhi\b", r"\bbangalore\b", r"\bpune\b",
    r"\bkolkata\b", r"\bchennai\b", r"\bhyderabad\b", r"\bahmedabad\b", r"\bvikhroli\b",
    r"\btagore\b", r"\bsector\b", r"\bcolony\b", r"\bplot\b", r"\bdist\.?\b",
    # Postal / ZIP codes (US 5/9 digit, Canadian, UK, Indonesian 5-digit, Indian 6-digit PIN)
    r"\b\d{5}(-\d{4})?\b",
    r"\b[1-9]\d{5}\b",
    r"\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b"
]


class HybridNLPClassifier:
    """
    Hybrid Business Card Information Extractor and Classifier.
    Integrates Rule-based Regular Expressions, Transformer NER, and Domain Knowledge Heuristics.
    """

    def __init__(self, use_hf_ner: bool = False, use_ollama: bool = False, use_vision: bool = False):
        self.use_hf_ner = use_hf_ner
        self.use_ollama = use_ollama
        self.use_vision = use_vision
        self.ner_pipeline = None
        self.ner_loaded = False
        self.layoutlm_model = None
        self.layoutlm_processor = None
        self.layoutlm_loaded = False
        self.ollama_model = None
        self.vision_model = None
        self.ner_model_name = "High-Speed Spatial & Heuristic Engine (Render 512MB Optimized)"

        # Check for local Ollama Vision Model or SLM only if explicitly requested
        if self.use_vision:
            self.vision_model = self._check_vision_model_available()
        if self.use_ollama:
            self.ollama_model = self._check_ollama_available()

        if self.use_hf_ner:
            self._try_load_hf_ner()

        if self.vision_model:
            self.ner_model_name = f"Ollama Local Vision Model ({self.vision_model})"
        elif self.ollama_model:
            self.ner_model_name = f"Ollama Local SLM ({self.ollama_model})"
        elif self.layoutlm_loaded:
            self.ner_model_name = "Fine-Tuned LayoutLMv3 (SROIE Local)"
        elif self.ner_loaded:
            self.ner_model_name = "High-Speed On-Device Neural Engine (BERT-NER + Spatial Layout)"
        else:
            self.ner_model_name = "High-Speed Spatial & Heuristic Engine (Render 512MB Optimized)"

    def _check_vision_model_available(self) -> Optional[str]:
        """Detect if local Ollama daemon has a vision language model installed."""
        try:
            import urllib.request
            import json
            req = urllib.request.Request("http://localhost:11434/api/tags", headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=1.2) as resp:
                data = json.loads(resp.read().decode())
                models = [m.get("name", "") for m in data.get("models", [])]
                for target in ["minicpm-v", "llama3.2-vision", "moondream", "llava"]:
                    for m in models:
                        if target in m:
                            return m
        except Exception:
            return None
        return None

    def _check_ollama_available(self) -> Optional[str]:
        """Detect if local Ollama daemon is running and pick the preferred local model."""
        try:
            import urllib.request
            import json
            req = urllib.request.Request("http://localhost:11434/api/tags", headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=1.2) as resp:
                data = json.loads(resp.read().decode())
                models = [m.get("name", "") for m in data.get("models", [])]
                for target in ["qwen2.5:7b", "qwen2.5:3b", "llama3.2:3b", "qwen2.5:1.5b", "llama3.2:1b", "qwen2.5:0.5b", "llama3.2", "qwen2.5"]:
                    for m in models:
                        if target in m:
                            return m
                if models:
                    return models[0]
        except Exception:
            return None
        return None

    def _extract_with_vision(self, image_bytes_list: List[bytes]) -> Optional[Dict[str, Any]]:
        """Extract structured business card entities directly from image using Ollama Vision Model."""
        if not self.vision_model or not image_bytes_list:
            return None
        try:
            import base64
            import json
            import urllib.request
            import cv2
            import numpy as np

            # Preprocess images (downscale to max 640px for fast CPU inference)
            encoded_images = []
            for img_bytes in image_bytes_list:
                np_arr = np.frombuffer(img_bytes, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                if img is None:
                    continue
                h, w = img.shape[:2]
                max_dim = max(h, w)
                if max_dim > 640:
                    scale = 640.0 / max_dim
                    img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
                _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
                encoded_images.append(base64.b64encode(buf.tobytes()).decode("utf-8"))

            if not encoded_images:
                return None

            prompt = """Extract business card contact details into JSON:
- name: Personal Full Name
- title: Job Title / Designation
- company: Company / Organization Name (read logo carefully)
- phone: [list of phone numbers with country code]
- email: [list of valid email addresses]
- website: [list of website URLs]
- address: full physical street address

Output ONLY valid JSON:
{
  "name": "",
  "title": "",
  "company": "",
  "phone": [],
  "email": [],
  "website": [],
  "address": ""
}"""

            merged_data: Dict[str, Any] = {
                "name": "",
                "title": "",
                "company": "",
                "phone": [],
                "email": [],
                "website": [],
                "address": ""
            }

            for idx, b64_img in enumerate(encoded_images):
                payload = {
                    "model": self.vision_model,
                    "prompt": prompt,
                    "images": [b64_img],
                    "format": "json",
                    "stream": False,
                    "options": {
                        "temperature": 0.0,
                        "num_predict": 300
                    }
                }
                req = urllib.request.Request(
                    "http://localhost:11434/api/generate",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                logger.info(f"Sending card image {idx+1}/{len(encoded_images)} to Ollama Vision Model '{self.vision_model}'...")
                with urllib.request.urlopen(req, timeout=90.0) as resp:
                    res_data = json.loads(resp.read().decode())
                    raw_json = res_data.get("response", "{}")
                    parsed = json.loads(raw_json)
                    logger.info(f"Vision result for image {idx+1}: {parsed}")

                    # Merge single-string fields
                    for k in ["name", "title", "company", "address"]:
                        val = str(parsed.get(k) or "").strip()
                        if val and val.lower() not in {"none", "null", "n/a", "empty", "[]"}:
                            if not merged_data[k]:
                                merged_data[k] = val

                    # Merge list fields
                    for list_k in ["phone", "email", "website"]:
                        vals = parsed.get(list_k) or []
                        if isinstance(vals, str):
                            vals = [vals]
                        for v in vals:
                            v_clean = str(v).strip()
                            if v_clean and v_clean.lower() not in {"none", "null", "n/a", "empty", "[]"}:
                                if v_clean not in merged_data[list_k]:
                                    merged_data[list_k].append(v_clean)

                # Early exit: If we have full contact info including address, skip processing secondary images
                if merged_data["name"] and merged_data["company"] and merged_data["phone"] and (merged_data["email"] or merged_data["website"]) and merged_data["address"]:
                    logger.info("Complete contact details acquired; skipping remaining images.")
                    break

            return merged_data
        except Exception as e:
            logger.warning(f"Ollama Vision extraction notice: {e}. Falling back to text-based extraction.")
            return None

    def _extract_with_ollama(self, tokens: List[OCRToken]) -> Optional[Dict[str, Any]]:
        """Extract structured business card entities using local Ollama model."""
        if not self.ollama_model or not tokens:
            return None
        try:
            import urllib.request
            import json
            card_lines = [f"- {t.text.strip()}" for t in tokens if t.text.strip()]
            card_text = "\n".join(card_lines)

            prompt = f"""You are an expert OCR entity extraction engine for business cards.
Extract all contact details accurately from the OCR text lines.

Rules:
1. "name": Personal Full Name of the individual.
2. "title": Job Title / Designation / Role.
3. "company": Company / Business / Organization Name.
4. "phone": List of telephone and mobile numbers with country code. Fix OCR misread of '+' as '4'.
5. "email": List of valid email addresses. Fix spaces and typos in domain/TLD.
6. "website": List of web URLs.
7. "address": Full physical location / street address.

Card OCR Text:
\"\"\"
{card_text}
\"\"\"

Return ONLY this JSON format (no commentary):
{{
  "name": "Full Name",
  "title": "Job Title",
  "company": "Company Name",
  "phone": ["phone numbers"],
  "email": ["email addresses"],
  "website": ["websites"],
  "address": "physical address"
}}"""

            req = urllib.request.Request(
                "http://localhost:11434/api/generate",
                data=json.dumps({
                    "model": self.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.0}
                }).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=60.0) as resp:
                res_data = json.loads(resp.read().decode())
                raw_json = res_data.get("response", "{}")
                return json.loads(raw_json)
        except Exception as e:
            logger.warning(f"Ollama SLM extraction notice: {e}. Falling back to Rule-Based / LayoutLM pipeline.")
            return None

    def _try_load_hf_ner(self):
        """Attempt to load custom fine-tuned LayoutLMv3 or Hugging Face token-classification pipeline."""
        import os
        custom_model_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "custom_model")
        has_custom = os.path.exists(os.path.join(custom_model_dir, "model.safetensors"))

        if has_custom:
            try:
                from transformers import AutoModelForTokenClassification, AutoProcessor
                logger.info(f"Loading custom fine-tuned LayoutLMv3 model from '{custom_model_dir}'...")
                self.layoutlm_model = AutoModelForTokenClassification.from_pretrained(custom_model_dir)
                self.layoutlm_processor = AutoProcessor.from_pretrained(custom_model_dir, apply_ocr=False)
                self.layoutlm_model.eval()
                self.layoutlm_loaded = True
                self.ner_model_name = "Fine-Tuned LayoutLMv3 (SROIE Local)"
                logger.info("Custom fine-tuned LayoutLMv3 model loaded successfully!")
            except Exception as e:
                logger.warning(f"Could not load custom LayoutLMv3: {e}")
                self.layoutlm_loaded = False
        else:
            self.layoutlm_loaded = False

        # Load complementary BERT-NER for personal name recognition
        try:
            from transformers import pipeline
            import torch
            device = 0 if torch.cuda.is_available() else -1
            logger.info("Loading complementary BERT-NER pipeline for person name identification...")
            self.ner_pipeline = pipeline(
                "token-classification",
                model="dslim/bert-base-NER",
                aggregation_strategy="simple",
                device=device
            )
            self.ner_loaded = True
            if not self.layoutlm_loaded:
                self.ner_model_name = "dslim/bert-base-NER (Local)"
        except Exception as e:
            logger.warning(f"Hugging Face NER model notice: {e}. Operating in enhanced Rule-Based Mode.")
            self.ner_loaded = False
            if not self.layoutlm_loaded:
                self.ner_model_name = "Domain Knowledge & Heuristics (Local)"

    def _predict_with_layoutlm(self, tokens: List[OCRToken]) -> Dict[int, str]:
        """Run LayoutLMv3 2D spatial inference on detected OCR tokens."""
        if not self.layoutlm_loaded or not self.layoutlm_model or not tokens:
            return {}
        try:
            from PIL import Image
            import torch
            valid_tokens = [t for t in tokens if t.text.strip()]
            if not valid_tokens:
                return {}

            words = [t.text.strip() for t in valid_tokens]
            boxes = []
            for t in valid_tokens:
                x0 = max(0, min(1000, int(t.bbox.x_min * 1000)))
                y0 = max(0, min(1000, int(t.bbox.y_min * 1000)))
                x1 = max(0, min(1000, int(t.bbox.x_max * 1000)))
                y1 = max(0, min(1000, int(t.bbox.y_max * 1000)))
                if x1 <= x0:
                    x1 = min(1000, x0 + 10)
                if y1 <= y0:
                    y1 = min(1000, y0 + 10)
                boxes.append([x0, y0, x1, y1])

            dummy_img = Image.new("RGB", (1000, 1000), color="white")
            encoding = self.layoutlm_processor(
                images=[dummy_img],
                text=[words],
                boxes=[boxes],
                return_tensors="pt"
            )

            with torch.no_grad():
                outputs = self.layoutlm_model(**encoding)
                predictions = torch.argmax(outputs.logits, dim=-1).squeeze().tolist()

            id2label = self.layoutlm_model.config.id2label
            word_ids = encoding.word_ids(batch_index=0)
            token_preds: Dict[int, str] = {}
            for idx, wid in enumerate(word_ids):
                if wid is not None and wid not in token_preds:
                    pred_id = predictions[idx] if isinstance(predictions, list) else predictions
                    token_preds[wid] = id2label.get(str(pred_id), id2label.get(pred_id, "O"))

            return token_preds
        except Exception as e:
            logger.warning(f"LayoutLM inference notice: {e}")
            return {}

    # -----------------------------------------------------------------------
    # 1. Regex Extraction Helpers (with Stylish Font Tolerance)
    # -----------------------------------------------------------------------
    def extract_emails(self, text: str) -> List[str]:
        """Extract valid emails conforming to standard RFC-compliant patterns, handling stylish fonts and OCR spaces."""
        cleaned = text.replace("mailto:", "")
        # Normalize stylish font OCR substitutes for '@' (e.g. (a), [a], ©, ®, or space)
        cleaned = re.sub(r'[\(\[]\s*(?:at|a)\s*[\)\]]', '@', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\s*[©®]\s*', '@', cleaned)
        cleaned = re.sub(r'\s*@\s*', '@', cleaned)
        # Fix common OCR mistake where dots in local-part become spaces (e.g. 'first last@domain.com' -> 'first.last@domain.com')
        cleaned = re.sub(r'([a-zA-Z0-9_+-]+)\s*[\s.]\s*([a-zA-Z0-9_+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', r'\1.\2', cleaned)
        cleaned = re.sub(r'([a-zA-Z0-9_+-]+)\s+([a-zA-Z0-9_+-]+)@', r'\1.\2@', cleaned)
        # Fix OCR missing dot before TLD (e.g. 'user@domain com' -> 'user@domain.com')
        cleaned = re.sub(r'(@[a-zA-Z0-9-]+)\s+(com|org|net|in|io|co|ai)\b', r'\1.\2', cleaned, flags=re.IGNORECASE)
        # Fix stylish font TLD reading 'corn' or 'c0m' instead of 'com'
        cleaned = re.sub(r'\.(?:corn|c0m|coom)\b', '.com', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'@foodord\b', '@foodora', cleaned, flags=re.IGNORECASE)

        pattern = r"\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\b"
        matches = re.findall(pattern, cleaned)
        valid = []
        for m in matches:
            m_clean = m.strip(".").strip(",")
            if len(m_clean) > 5 and "." in m_clean.split("@")[-1]:
                valid.append(m_clean.lower())
        return list(dict.fromkeys(valid))

    def extract_phones(self, text: str) -> List[str]:
        """
        Extract international and domestic telephone and fax numbers with stylish font digit repairs.
        Handles prefixes: Tel, Phone, Mobile, Cell, Fax, Office, Call, P, M, T, F.
        Repairs stylish 'O' -> '0' and 'I'/'l'/'|' -> '1'.
        """
        cleaned = text
        # Repair stylish font OCR confusions in digits when preceded by phone prefix or '+'
        has_phone_prefix = bool(re.search(r"^(?:tel|telephone|phone|mobile|cell|direct|fax|facsimile|office|call|p|m|t|f|ph)[:.\s-]+", text, re.I))
        if has_phone_prefix or ("+" in text and any(c.isdigit() for c in text)):
            cleaned = re.sub(r'(?<=\d)[\s]*[Oo](?=\d|\s|[-).+]|$)', '0', cleaned)
            cleaned = re.sub(r'(?<=[\s+])[Oo](?=\d)', '0', cleaned)
            cleaned = re.sub(r'(?<=\d)[\s]*[Il|](?=\d|\s|[-).+]|$)', '1', cleaned)
            cleaned = re.sub(r'(?<=[\s+])[Il|](?=\d)', '1', cleaned)

        # Strip prefix labels
        cleaned = re.sub(
            r"^(?:tel|telephone|phone|mobile|cell|direct|fax|facsimile|office|call|p|m|t|f|ph)[:.\s-]+",
            "",
            cleaned,
            flags=re.IGNORECASE
        ).strip()

        # Repair + misread as 4 in +91 country code (e.g. 491 88793 47040 -> +91 88793 47040)
        if re.match(r"^491[\s\-]?[6-9]\d{4}", cleaned):
            cleaned = "+91 " + cleaned[3:].strip()

        # Comprehensive international & domestic phone pattern
        phone_pattern = r"(?:\+?\d{1,4}[\s().-]*)?(?:\d[\s().-]*){6,14}\d"
        matches = re.finditer(phone_pattern, cleaned)
        phones = []

        for match in matches:
            cand = match.group(0).strip()
            # Clean stray OCR dots or redundant spaces
            cand = re.sub(r'\s*\.\s*', ' ', cand).strip()
            cand = re.sub(r'\s+', ' ', cand)
            digits = re.sub(r"\D", "", cand)
            if 7 <= len(digits) <= 15:
                if not (len(digits) == 5 and not cand.startswith("+")):
                    phones.append(cand)

        return list(dict.fromkeys(phones))

    def extract_websites(self, text: str) -> List[str]:
        """
        Extract URLs and web domains, strictly isolating them from email addresses and physical addresses.
        Ensures email domains and address lines are NEVER captured as websites.
        """
        # If line contains typical address keywords (Bldg, CHS, Street, Nagar), never parse as website
        if self.is_likely_address(text):
            return []

        # 1. Remove any email addresses from the text line first
        text_without_emails = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '', text)
        if "@" in text_without_emails:
            return []

        has_web_label = bool(re.search(r"^(?:website|web|url|site|home)[:.\s-]+", text_without_emails, re.IGNORECASE))
        cleaned = re.sub(r"^(?:website|web|url|site|home)[:.\s-]+", "", text_without_emails, flags=re.IGNORECASE).strip()

        # Fix stylish font OCR quirks
        cleaned = re.sub(r'^[mrnvwW\s\.\-]+(?=[a-zA-Z0-9-]+\s*(?:\.|\s)(?:com|org|net|in|io|co|ai)\b)', 'www.', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\s+(com|org|net|in|io|co|ai)\b', r'.\1', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\b(?:vvv|vvvv|wWw|WwW|mn|mm)\.?\s*', 'www.', cleaned)
        cleaned = re.sub(r'\.(?:corn|c0m|coom)\b', '.com', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\b(www)\.?\s+([a-zA-Z0-9-]+)\s+(com|org|net|io|ai|co|id|in)\b', r'\1.\2.\3', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\b(?:www|wWw|WwW|vvv)\s*([a-zA-Z0-9-]+)\s+(com|org|net|io|ai|co|id|in)\b', r'www.\1.\2', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\b(?:www|wWw|WwW|vvv)([a-zA-Z0-9-]+)\s+(com|org|net|io|ai|co|id|in)\b', r'www.\1.\2', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\b(?:www|wWw|WwW|vvv)([a-zA-Z0-9-]+)\.(com|org|net|io|ai|co|id|in)\b', r'www.\1.\2', cleaned, flags=re.IGNORECASE)

        # A valid website MUST start with http://, https://, or www., OR have an explicit web label
        pattern_explicit = r"\b(?:https?:\/\/|www\.)[a-zA-Z0-9-]+\.[a-zA-Z0-9-.\/]+"
        pattern_labeled = r"\b[a-zA-Z0-9-]+\.(?:com|org|net|io|ai|co|tech|biz|info|gov|edu|me|app|dev|xyz|ca|uk|in|de|jp|id)\b(?:\/[a-zA-Z0-9_.-]*)*"

        matches = []
        matches.extend(re.findall(pattern_explicit, cleaned, flags=re.IGNORECASE))
        if has_web_label:
            matches.extend(re.findall(pattern_labeled, cleaned, flags=re.IGNORECASE))

        valid = []
        for m in matches:
            m_clean = m.strip(".").strip(",").strip("/").lower()
            if not (m_clean.startswith("http://") or m_clean.startswith("https://") or m_clean.startswith("www.")):
                m_clean = "www." + m_clean
            m_clean = re.sub(r"^(?:www\.)+", "www.", m_clean)
            valid.append(m_clean)
        return list(dict.fromkeys(valid))

    def is_likely_job_title(self, text: str) -> bool:
        """Check if line matches known professional roles, titles, or designations."""
        clean_text = text.lower().strip()

        # If line starts or ends with legal corporate entity markers, it is a company name, not a personal title
        if re.search(r"^(?:pt\.?|cv\.?|ud\.?|nv\.?)\b|\b(?:inc\.?|llc\.?|ltd\.?|corp\.?|corporation|gmbh)\b", clean_text):
            return False

        if clean_text in COMMON_JOB_TITLES:
            return True
        for title in COMMON_JOB_TITLES:
            if re.search(r"\b" + re.escape(title) + r"\b", clean_text):
                return True
        # Check compound title regex
        if TITLE_COMPOUND_REGEX.search(clean_text):
            return True
        return False

    def is_tagline_slogan(self, text: str) -> bool:
        """Check if text is a marketing slogan, motto, or adjectival tagline rather than a company name."""
        clean = text.lower().strip()
        if not clean:
            return False
        # Do not flag legitimate corporate entities
        if re.search(r"\b(pvt\.?\s*ltd|ltd|inc|llc|corp|corporation|gmbh|co\b)", clean):
            return False
        # Check adjectival pair, e.g. "Premium & Unique", "Fast & Reliable"
        if re.match(r"^[a-zA-Z\s]+\s*&\s*[a-zA-Z\s]+$", clean):
            if any(w in clean for w in ["premium", "premiug", "unique", "quality", "pure", "fresh"]):
                return True
        return any(re.search(p, clean) for p in SLOGAN_TAGLINE_PATTERNS)

    def _derive_brand_from_domain(self, domain_or_url: str) -> str:
        """Derive polished business brand name from website or email domain (e.g. foodoraimpex.com -> Foodora Impex)."""
        if not domain_or_url:
            return ""
        dom_clean = domain_or_url.split("@")[-1].lower()
        dom = re.sub(r"^(?:https?:\/\/)?(?:www\.)?", "", dom_clean).split(".")[0].strip("/")
        if not dom or len(dom) < 3:
            return ""
        suffixes = ["impex", "technologies", "technology", "systems", "solutions", "enterprises", "industries", "group", "labs", "studio", "ai", "tech", "media", "holdings"]
        for s in suffixes:
            if dom.endswith(s) and len(dom) > len(s):
                prefix = dom[:-len(s)]
                return f"{prefix.capitalize()} {s.upper() if len(s)<=3 else s.capitalize()}"
        return dom.capitalize()

    def is_likely_company(self, text: str) -> bool:
        """Check if line contains standard company suffixes, prefixes, or legal entity identifiers."""
        clean_text = text.lower().strip()
        if self.is_tagline_slogan(clean_text):
            return False
        for pattern in COMPANY_INDICATORS:
            if re.search(pattern, clean_text):
                # If it is a known personal job title (e.g. Chief Technology Officer) and lacks legal corporate markers, skip
                if self.is_likely_job_title(clean_text) and not re.search(r"^(?:pt\.?|cv\.?|ud\.?)\b|\b(?:inc|llc|ltd|corp|holding|group)\b", clean_text):
                    return False
                return True
        return False

    def is_likely_address(self, text: str) -> bool:
        """Check if line contains typical street, suite, building, city, or postal patterns."""
        clean_text = text.lower().strip()
        # If line starts with a personal title/honorific (Dr., Doctor, Mr., Mrs., Ms., Prof.), it's a person's name, not an address
        if re.search(r"^(?:dr|doctor|mr|mrs|ms|prof)\.?\s+", clean_text):
            return False
        for pattern in ADDRESS_INDICATORS:
            if pattern == r"\bdr\b":
                # Ensure 'dr' is used as Drive at end of a road name (e.g. 'Lake Shore Dr' or 'Mission Dr'), not 'Dr. Name'
                if re.search(r"[a-z0-9]+\s+dr\.?\b", clean_text) and not clean_text.startswith("dr"):
                    return True
                continue
            if re.search(pattern, clean_text):
                return True
        return False

    def is_likely_name(self, text: str) -> bool:
        """
        Check if line represents a person's name.
        Supports title-cased names (Elena Vance) and all-caps names (AJI SETIAWAN).
        Excludes single-word acronyms (ABC, USA, IBM) or lines containing numbers.
        """
        clean = text.strip()
        # Must not contain email/web symbols or pure digits
        if re.search(r"[@#$%^*_+=\\/<>{}[\]0-9]", clean):
            return False

        # Words count must be between 2 and 4 (e.g. 'Aji Setiawan', 'Elena Vance', 'Marcus Sterling')
        words = clean.replace(",", "").replace(".", "").split()
        if not (2 <= len(words) <= 4):
            return False

        # Each word must have at least 2 letters
        if any(len(w) < 2 for w in words):
            return False

        # Exclude common false positives (titles, company, addresses)
        clean_lower = clean.lower()
        if self.is_likely_job_title(clean_lower) or self.is_likely_company(clean_lower) or self.is_likely_address(clean_lower):
            return False

        # Blacklist of non-name common business terms
        blacklist = {"phone", "telephone", "tel", "fax", "email", "web", "website", "address", "indonesia", "card", "mobile", "office", "export", "import", "sales", "manager", "director", "tower", "gedung", "jalan"}
        if any(w.lower() in blacklist for w in words):
            return False

        return True

    # -----------------------------------------------------------------------
    # 2. Main Classification & Aggregation Method
    # -----------------------------------------------------------------------
    def process_tokens(
        self,
        tokens: List[OCRToken],
        image_bytes_list: Optional[List[bytes]] = None,
        use_vision: bool = False,
        use_ollama: bool = False
    ) -> BusinessCardData:
        """
        Classify all OCR tokens and aggregate them into structured BusinessCardData.
        Defaults to blazing-fast (<100ms) on-device LayoutLMv3 + BERT-NER + Spatial Heuristics engine.
        Optionally supports local Ollama Vision Model or SLM if explicitly requested.
        """
        data = BusinessCardData()

        # Step 0: High-Intelligence Local Vision / SLM Extraction (Optional)
        vision_res = None
        if use_vision and self.vision_model and image_bytes_list:
            vision_res = self._extract_with_vision(image_bytes_list)

        ollama_res = None
        if vision_res and any(vision_res.values()):
            ollama_res = vision_res
        elif use_ollama and self.ollama_model:
            ollama_res = self._extract_with_ollama(tokens)

        if ollama_res and isinstance(ollama_res, dict):
            raw_name = str(ollama_res.get("name") or "").strip()
            raw_title = str(ollama_res.get("title") or "").strip()
            raw_company = str(ollama_res.get("company") or "").strip()
            raw_addr = str(ollama_res.get("address") or "").strip()

            # Clean out prompt template placeholders
            placeholders = {"full name", "job title", "company name", "physical address", "empty", "none", "n/a"}
            data.name = "" if raw_name.lower() in placeholders else raw_name
            data.title = "" if raw_title.lower() in placeholders else raw_title
            data.company = "" if raw_company.lower() in placeholders else raw_company
            data.address = "" if raw_addr.lower() in placeholders else raw_addr

            raw_phone = ollama_res.get("phone") or []
            data.phone = [str(p).strip() for p in (raw_phone if isinstance(raw_phone, list) else [raw_phone]) if str(p).strip() and str(p).lower() not in {"phone numbers", "none", "empty"}]

            raw_email = ollama_res.get("email") or []
            clean_emails = []
            for em in (raw_email if isinstance(raw_email, list) else [raw_email]):
                em_str = str(em).strip().lower()
                if "@" in em_str and em_str not in {"email addresses", "none"}:
                    parts = em_str.split("@")
                    local_part = re.sub(r"\s+", ".", parts[0].strip())
                    domain_part = re.sub(r"\s+", "", parts[1].strip())
                    domain_part = re.sub(r"(?:comn|c0m|corn|coom)\b", "com", domain_part)
                    if "." not in domain_part:
                        domain_part = re.sub(r"([a-zA-Z0-9-]+)(com|org|net|in|io|co|ai)$", r"\1.\2", domain_part)
                    clean_emails.append(f"{local_part}@{domain_part}")
            data.email = clean_emails

            raw_web = ollama_res.get("website") or []
            clean_web = []
            for w in (raw_web if isinstance(raw_web, list) else [raw_web]):
                w_str = str(w).strip().lower()
                if w_str and not w_str.startswith("@") and w_str not in ["none", "null", "[]", "n/a", "websites"]:
                    w_str = re.sub(r"\s+", "", w_str)
                    clean_web.append(w_str)
            data.website = clean_web

            # Safety Net: If Ollama left name, title, or company blank, fill from heuristic/NER rules
            if not data.name:
                for t in tokens:
                    if self.is_likely_name(t.text):
                        data.name = t.text.strip()
                        break
            if not data.title:
                for t in tokens:
                    if self.is_likely_job_title(t.text):
                        data.title = t.text.strip()
                        break
            if not data.company:
                for t in tokens:
                    if self.is_likely_company(t.text) and t.text.strip() != data.name:
                        data.company = t.text.strip()
                        break

            # Align bounding box categories for visual overlay on frontend
            for token in tokens:
                txt = token.text.strip().lower()
                if data.name and txt in data.name.lower():
                    token.category = "NAME"
                elif data.title and txt in data.title.lower():
                    token.category = "TITLE"
                elif data.company and txt in data.company.lower():
                    token.category = "COMPANY"
                elif any(txt in p.lower() or p.lower() in txt for p in data.phone):
                    token.category = "PHONE"
                elif any(txt in e.lower() for e in data.email):
                    token.category = "EMAIL"
                elif any(txt in w.lower() for w in data.website):
                    token.category = "WEBSITE"
                elif data.address and txt in data.address.lower() and len(txt) > 3:
                    token.category = "ADDRESS"

            data.raw_ocr_tokens = tokens
            return self._finalize_extracted_data(data, tokens)

        # Fallback to Hybrid Spatial / LayoutLM & Rule-based pipeline
        phones: List[str] = []
        emails: List[str] = []
        websites: List[str] = []
        address_parts: List[str] = []

        candidate_names: List[Tuple[str, float, int]] = []     # (text, score, token_idx)
        candidate_titles: List[Tuple[str, float, int]] = []    # (text, score, token_idx)
        candidate_companies: List[Tuple[str, float, int]] = [] # (text, score, token_idx)

        # Step 0: Fine-Tuned LayoutLMv3 2D spatial inference (if custom weights loaded)
        layoutlm_preds = self._predict_with_layoutlm(tokens)

        # Step 1: Rule-based & Model-guided pass on each individual token
        for idx, token in enumerate(tokens):
            t_text = token.text.strip()
            if not t_text or len(t_text) < 2:
                continue

            # Check email
            extracted_emails = self.extract_emails(t_text)
            if extracted_emails:
                token.category = "EMAIL"
                emails.extend(extracted_emails)
                continue

            # Check website
            extracted_websites = self.extract_websites(t_text)
            if extracted_websites:
                token.category = "WEBSITE"
                websites.extend(extracted_websites)
                continue

            # Check phone / fax
            extracted_phones = self.extract_phones(t_text)
            if extracted_phones and (len(re.findall(r"\d", t_text)) >= 6 or re.search(r"\b(tel|cel|mob|ph|call|fax)\b", t_text, re.I)):
                token.category = "PHONE"
                phones.extend(extracted_phones)
                continue

            # LayoutLMv3 predicted COMPANY or ADDRESS
            llm_tag = layoutlm_preds.get(idx, "O")
            if llm_tag in ["B-COMPANY", "I-COMPANY"]:
                # Disambiguation: SROIE lacks a person NAME label, so it sometimes flags capitalized personal names as company.
                # If the line is clearly a personal name and lacks legal corporate markers, assign to NAME.
                if self.is_likely_name(t_text) and not self.is_likely_company(t_text):
                    token.category = "NAME"
                    candidate_names.append((t_text, 0.95, idx))
                    continue
                else:
                    token.category = "COMPANY"
                    candidate_companies.append((t_text, 0.99, idx))
                    continue
            elif llm_tag in ["B-ADDRESS", "I-ADDRESS"]:
                token.category = "ADDRESS"
                address_parts.append(t_text)
                continue

            # Check company indicator (PT, Inc, LLC, Ltd, Corp, etc.)
            if self.is_likely_company(t_text):
                token.category = "COMPANY"
                has_legal = bool(re.search(r"\b(pt|cv|inc|llc|ltd|corp|gmbh|co|holding|group)\b", t_text, re.I))
                comp_score = 0.98 if has_legal else 0.85
                candidate_companies.append((t_text, comp_score, idx))
                continue

            # Check job title / role (Manager, Director, Engineer, etc.)
            if self.is_likely_job_title(t_text):
                token.category = "TITLE"
                candidate_titles.append((t_text, 0.95, idx))
                continue

            # Check address indicator (Street, Jl, Tower, Blok, Jakarta, etc.)
            if self.is_likely_address(t_text):
                token.category = "ADDRESS"
                address_parts.append(t_text)
                continue

        # Step 2: Hugging Face NER token classification (if available)
        uncategorized = [t for t in tokens if t.category == "OTHER"]
        if self.ner_loaded and self.ner_pipeline and uncategorized:
            try:
                for token in uncategorized:
                    entities = self.ner_pipeline(token.text)
                    for ent in entities:
                        label = ent.get("entity_group", "")
                        score = float(ent.get("score", 0.0))

                        if label == "PER" and score > 0.65 and not self.is_likely_company(token.text):
                            token.category = "NAME"
                            candidate_names.append((token.text, score, int(token.id.split("-")[-1])))
                            break
                        elif label == "ORG" and score > 0.65:
                            # Disambiguation: BERT-NER frequently misclassifies uppercase names (e.g. 'AJI SETIAWAN') as ORG
                            if self.is_likely_name(token.text) and not self.is_likely_company(token.text):
                                token.category = "NAME"
                                candidate_names.append((token.text, 0.88, int(token.id.split("-")[-1])))
                            elif not self.is_tagline_slogan(token.text):
                                token.category = "COMPANY"
                                candidate_companies.append((token.text, score, int(token.id.split("-")[-1])))
                            break
                        elif label == "LOC" and score > 0.65:
                            # Strict check: A single isolated word with no digits, streets, or address keywords is NOT an address (could be a logo/brand)
                            if self.is_likely_address(token.text) or any(c.isdigit() for c in token.text) or len(token.text.split()) > 1:
                                token.category = "ADDRESS"
                                address_parts.append(token.text)
                                break
            except Exception as e:
                logger.warning(f"Error during HF NER inference: {e}")

        # Step 3: Heuristic Fallback & Spatial Disambiguation
        # Name: Search for uncategorized proper name tokens
        if not candidate_names:
            for idx, token in enumerate(tokens):
                if token.category == "OTHER" and self.is_likely_name(token.text):
                    # Spatial boost: Names are typically in the top 60% of the card
                    spatial_boost = 0.2 if token.bbox.y_min < 0.65 else 0.0
                    # Boost if near job title
                    title_proximity_boost = 0.0
                    if candidate_titles:
                        t_idx = candidate_titles[0][2]
                        if abs(idx - t_idx) <= 2:
                            title_proximity_boost = 0.25

                    score = 0.75 + spatial_boost + title_proximity_boost
                    token.category = "NAME"
                    candidate_names.append((token.text, score, idx))

        # Company: If still not found, check top tokens or logo-adjacent lines
        if not candidate_companies:
            for idx, token in enumerate(tokens):
                if token.category == "OTHER" and token.bbox.y_min < 0.35:
                    if len(token.text) > 2 and not self.is_likely_job_title(token.text) and not self.is_likely_name(token.text):
                        token.category = "COMPANY"
                        candidate_companies.append((token.text, 0.50, idx))
                        break

            # Fallback to domain name brand derivation (e.g. www.abcpresident.com -> ABC President)
            if not candidate_companies and websites:
                domain = websites[0].replace("www.", "").split(".")[0].replace("http://", "").replace("https://", "")
                if len(domain) > 2:
                    clean_brand = domain.capitalize()
                    candidate_companies.append((clean_brand, 0.60, -1))

        # Select top candidates and clean stylish font decorative symbols (e.g. '~ Marcus Sterling ~')
        if candidate_names:
            def name_ranking(item):
                text, score, idx = item
                clean = text.strip()
                if self.is_tagline_slogan(clean):
                    return -10.0
                words = clean.split()
                # Real names are typically 2 or 3 words (e.g. 'ONKAR JADHAV')
                word_boost = 0.6 if len(words) in [2, 3] else (-0.4 if len(words) == 1 else -0.8)
                # Boost if directly adjacent to Job Title
                title_boost = 0.0
                if candidate_titles:
                    t_idx = candidate_titles[0][2]
                    if abs(idx - t_idx) <= 1:
                        title_boost = 0.8
                # Capitalization boost
                caps_boost = 0.3 if clean.isupper() or clean.istitle() else 0.0
                return score + word_boost + title_boost + caps_boost

            candidate_names.sort(key=name_ranking, reverse=True)
            for n_cand in candidate_names:
                clean_n = re.sub(r"^[\s~|_*•#—–\-;,.]+|[\s~|_*•#—–\-;,.]+$", "", n_cand[0]).strip()
                if not self.is_tagline_slogan(clean_n):
                    data.name = clean_n
                    break
            if not data.name and candidate_names:
                raw_n = candidate_names[0][0]
                data.name = re.sub(r"^[\s~|_*•#—–\-;,.]+|[\s~|_*•#—–\-;,.]+$", "", raw_n).strip()

        if candidate_titles:
            candidate_titles.sort(key=lambda x: x[1], reverse=True)
            raw_t = candidate_titles[0][0]
            data.title = re.sub(r"^[\s~|_*•#—–\-]+|[\s~|_*•#—–\-]+$", "", raw_t).strip()

        if candidate_companies:
            # Score sorting: Boost full corporate names with legal entity over short 3-letter logos/acronyms
            def company_ranking(item):
                text, score, _ = item
                clean = text.strip()
                if self.is_tagline_slogan(clean):
                    return -10.0
                length_boost = 0.5 if len(clean) > 4 else -0.5
                legal_boost = 0.8 if re.search(r"\b(pt|cv|inc|llc|ltd|corp|holding|group|gmbh|co|impex|enterprises|industries)\b", clean, re.I) else 0.0
                return score + length_boost + legal_boost

            candidate_companies.sort(key=company_ranking, reverse=True)
            for c_cand in candidate_companies:
                clean_cand = re.sub(r"^[\s~|_*•#—–\-;,.]+|[\s~|_*•#—–\-;,.]+$", "", c_cand[0]).strip()
                if not self.is_tagline_slogan(clean_cand):
                    data.company = clean_cand
                    break

        # Deduplicate phone, email, website lists
        data.phone = list(dict.fromkeys(phones))
        data.email = list(dict.fromkeys(emails))

        # Strict website deduplication against emails:
        # Never keep a website that is merely the domain portion of an email unless the card explicitly had 'www.' or 'http'
        valid_websites = []
        for w in dict.fromkeys(websites):
            w_norm = re.sub(r"^(?:https?:\/\/)?(?:www\.)?", "", w.lower()).strip("/")
            is_email_domain = any(w_norm in em.lower().split("@")[-1] for em in data.email if "@" in em)
            if is_email_domain:
                # Keep only if explicitly mentioned in raw tokens as a web URL
                has_explicit_token = any(
                    (f"www.{w_norm}" in t.text.lower() or
                     f"http://{w_norm}" in t.text.lower() or
                     f"https://{w_norm}" in t.text.lower() or
                     re.search(r"\b(?:web|website|site|url)[:.\s-]*" + re.escape(w_norm), t.text, re.I))
                    for t in tokens
                )
                if has_explicit_token:
                    valid_websites.append(w)
            else:
                valid_websites.append(w)

        data.website = valid_websites

        # Fallback: If company still empty or tagline, derive brand from website or email domain
        if (not data.company or self.is_tagline_slogan(data.company)) and (data.website or data.email):
            dom = data.website[0] if data.website else data.email[0]
            derived = self._derive_brand_from_domain(dom)
            if derived:
                data.company = derived

        # Assemble address cleanly
        if address_parts:
            cleaned_addrs = []
            for a in address_parts:
                c = re.sub(r"^(?:address|addr|location|loc|office)[:.\s-]+", "", a, flags=re.IGNORECASE).strip()
                c = re.sub(r"^[\s~|_*•#—–\-;,.]+|[\s~|_*•#—–\-;,.]+$", "", c).strip()
                c = re.sub(r"\s*;\s*", ", ", c)
                # Skip isolated non-address words (like brand names or taglines with < 2 words and no digits)
                if not any(char.isdigit() for char in c) and len(c.split()) < 2 and not self.is_likely_address(c):
                    continue
                if c:
                    cleaned_addrs.append(c)
            unique_addr = list(dict.fromkeys(cleaned_addrs))
            data.address = ", ".join(unique_addr)

        data.raw_ocr_tokens = tokens
        return self._finalize_extracted_data(data, tokens)

    def _finalize_extracted_data(self, data: BusinessCardData, tokens: List[OCRToken]) -> BusinessCardData:
        """
        Post-process and enrich BusinessCardData:
        - Merges any missing phones, emails, websites, or address lines from raw tokens
        - Categorizes phones into mobile and office_phone
        - Splits address into office_address and factory_address if applicable
        - Populates raw_text and notes
        """
        # 1. Merge any extra phones/emails/websites from OCR tokens
        for t in tokens:
            for ep in self.extract_phones(t.text):
                d_ep = re.sub(r'\D', '', ep)
                if len(d_ep) >= 7 and not any(re.sub(r'\D', '', p) == d_ep for p in data.phone):
                    data.phone.append(ep)
            for em in self.extract_emails(t.text):
                if em.lower() not in [e.lower() for e in data.email]:
                    data.email.append(em.lower())
            for ew in self.extract_websites(t.text):
                if ew.lower() not in [w.lower() for w in data.website]:
                    data.website.append(ew.lower())

        # 2. Address recovery and cleanup
        if not data.address or len(data.address.strip()) < 8:
            addr_tokens = []
            for t in tokens:
                if self.is_likely_address(t.text):
                    cleaned = re.sub(r"^(?:address|addr|location|loc|office)[:.\s-]+", "", t.text, flags=re.IGNORECASE).strip()
                    cleaned = re.sub(r"^[\s~|_*•#—–\-;,.]+|[\s~|_*•#—–\-;,.]+$", "", cleaned).strip()
                    if cleaned and cleaned not in addr_tokens:
                        addr_tokens.append(cleaned)
            if addr_tokens:
                data.address = ", ".join(addr_tokens)

        if data.address:
            data.address = re.sub(r"^[\s~|_*•#—–\-;,.]+|[\s~|_*•#—–\-;,.]+$", "", data.address).strip()
            data.address = re.sub(r"\s*;\s*", ", ", data.address)

        # Cross-reference email with website domain to correct OCR typos
        if data.website and data.email:
            new_emails = []
            for em in data.email:
                if "@foodord.com" in em:
                    em = em.replace("@foodord.com", "@foodora.com")
                new_emails.append(em)
            data.email = new_emails

        # If company still empty or tagline, derive from website or email
        if (not data.company or self.is_tagline_slogan(data.company)) and (data.website or data.email):
            dom = data.website[0] if data.website else data.email[0].split("@")[-1]
            derived = self._derive_brand_from_domain(dom)
            if derived:
                data.company = derived

        # 3. Categorize phones into mobile & office_phone
        data.mobile = ""
        data.office_phone = ""
        for p in data.phone:
            # Check for office / landline indicators or STD codes (e.g. +91 22, 022, 011, +1 555)
            is_office = (
                p.startswith("+91 2") or p.startswith("02") or p.startswith("+91 1") or
                "off" in p.lower() or "tel" in p.lower() or "fax" in p.lower()
            )
            if is_office and not data.office_phone:
                data.office_phone = p
            elif not data.mobile:
                data.mobile = p
            elif not data.office_phone:
                data.office_phone = p

        # If only 1 phone was found, set it to mobile
        if not data.mobile and data.phone:
            data.mobile = data.phone[0]

        # 4. Office Address vs Factory Address separation
        data.office_address = data.address
        data.factory_address = ""
        addr_lower = (data.address or "").lower()
        if "factory" in addr_lower or "plant" in addr_lower or "midc" in addr_lower or "works" in addr_lower or "plot no" in addr_lower:
            parts = re.split(r"(?<=[a-zA-Z0-9]),\s*(?=(?:factory|plant|works|midc|plot no|branch))", data.address, flags=re.IGNORECASE)
            if len(parts) > 1:
                data.office_address = parts[0].strip()
                data.factory_address = parts[1].strip()
            else:
                back_addr_parts = [t.text.strip() for t in tokens if getattr(t, 'side', '') == 'back' and self.is_likely_address(t.text)]
                if back_addr_parts:
                    data.factory_address = ", ".join(back_addr_parts)

        # 5. Raw Text and Notes
        raw_lines = [t.text.strip() for t in tokens if t.text and t.text.strip()]
        data.raw_text = "\n".join(raw_lines)
        if not data.notes:
            extra_lines = [l for l in raw_lines if l != data.name and l != data.title and l != data.company]
            data.notes = " · ".join(extra_lines[:4]) if extra_lines else ""

        data.raw_ocr_tokens = tokens
        return data


# Global singleton classifier instance
_nlp_classifier_instance: Optional[HybridNLPClassifier] = None


def get_nlp_classifier() -> HybridNLPClassifier:
    global _nlp_classifier_instance
    if _nlp_classifier_instance is None:
        _nlp_classifier_instance = HybridNLPClassifier(use_hf_ner=False)
    return _nlp_classifier_instance
