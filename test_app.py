"""
End-to-End Test Suite for CardLens AI Backend API.
Tests:
- Health check endpoint (/api/health)
- Samples list endpoint (/api/samples)
- Extract endpoint (/api/extract) with sample card
- vCard generation endpoint (/api/export/vcf)
"""
import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    print("Testing /api/health...")
    response = client.get("/api/health")
    assert response.status_code == 200, f"Health check failed: {response.text}"
    data = response.json()
    print("Health Status:", data)
    assert data["status"] in ["healthy", "degraded"]
    print("PASS: /api/health")

def test_samples():
    print("\nTesting /api/samples...")
    response = client.get("/api/samples")
    assert response.status_code == 200
    samples = response.json()
    print(f"Found {len(samples)} samples:", [s["id"] for s in samples])
    assert len(samples) >= 3
    print("PASS: /api/samples")

def test_extract_sample():
    print("\nTesting /api/extract with samples/tech_executive.png...")
    with open("samples/tech_executive.png", "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/api/extract",
        files={"file": ("tech_executive.png", file_bytes, "image/png")}
    )
    assert response.status_code == 200, f"Extract failed: {response.text}"
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    print("Extracted Data:")
    print("  Name:    ", data["name"])
    print("  Title:   ", data["title"])
    print("  Company: ", data["company"])
    print("  Phone:   ", data["phone"])
    print("  Email:   ", data["email"])
    print("  Website: ", data["website"])
    print("  Address: ", data["address"])
    print(f"  OCR Tokens Detected: {len(data['raw_ocr_tokens'])}")
    print(f"  Processing Time: {res['processing_time_ms']} ms")
    
    assert data["name"] != ""
    assert len(data["phone"]) > 0
    assert len(data["email"]) > 0
    print("PASS: /api/extract")

def test_export_vcf():
    print("\nTesting /api/export/vcf...")
    payload = {
        "name": "Elena Vance",
        "title": "Chief Technology Officer",
        "company": "Apex AI Systems Inc.",
        "phone": ["+1 (415) 890-4321"],
        "email": ["elena.vance@apexai.io"],
        "website": ["www.apexai.io"],
        "address": "450 Mission Street, Suite 1200, San Francisco, CA 94105"
    }
    response = client.post("/api/export/vcf", json=payload)
    assert response.status_code == 200
    assert "BEGIN:VCARD" in response.text
    assert "FN:Elena Vance" in response.text
    assert "ORG:Apex AI Systems Inc." in response.text
    assert "END:VCARD" in response.text
    print("Generated vCard sample:\n", response.text.strip())
    print("PASS: /api/export/vcf")

def test_export_vcf_batch():
    print("\nTesting /api/export/vcf/batch...")
    payload = {
        "cards": [
            {
                "name": "Elena Vance",
                "title": "Chief Technology Officer",
                "company": "Apex AI Systems Inc.",
                "phone": ["+1 (415) 890-4321"],
                "email": ["elena.vance@apexai.io"],
                "website": ["www.apexai.io"],
                "address": "450 Mission Street, Suite 1200, San Francisco, CA 94105"
            },
            {
                "name": "AJI SETIAWAN",
                "title": "Assistant Export Manager",
                "company": "PT. ABC PRESIDENT INDONESIA",
                "phone": ["+62 21 290 20 188"],
                "email": ["aji.setiawan@abcpresident.com"],
                "website": ["www.abcpresident.com"],
                "address": "Cyber 2 Tower, Jakarta Selatan 12950, INDONESIA"
            }
        ]
    }
    response = client.post("/api/export/vcf/batch", json=payload)
    assert response.status_code == 200
    assert response.text.count("BEGIN:VCARD") == 2
    assert response.text.count("END:VCARD") == 2
    assert "FN:Elena Vance" in response.text
    assert "FN:AJI SETIAWAN" in response.text
    print("PASS: /api/export/vcf/batch (2 contacts generated in 1 file)")

def test_dual_side_extract():
    print("\nTesting /api/extract with DUAL SIDES (Front + Back)...")
    with open("samples/tech_executive.png", "rb") as f1, open("samples/creative_director.png", "rb") as f2:
        front_bytes = f1.read()
        back_bytes = f2.read()

    response = client.post(
        "/api/extract",
        files={
            "file": ("front.png", front_bytes, "image/png"),
            "back_file": ("back.png", back_bytes, "image/png")
        },
        data={"rotation": 0, "back_rotation": 0}
    )
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    assert res["has_back_side"] is True
    tokens = res["data"]["raw_ocr_tokens"]
    front_tokens = [t for t in tokens if t.get("side") == "front"]
    back_tokens = [t for t in tokens if t.get("side") == "back"]
    print(f"Dual Side Extracted Tokens: Front={len(front_tokens)}, Back={len(back_tokens)}")
    assert len(front_tokens) > 0
    assert len(back_tokens) > 0
    print("PASS: Dual-Side /api/extract")

def test_extract_aji_setiawan():
    print("\nTesting /api/extract with samples/aji_setiawan.png (ABC President Indonesia)...")
    with open("samples/aji_setiawan.png", "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/api/extract",
        files={"file": ("aji_setiawan.png", file_bytes, "image/png")},
        data={"rotation": 0}
    )
    assert response.status_code == 200, f"Extract failed: {response.text}"
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    print("Extracted Aji Setiawan Data:")
    print("  Name:    ", data["name"])
    print("  Title:   ", data["title"])
    print("  Company: ", data["company"])
    print("  Phone:   ", data["phone"])
    print("  Email:   ", data["email"])
    print("  Website: ", data["website"])
    print("  Address: ", data["address"])

    assert "AJI SETIAWAN" in data["name"].upper()
    assert "EXPORT" in data["title"].upper()
    assert "ABC" in data["company"].upper()
    assert len(data["phone"]) > 0
    assert len(data["email"]) > 0
    print("PASS: /api/extract (Aji Setiawan)")

if __name__ == "__main__":
    print("Starting CardLens AI Backend Test Suite...")
    test_health()
    test_samples()
    test_extract_sample()
    test_extract_aji_setiawan()
    test_dual_side_extract()
    test_export_vcf()
    test_export_vcf_batch()
    print("\n==========================================")
    print("ALL TESTS PASSED SUCCESSFULLY! 100% OPERATIONAL")
    print("==========================================")
