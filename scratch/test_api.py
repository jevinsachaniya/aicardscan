import urllib.request
import json

boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
with open("samples/front.jpeg", "rb") as f:
    front_bytes = f.read()
with open("samples/back.jpeg", "rb") as f:
    back_bytes = f.read()

body = bytearray()

# Front file
body.extend(f"--{boundary}\r\n".encode())
body.extend(b'Content-Disposition: form-data; name="file"; filename="front.jpeg"\r\n')
body.extend(b"Content-Type: image/jpeg\r\n\r\n")
body.extend(front_bytes)
body.extend(b"\r\n")

# Back file
body.extend(f"--{boundary}\r\n".encode())
body.extend(b'Content-Disposition: form-data; name="back_file"; filename="back.jpeg"\r\n')
body.extend(b"Content-Type: image/jpeg\r\n\r\n")
body.extend(back_bytes)
body.extend(b"\r\n")

# End
body.extend(f"--{boundary}--\r\n".encode())

req = urllib.request.Request(
    "http://127.0.0.1:8000/api/extract",
    data=bytes(body),
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
)

with urllib.request.urlopen(req, timeout=120) as resp:
    res = json.loads(resp.read().decode())
    print("HTTP API EXTRACT RESULT:")
    d = res.get("data", {})
    print("Name:   ", d.get("name"))
    print("Title:  ", d.get("title"))
    print("Company:", d.get("company"))
    print("Phone:  ", d.get("phone"))
    print("Email:  ", d.get("email"))
    print("Website:", d.get("website"))
    print("Address:", d.get("address"))
