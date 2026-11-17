import base64
import json
import urllib.request
import cv2

# Resize image to 640px width so CPU vision encoding is 4x faster
img = cv2.imread("samples/back.jpeg")
h, w = img.shape[:2]
scale = 640.0 / max(h, w)
img_small = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
_, buf = cv2.imencode(".jpg", img_small, [cv2.IMWRITE_JPEG_QUALITY, 85])
back_b64 = base64.b64encode(buf.tobytes()).decode("utf-8")

prompt = """Extract business card contact details into JSON:
- name: Full Name
- title: Job Title
- company: Company Name
- phone: [phone numbers]
- email: [email addresses]
- website: [website URLs]
- address: full address

JSON only:
{
  "name": "",
  "title": "",
  "company": "",
  "phone": [],
  "email": [],
  "website": [],
  "address": ""
}"""

payload = {
    "model": "minicpm-v",
    "prompt": prompt,
    "images": [back_b64],
    "format": "json",
    "stream": False,
    "options": {
        "temperature": 0.0,
        "num_predict": 256
    }
}

req = urllib.request.Request(
    "http://localhost:11434/api/generate",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

print("Sending 640px image to MiniCPM-V...")
with urllib.request.urlopen(req, timeout=120.0) as resp:
    res = json.loads(resp.read().decode())
    print("\n=== MINICPM-V RESULT ===")
    print(res.get("response", "{}"))
