# CardLens AI - Local Business Card Extraction & Classification

> **100% On-Device Business Card Digitization Engine**  
> Powered by OpenCV, EasyOCR (PyTorch), Hugging Face Transformers, and FastAPI.  
> **Zero Cloud APIs**: No OpenAI, No Google Cloud Vision, No AWS Rekognition. All OCR and NLP extraction runs completely locally on CPU/GPU.

---

## 🌟 Key Features

- **100% Local Inference & Privacy-First**: All image processing, neural character recognition, and entity classification execute entirely on the host machine. No external network requests or third-party paid APIs.
- **Computer Vision Preprocessing (OpenCV)**:
  - Automatic orientation detection & deskewing ($\pm 45^\circ$)
  - Noise reduction using bilateral filtering
  - Contrast enhancement with Contrast Limited Adaptive Histogram Equalization (CLAHE)
  - Adaptive Gaussian thresholding for high OCR distinction
- **Deep Neural OCR Engine**:
  - Powered by EasyOCR with PyTorch
  - Normalized bounding box coordinates `[x0, y0, x1, y1]`
  - Confidence scores per token and polygon corner coordinates
- **Hybrid Classification Pipeline**:
  - **Deterministic Regex**: RFC 5322 compliant email detection, international & domestic phone numbers, URL and domain resolution.
  - **Transformer Token Classification**: Local Hugging Face NER pipeline (`dslim/bert-base-NER`) for names, companies, and addresses.
  - **Domain Knowledge Engine**: Fallback dictionary of 160+ executive and engineering job titles, corporate legal suffixes (Inc, LLC, Corp, Labs), and spatial heuristics.
- **Production-Grade Single Page UI**:
  - Modern glassmorphism dark interface built with Tailwind CSS.
  - Drag-and-drop image upload zone.
  - **Live Webcam Snap Capture** modal with real-time video feed.
  - **Interactive Bounding Box Overlays**: Category color-coded bounding boxes mapped to the image.
  - **Synchronized Hover Highlighting**: Hovering over form fields (Name, Phone, Email, etc.) automatically highlights the corresponding bounding box on the card.
  - **Editable Result Card**: In-place editing, dynamic addition/removal of multiple phones, emails, and websites, and 1-click clipboard copy with toast feedback.
  - **One-Click Export**: Download standard RFC 2426 `.vcf` (vCard 3.0) file for immediate import into Apple Contacts, Google Contacts, and Outlook, or export formatted `.json`.
  - **1-Click Test Samples**: Pre-bundled high-resolution sample cards for instant demonstration without uploading files.
  - **Raw Tokens Inspector**: Complete tabular view of all raw OCR tokens, coordinates, and confidence bars.

---

## 🏗️ System Architecture

```
                                  [ Uploaded Image / Webcam Snapshot ]
                                                    │
                                                    ▼
                             ┌───────────────────────────────────────────────┐
                             │       OpenCV Image Preprocessing Pipeline      │
                             │  - Auto-Deskew & Orientation Correction       │
                             │  - Contrast Limited Adaptive Hist Eq (CLAHE)  │
                             │  - Bilateral Filtering & Denoising            │
                             │  - Adaptive Gaussian Thresholding             │
                             └──────────────────────┬────────────────────────┘
                                                    │ Preprocessed RGB Array
                                                    ▼
                             ┌───────────────────────────────────────────────┐
                             │          Local Neural OCR (EasyOCR / PyTorch) │
                             │  - Character detection & recognition          │
                             │  - Normalized bounding boxes [x0, y0, x1, y1] │
                             │  - Token confidence scores                    │
                             └──────────────────────┬────────────────────────┘
                                                    │ Extracted Tokens
                                                    ▼
                             ┌───────────────────────────────────────────────┐
                             │        Hybrid NLP & Extraction Pipeline       │
                             │                                               │
                             │  1. Rule-Based / Regex Extractor              │
                             │     • RFC Email Regex                         │
                             │     • International / Domestic Phones         │
                             │     • Websites & Web Domains                  │
                             │                                               │
                             │  2. Local Transformer NER (HF BERT)           │
                             │     • Full Name (PER)                         │
                             │     • Organization / Company (ORG)            │
                             │     • Location / Address (LOC)                │
                             │                                               │
                             │  3. Heuristic Domain Engine (Fallback)        │
                             │     • 160+ Job Title Knowledge Base           │
                             │     • Corporate Suffix Matching               │
                             │     • Street & Postal Address Aggregation     │
                             └──────────────────────┬────────────────────────┘
                                                    │ Structured Data
                                                    ▼
                      ┌─────────────────────────────────────────────────────────────┐
                      │                   FastAPI Backend Core                      │
                      │  - POST /api/extract        - POST /api/export/vcf          │
                      │  - GET  /api/health         - GET  /api/samples             │
                      └──────────────────────┬──────────────────────────────────────┘
                                             │ JSON / vCard Payload
                                             ▼
                      ┌─────────────────────────────────────────────────────────────┐
                      │              Modern Glassmorphism Frontend (SPA)            │
                      │  • Interactive Bounding Box Overlay & Spatial Hover Sync    │
                      │  • Editable Card Profile + Copy Buttons                     │
                      │  • Direct .vcf vCard Download & .json Export                │
                      │  • Live Webcam Shutter Capture & 1-Click Sample Gallery     │
                      └─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
AI CARD/
├── app/
│   ├── __init__.py           # Application package initializer
│   ├── main.py               # FastAPI application, CORS, static file routes, API endpoints
│   ├── schemas.py            # Pydantic data contracts (BoundingBox, OCRToken, BusinessCardData)
│   ├── preprocessor.py       # OpenCV preprocessing (deskew, CLAHE, bilateral filter, threshold)
│   ├── ocr_service.py        # Local PyTorch EasyOCR engine wrapper with token normalization
│   ├── nlp_pipeline.py       # Hybrid Regex + HF Transformer NER + Domain Heuristic Classifier
│   └── vcard_utils.py        # RFC 2426 vCard 3.0 generation utility
├── static/
│   ├── index.html            # Responsive SPA layout with Tailwind CSS & Glassmorphism
│   ├── app.js                # Frontend client logic (drag/drop, webcam, bounding boxes, export)
│   └── style.css             # Custom glassmorphism styling, bounding box themes, animations
├── samples/                  # Pre-bundled high-resolution sample business cards
│   ├── tech_executive.png    # Sample: Tech Executive (Elena Vance - Apex AI Systems)
│   ├── creative_director.png # Sample: Creative Director (Marcus Sterling - Chroma Labs)
│   └── medical_specialist.png# Sample: Medical Specialist (Dr. Sarah Jenkins - Metro Health)
├── test_app.py               # Automated end-to-end integration test suite
├── requirements.txt          # Pinned dependency requirements
└── README.md                 # Complete documentation and setup guide
```

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- Python 3.10 to 3.13 installed on Windows, macOS, or Linux.
- (Optional) NVIDIA GPU with CUDA for accelerated neural inference (automatically defaults to CPU if no GPU is detected).

### 2. Clone / Open Directory
```bash
cd "AI CARD"
```

### 3. (Recommended) Create Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

> **Note on PyTorch**: If you require pure CPU PyTorch on Windows or Linux, you can install the lightweight wheel via:
> ```bash
> pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
> ```

### 5. Run the Automated Test Suite
Verify that your local OCR, NLP, and FastAPI endpoints are operating with 100% test pass:
```bash
python test_app.py
```

### 6. Start the Web Application
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open your browser and navigate to:
```
http://127.0.0.1:8000
```

---

## 📡 API Reference

### 1. Extract Business Card Data
- **Endpoint**: `POST /api/extract`
- **Content-Type**: `multipart/form-data`
- **Request Form Field**: `file` (Image file: `.png`, `.jpg`, `.jpeg`, `.webp`)
- **Response**:
```json
{
  "success": true,
  "data": {
    "name": "Elena Vance",
    "title": "Chief Technology Officer",
    "company": "Apex AI Systems Inc.",
    "phone": [
      "+1 (415) 890-4321"
    ],
    "email": [
      "elena.vance@apexai.io"
    ],
    "website": [
      "www.apexai.io"
    ],
    "address": "450 Mission Street, Suite 1200, San Francisco, CA 94105",
    "raw_ocr_tokens": [
      {
        "id": "token-1",
        "text": "Apex AI Systems Inc.",
        "confidence": 0.9842,
        "bbox": {
          "x_min": 0.0571,
          "y_min": 0.0833,
          "x_max": 0.4286,
          "y_max": 0.1450,
          "pixel_x0": 60,
          "pixel_y0": 50,
          "pixel_x1": 450,
          "pixel_y1": 87,
          "polygon": [[60, 50], [450, 50], [450, 87], [60, 87]]
        },
        "category": "COMPANY"
      }
    ]
  },
  "image_dimensions": {
    "width": 1050,
    "height": 600
  },
  "processing_time_ms": 1120.45,
  "ocr_engine": "EasyOCR (PyTorch Local)",
  "nlp_model": "dslim/bert-base-NER (Local)",
  "message": "Extraction completed successfully."
}
```

### 2. Export vCard (.vcf)
- **Endpoint**: `POST /api/export/vcf`
- **Content-Type**: `application/json`
- **Payload**:
```json
{
  "name": "Elena Vance",
  "title": "Chief Technology Officer",
  "company": "Apex AI Systems Inc.",
  "phone": ["+1 (415) 890-4321"],
  "email": ["elena.vance@apexai.io"],
  "website": ["www.apexai.io"],
  "address": "450 Mission Street, Suite 1200, San Francisco, CA 94105"
}
```
- **Response**: Downloadable file attachment `Elena_Vance.vcf` (vCard 3.0 specification).

### 3. System Health Check
- **Endpoint**: `GET /api/health`
- **Response**:
```json
{
  "status": "healthy",
  "ocr_engine": "EasyOCR (PyTorch Local)",
  "ocr_ready": true,
  "nlp_engine": "dslim/bert-base-NER (Local)",
  "nlp_ready": true,
  "torch_device": "cpu",
  "system_ready": true
}
```

### 4. Sample Cards Gallery
- **Endpoint**: `GET /api/samples`
- Returns array of sample cards metadata (`id`, `title`, `url`).

---

## 🎨 Interactive User Experience Highlights

1. **1-Click Sample Testing**:
   Click any of the sample badges at the top ("Tech Executive", "Creative Director", "Medical Specialist") to instantly run the complete pipeline without needing to find or take a business card picture.
2. **Webcam Capture**:
   Click "Webcam Snap Capture" to launch an integrated camera viewfinder, align the card, and snap a high-resolution frame.
3. **Spatial Bounding Box Map**:
   Hovering over any detected text box on the card displays a floating card with the token's text, category badge, and OCR confidence level.
4. **Synchronized Field-to-Image Glow**:
   Hover over the "Full Name", "Company", "Phone", or "Email" fields in the right-column form to automatically highlight and glow the exact location where that text was found on the original business card.
5. **Instant Copy & Export**:
   Every field includes a 1-click copy button. Export the whole card as a standardized vCard `.vcf` file that directly imports into Google Contacts, Apple Contacts, and Microsoft Outlook.

---

## 🛡️ License & Architecture Compliance
This project uses **100% open-source components** and adheres strictly to local execution guidelines:
- OpenCV (Apache 2.0)
- EasyOCR & PyTorch (Apache 2.0 / BSD)
- Hugging Face Transformers (Apache 2.0)
- FastAPI & Starlette (MIT)
- Tailwind CSS (MIT)
No proprietary APIs or subscription keys required.
#   a i c a r d s c a n  
 #   a i c a r d s c a n  
 #   a i c a r d s c a n  
 #   a i c a r d s c a n  
 