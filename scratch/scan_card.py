import json
import urllib.request
from app.ocr_service import get_ocr_service
from app.nlp_pipeline import get_nlp_classifier

print("Initializing OCR & NLP services...")
ocr = get_ocr_service()
nlp = get_nlp_classifier()

with open("samples/front.jpeg", "rb") as f:
    front_bytes = f.read()

with open("samples/back.jpeg", "rb") as f:
    back_bytes = f.read()

print("\n--- Scanning Front Image (EasyOCR + QR Detector) ---")
front_tokens, front_meta, _ = ocr.extract_from_bytes(front_bytes, rotation=0)
for idx, t in enumerate(front_tokens):
    t.side = "front"
    t.id = f"token-front-{idx+1}"
    print(f"Front [{t.id}]: '{t.text}' (conf: {t.confidence:.2f})")

print("\n--- Scanning Back Image (EasyOCR) ---")
back_tokens, back_meta, _ = ocr.extract_from_bytes(back_bytes, rotation=0)
for idx, t in enumerate(back_tokens):
    t.side = "back"
    t.id = f"token-back-{idx+1}"
    print(f"Back [{t.id}]: '{t.text}' (conf: {t.confidence:.2f})")

all_tokens = front_tokens + back_tokens
print(f"\nTotal tokens extracted: {len(all_tokens)}")

print("\n--- Running Project NLP Classification Pipeline ---")
for t in all_tokens:
    print(f"Token to NLP: {t.text}")
card_data = nlp.process_tokens(all_tokens)

print("\n================ FINAL SCANNER OUTPUT ================")
print(f"Name:    {card_data.name}")
print(f"Title:   {card_data.title}")
print(f"Company: {card_data.company}")
print(f"Phone:   {card_data.phone}")
print(f"Email:   {card_data.email}")
print(f"Website: {card_data.website}")
print(f"Address: {card_data.address}")
print("======================================================")
