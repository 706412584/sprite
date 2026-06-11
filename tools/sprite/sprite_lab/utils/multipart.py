"""multipart/form-data parsing without the deprecated cgi module."""
from __future__ import annotations

from email.parser import BytesParser
from email.policy import default as email_policy
from io import BytesIO
from types import SimpleNamespace


def parse_multipart_uploads(headers, body: bytes, field_name: str) -> list[SimpleNamespace]:
    content_type = headers.get("Content-Type", "")
    if "multipart/form-data" not in content_type.lower():
        raise ValueError("multipart/form-data required")
    message = BytesParser(policy=email_policy).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8") + body
    )
    items: list[SimpleNamespace] = []
    for part in message.iter_parts():
        if part.get_param("name", header="content-disposition") != field_name:
            continue
        filename = part.get_filename() or "media"
        payload = part.get_payload(decode=True) or b""
        items.append(SimpleNamespace(filename=filename, type=part.get_content_type(), file=BytesIO(payload)))
    return items


def parse_multipart_upload(headers, body: bytes, field_name: str = "video"):
    items = parse_multipart_uploads(headers, body, field_name)
    if items:
        return items[0]
    raise ValueError("media file missing")
