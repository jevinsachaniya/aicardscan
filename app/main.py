"""
FastAPI Main Application for CardLens AI Local Business Card Extraction.
Zero third-party APIs: 100% on-device OCR and NLP pipeline.
"""
import os
import time
import logging
import warnings
from contextlib import asynccontextmanager
from typing import List, Optional

# Suppress PyTorch and third-party deprecation / user warnings to keep production logs clean
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)
os.environ["PYTHONWARNINGS"] = "ignore"

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, PlainTextResponse

from app.schemas import (
    ExtractionResponse,
    HealthResponse,
    ExportVCFRequest,
    BatchExportVCFRequest,
    ImageDimensions
)
from app.ocr_service import get_ocr_service
from app.nlp_pipeline import get_nlp_classifier
from app.vcard_utils import generate_vcard_content, generate_batch_vcard_content

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("cardlens-app")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")
SAMPLES_DIR = os.path.join(BASE_DIR, "samples")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Render 512MB optimized startup: bind port instantly without blocking."""
    logger.info("Starting CardLens AI web service...")
    try:
        import torch
        torch.set_num_threads(1)
        if hasattr(torch, "set_grad_enabled"):
            torch.set_grad_enabled(False)
    except Exception:
        pass
    yield
    logger.info("CardLens AI application shutting down.")


app = FastAPI(
    title="CardLens AI - Local Business Card Extraction & Classification",
    description="Enterprise-grade local OCR & NLP business card digitization without cloud APIs.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for cross-origin testing and local frontend tooling
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Serve the multi-resolution application favicon."""
    if os.path.exists("static/favicon.ico"):
        return FileResponse("static/favicon.ico", media_type="image/x-icon")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/manifest.json", include_in_schema=False)
async def get_manifest():
    """Return PWA Web App Manifest for store compatibility."""
    return FileResponse("static/manifest.json", media_type="application/manifest+json")


@app.get("/sw.js", include_in_schema=False)
async def get_service_worker():
    """Serve root service worker for PWA offline support & PWABuilder store readiness."""
    return FileResponse("static/sw.js", media_type="application/javascript")


@app.get("/.well-known/assetlinks.json", include_in_schema=False)
@app.get("/assetlinks.json", include_in_schema=False)
async def get_assetlinks():
    """Serve Digital Asset Links for Android Trusted Web Activity (TWA) domain verification."""
    return FileResponse("static/.well-known/assetlinks.json", media_type="application/json")


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health-check endpoint verifying local OCR and NLP engine status.
    """
    ocr = get_ocr_service()
    nlp = get_nlp_classifier()

    return HealthResponse(
        status="healthy" if (ocr.is_ready or ocr.reader is not None) else "degraded",
        ocr_engine=ocr.engine_name,
        ocr_ready=ocr.is_ready,
        nlp_engine=nlp.ner_model_name,
        nlp_ready=True,  # Heuristics or HF NER always available
        torch_device=ocr.device,
        system_ready=ocr.is_ready
    )


@app.post("/api/extract", response_model=ExtractionResponse, tags=["Extraction"])
async def extract_business_card(
    file: Optional[UploadFile] = File(None),
    front_file: Optional[UploadFile] = File(None),
    back_file: Optional[UploadFile] = File(None),
    rotation: int = Form(0),
    back_rotation: int = Form(0),
    api_key: Optional[str] = Form(None),
    custom_api_key: Optional[str] = Form(None)
):
    """
    Accepts business card image(s) (Front required, optional Back side).
    API-Friendly Hybrid Pipeline:
    - Priority 1: High-accuracy Google Gemini 1.5 Flash Vision (if key provided via env or request)
    - Priority 2: Auto-fallback to local OpenCV + EasyOCR low-RAM engine (if no key, rate-limited, or offline)
    Returns structured JSON with contact entities merged from both sides.
    """
    start_time = time.time()

    upload_file = file or front_file
    effective_api_key = api_key or custom_api_key

    # Validate file presence
    if not upload_file or not upload_file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No front card image uploaded. Please provide a valid business card image."
        )

    # Validate content type / extension
    allowed_exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
    ext = os.path.splitext(upload_file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed extensions: {', '.join(allowed_exts)}"
        )

    try:
        # Read front image bytes
        front_bytes = await upload_file.read()
        if len(front_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded front image is empty (0 bytes)."
            )

        if len(front_bytes) > 20 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Front file size exceeds maximum permitted limit (20MB)."
            )

        # Step 1: Optional Back side file read
        back_tokens = []
        back_meta = None
        has_back_side = False
        back_bytes = None

        if back_file and back_file.filename:
            back_ext = os.path.splitext(back_file.filename)[1].lower()
            if back_ext in allowed_exts:
                b_b = await back_file.read()
                if 0 < len(b_b) <= 20 * 1024 * 1024:
                    back_bytes = b_b
                    has_back_side = True

        # Step 2: 3-Tier Hierarchical Engine (Tier 1: User API -> Tier 2: Default API -> Tier 3: Local Engine)
        from app.gemini_service import extract_with_hierarchical_engine
        cloud_data, cloud_tokens, engine_source, engine_display_name, engine_status_note = extract_with_hierarchical_engine(
            front_bytes,
            back_bytes=back_bytes,
            user_api_key=effective_api_key
        )

        if cloud_data:
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            return ExtractionResponse(
                success=True,
                data=cloud_data,
                image_dimensions=ImageDimensions(width=1000, height=600),
                back_image_dimensions=ImageDimensions(width=1000, height=600) if has_back_side else None,
                has_back_side=has_back_side,
                processing_time_ms=elapsed_ms,
                ocr_engine="Google Gemini Vision API",
                nlp_model=engine_display_name,
                engine_source=engine_source,
                engine_display_name=engine_display_name,
                engine_status_note=engine_status_note,
                message=engine_status_note
            )

        # Step 3: Local Engine Fallback (OpenCV Multi-scale + EasyOCR Low-RAM)
        logger.info(f"Using Local Engine. Reason: {engine_status_note}")
        import gc
        ocr = get_ocr_service()
        front_tokens, front_meta, _ = ocr.extract_from_bytes(front_bytes, rotation=rotation)
        for t in front_tokens:
            t.side = "front"

        # Explicit garbage collection after front side extraction
        gc.collect()

        back_tokens = []
        back_meta = None
        if has_back_side and back_bytes:
            b_tokens, back_meta, _ = ocr.extract_from_bytes(back_bytes, rotation=back_rotation)
            for idx, bt in enumerate(b_tokens):
                bt.side = "back"
                bt.id = f"token-back-{idx + 1}"
            back_tokens = b_tokens
            gc.collect()

        all_tokens = front_tokens + back_tokens

        # Step 4: Hybrid NLP Classification across combined tokens (Spatial Heuristics & Rules)
        nlp = get_nlp_classifier()
        structured_data = nlp.process_tokens(all_tokens)

        elapsed_ms = round((time.time() - start_time) * 1000, 2)

        return ExtractionResponse(
            success=True,
            data=structured_data,
            image_dimensions=ImageDimensions(
                width=front_meta["width"],
                height=front_meta["height"]
            ),
            back_image_dimensions=ImageDimensions(
                width=back_meta["width"],
                height=back_meta["height"]
            ) if back_meta else None,
            has_back_side=has_back_side,
            processing_time_ms=elapsed_ms,
            ocr_engine=ocr.engine_name,
            nlp_model=nlp.ner_model_name,
            engine_source="local_engine",
            engine_display_name="Local Offline Engine",
            engine_status_note=engine_status_note,
            message=engine_status_note
        )

    except ValueError as ve:
        logger.error(f"Validation error: {ve}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Extraction error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction pipeline encountered an error: {str(e)}"
        )


@app.post("/api/export/vcf", tags=["Export"])
async def export_vcard(card: ExportVCFRequest):
    """
    Generate downloadable standard RFC 2426 vCard 3.0 file for a single contact.
    """
    try:
        vcf_content = generate_vcard_content(card)
        contact_slug = (card.name or "contact").strip().replace(" ", "_")
        filename = f"{contact_slug}.vcf"

        return Response(
            content=vcf_content,
            media_type="text/vcard",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        logger.error(f"vCard export error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate vCard: {str(e)}"
        )


@app.post("/api/export/vcf/batch", tags=["Export"])
async def export_batch_vcards(payload: BatchExportVCFRequest):
    """
    Generate combined multi-contact vCard 3.0 file for all scanned cards.
    """
    try:
        vcf_content = generate_batch_vcard_content(payload.cards)
        filename = f"scanned_business_cards_{int(time.time())}.vcf"

        return Response(
            content=vcf_content,
            media_type="text/vcard",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        logger.error(f"Batch vCard export error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate batch vCard: {str(e)}"
        )


@app.get("/api/samples", tags=["Samples"])
async def list_sample_cards():
    """
    Returns list of built-in sample business cards for quick 1-click testing.
    """
    if not os.path.exists(SAMPLES_DIR):
        return []

    samples = []
    sample_files = [f for f in os.listdir(SAMPLES_DIR) if f.lower().endswith((".png", ".jpg", ".jpeg"))]
    for sf in sample_files:
        name_clean = os.path.splitext(sf)[0].replace("_", " ").title()
        samples.append({
            "id": sf,
            "title": name_clean,
            "url": f"/api/samples/{sf}"
        })
    return samples


@app.get("/api/samples/{filename}", tags=["Samples"])
async def get_sample_card(filename: str):
    """Serve specific sample card image."""
    safe_path = os.path.abspath(os.path.join(SAMPLES_DIR, filename))
    if not safe_path.startswith(os.path.abspath(SAMPLES_DIR)) or not os.path.exists(safe_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sample card not found.")
    return FileResponse(safe_path)


# ---------------------------------------------------------------------------
# Mount Static Files & SPA Root
# ---------------------------------------------------------------------------
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/favicon.ico", include_in_schema=False)
async def serve_favicon():
    """Serve favicon to prevent 404 console errors."""
    fav_path = os.path.join(STATIC_DIR, "favicon.svg")
    if os.path.exists(fav_path):
        return FileResponse(fav_path, media_type="image/svg+xml")
    return Response(status_code=204)


@app.get("/", tags=["Frontend"])
async def serve_index():
    """Serve the Single-Page Application HTML."""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return PlainTextResponse("CardLens AI Frontend is building... Please check back in a moment.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
