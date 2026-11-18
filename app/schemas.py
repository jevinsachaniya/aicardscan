"""
Pydantic schemas and data contracts for Business Card Extraction application.
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """Normalized and pixel coordinates for detected text bounding box."""
    # Normalized coordinates [0.0 - 1.0] relative to image dimensions
    x_min: float = Field(..., description="Normalized left X coordinate (0.0 to 1.0)")
    y_min: float = Field(..., description="Normalized top Y coordinate (0.0 to 1.0)")
    x_max: float = Field(..., description="Normalized right X coordinate (0.0 to 1.0)")
    y_max: float = Field(..., description="Normalized bottom Y coordinate (0.0 to 1.0)")
    # Absolute pixel coordinates
    pixel_x0: int = Field(..., description="Left pixel coordinate")
    pixel_y0: int = Field(..., description="Top pixel coordinate")
    pixel_x1: int = Field(..., description="Right pixel coordinate")
    pixel_y1: int = Field(..., description="Bottom pixel coordinate")
    # 4-point polygon coordinates [[x,y], [x,y], [x,y], [x,y]]
    polygon: List[List[int]] = Field(default_factory=list, description="4-corner bounding polygon")


class OCRToken(BaseModel):
    """Individual OCR detected text segment with spatial and classification metadata."""
    id: str = Field(..., description="Unique token identifier")
    text: str = Field(..., description="Raw extracted text string")
    confidence: float = Field(..., description="OCR confidence score (0.0 to 1.0)")
    bbox: BoundingBox = Field(..., description="Bounding box coordinates")
    category: Optional[str] = Field(
        default="OTHER",
        description="Assigned entity category (NAME, TITLE, COMPANY, PHONE, EMAIL, WEBSITE, ADDRESS, OTHER)"
    )
    side: Optional[str] = Field(
        default="front",
        description="Card side ('front' or 'back')"
    )


class BusinessCardData(BaseModel):
    """Structured and classified information extracted from the business card."""
    name: str = Field(default="", description="Full Name of the contact")
    title: str = Field(default="", description="Job Title / Designation / Role")
    company: str = Field(default="", description="Organization / Company name")
    phone: List[str] = Field(default_factory=list, description="Extracted phone / mobile numbers")
    mobile: Optional[str] = Field(default="", description="Primary Mobile number")
    office_phone: Optional[str] = Field(default="", description="Office Phone / Landline")
    email: List[str] = Field(default_factory=list, description="Extracted email addresses")
    website: List[str] = Field(default_factory=list, description="Extracted websites / domain URLs")
    address: str = Field(default="", description="Extracted physical office/company address")
    office_address: Optional[str] = Field(default="", description="Registered Office Address")
    factory_address: Optional[str] = Field(default="", description="Factory / Plant / Secondary Address")
    notes: Optional[str] = Field(default="", description="Notes or additional raw details")
    raw_text: Optional[str] = Field(default="", description="Full raw detected text across all sides")
    raw_ocr_tokens: List[OCRToken] = Field(
        default_factory=list,
        description="Full list of all raw OCR tokens with bounding boxes"
    )


class ImageDimensions(BaseModel):
    width: int
    height: int


class ExtractionResponse(BaseModel):
    """Full API response for /api/extract."""
    success: bool
    data: BusinessCardData
    image_dimensions: ImageDimensions
    back_image_dimensions: Optional[ImageDimensions] = None
    has_back_side: bool = False
    processing_time_ms: float
    ocr_engine: str
    nlp_model: str
    engine_source: Optional[str] = "default_api"
    engine_display_name: Optional[str] = "Default Cloud AI (Gemini 2.5 Flash)"
    engine_status_note: Optional[str] = ""
    message: Optional[str] = None


class HealthResponse(BaseModel):
    """API response for /api/health."""
    status: str
    ocr_engine: str
    ocr_ready: bool
    nlp_engine: str
    nlp_ready: bool
    torch_device: str
    system_ready: bool


class ExportVCFRequest(BaseModel):
    """Payload to generate standard vCard 3.0 file."""
    name: Optional[str] = ""
    title: Optional[str] = ""
    company: Optional[str] = ""
    phone: Optional[List[str]] = []
    email: Optional[List[str]] = []
    website: Optional[List[str]] = []
    address: Optional[str] = ""


class BatchExportVCFRequest(BaseModel):
    """Payload to generate combined multi-contact vCard file."""
    cards: List[ExportVCFRequest] = Field(default_factory=list)
