"""
Standard RFC 2426 vCard 3.0 Generation Utility.
Enables instant import into Apple Contacts, Google Contacts, Microsoft Outlook,
and mobile phone address books.
"""
from typing import List, Optional
from app.schemas import ExportVCFRequest


def generate_vcard_content(card: ExportVCFRequest) -> str:
    """
    Generate valid vCard 3.0 content string from card fields.
    """
    lines = [
        "BEGIN:VCARD",
        "VERSION:3.0"
    ]

    # Full Name and Structured Name
    name = (card.name or "").strip()
    if name:
        parts = name.split()
        if len(parts) >= 2:
            first_name = parts[0]
            last_name = " ".join(parts[1:])
            lines.append(f"N:{last_name};{first_name};;;")
        else:
            lines.append(f"N:{name};;;;")
        lines.append(f"FN:{name}")
    else:
        lines.append("FN:Business Contact")

    # Company / Organization
    company = (card.company or "").strip()
    if company:
        lines.append(f"ORG:{company}")

    # Job Title / Role
    title = (card.title or "").strip()
    if title:
        lines.append(f"TITLE:{title}")

    # Phone Numbers
    phones = card.phone or []
    for idx, phone in enumerate(phones):
        p_clean = phone.strip()
        if p_clean:
            type_tag = "CELL" if idx == 0 else "WORK"
            lines.append(f"TEL;TYPE={type_tag},VOICE:{p_clean}")

    # Email Addresses
    emails = card.email or []
    for idx, email in enumerate(emails):
        e_clean = email.strip()
        if e_clean:
            type_tag = "PREF,INTERNET" if idx == 0 else "INTERNET"
            lines.append(f"EMAIL;TYPE={type_tag}:{e_clean}")

    # Websites / URLs
    websites = card.website or []
    for web in websites:
        w_clean = web.strip()
        if w_clean:
            if not (w_clean.startswith("http://") or w_clean.startswith("https://")):
                w_clean = "https://" + w_clean
            lines.append(f"URL:{w_clean}")

    # Address
    address = (card.address or "").strip()
    if address:
        # Standard ADR format: ;;street;city;state;zip;country
        # Sanitize commas and semi-colons
        sanitized_addr = address.replace(";", " ")
        lines.append(f"ADR;TYPE=WORK:;;{sanitized_addr};;;;")

    # Note footer
    lines.append("NOTE:Digitized and extracted by CardLens AI Local OCR")
    lines.append("END:VCARD")

    return "\r\n".join(lines) + "\r\n"


def generate_batch_vcard_content(cards: List[ExportVCFRequest]) -> str:
    """
    Generate concatenated multi-contact vCard 3.0 content string.
    Supported by Apple Contacts, Google Contacts, and Microsoft Outlook.
    """
    if not cards:
        return ""
    return "".join(generate_vcard_content(card) for card in cards)
