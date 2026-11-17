import urllib.request
import json

card_text = """- Foeqora
- Mpex
- Umiun & Uniqug
- www.foodoraimpex.com
- ONKAR JADHAV
- Director
- +91 88793 47040
- wwwfoodoraimpex com
- onkar Jadhav@foodora comn
- Bldg No 53, Vidya Darshan CHS; Tagore
- Foodora
- Nagar Vikhroli East Mumbai 400083
- impex
- Premiuy & Unique"""

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
        "model": "qwen2.5:1.5b",
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.0}
    }).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

with urllib.request.urlopen(req, timeout=30.0) as resp:
    res = json.loads(resp.read().decode())
    print("OLLAMA RESPONSE ON ONKAR JADHAV:")
    print(res["response"])
