"""Object Storage client (target production architecture: large files —
PDFs, learning resources, model artifacts — live here, PostgreSQL holds
only their reference/metadata). Backed by MinIO for local development;
any S3-compatible endpoint works since this uses the standard S3 API via
boto3, not a MinIO-specific SDK.
"""

import os
import boto3
from botocore.client import Config

BUCKET = os.environ.get("OBJECT_STORAGE_BUCKET", "adaptive-learning-resources")

_client = boto3.client(
    "s3",
    endpoint_url=os.environ.get("OBJECT_STORAGE_ENDPOINT", "http://127.0.0.1:9000"),
    aws_access_key_id=os.environ.get("OBJECT_STORAGE_ACCESS_KEY", "minioadmin"),
    aws_secret_access_key=os.environ.get("OBJECT_STORAGE_SECRET_KEY", "minioadmin123"),
    config=Config(signature_version="s3v4"),
    region_name="us-east-1",
)


def ensure_bucket() -> None:
    existing = [b["Name"] for b in _client.list_buckets().get("Buckets", [])]
    if BUCKET not in existing:
        _client.create_bucket(Bucket=BUCKET)


def upload_file(local_path: str, object_key: str, content_type: str) -> None:
    _client.upload_file(local_path, BUCKET, object_key, ExtraArgs={"ContentType": content_type})


def get_object_bytes(object_key: str) -> bytes:
    obj = _client.get_object(Bucket=BUCKET, Key=object_key)
    return obj["Body"].read()
