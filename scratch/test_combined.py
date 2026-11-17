import cv2
import numpy as np
import base64
import urllib.request
import json
import time

img1 = cv2.imread('samples/front.jpeg')
img2 = cv2.imread('samples/back.jpeg')

# Resize both to same height
h = 360
w1 = int(img1.shape[1] * (h / img1.shape[0]))
w2 = int(img2.shape[1] * (h / img2.shape[0]))
r1 = cv2.resize(img1, (w1, h), interpolation=cv2.INTER_AREA)
r2 = cv2.resize(img2, (w2, h), interpolation=cv2.INTER_AREA)

# Stack horizontally
combined = np.hstack([r1, r2])
max_dim = max(combined.shape[:2])
if max_dim > 640:
    scale = 640.0 / max_dim
    combined = cv2.resize(combined, (int(combined.shape[1] * scale), int(combined.shape[0] * scale)), interpolation=cv2.INTER_AREA)

cv2.imwrite('scratch/combined_card.jpg', combined, [cv2.IMWRITE_JPEG_QUALITY, 85])
print(f'Combined image shape: {combined.shape}')

t0 = time.time()
with open('scratch/combined_card.jpg', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

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

req = urllib.request.Request(
    'http://localhost:11434/api/generate',
    data=json.dumps({
        'model': 'minicpm-v:latest',
        'prompt': prompt,
        'images': [b64],
        'format': 'json',
        'stream': False,
        'options': {'temperature': 0.0, 'num_predict': 250}
    }).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

print('Sending combined card to minicpm-v:latest...')
with urllib.request.urlopen(req, timeout=90) as resp:
    res = json.loads(resp.read().decode())
    print(f'Elapsed: {round(time.time() - t0, 1)}s')
    print('Result:', res.get('response'))
