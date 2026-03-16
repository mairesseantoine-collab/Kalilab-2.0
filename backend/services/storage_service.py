"""
Storage service - MinIO/S3 file operations.
"""
import os
import boto3
from botocore.exceptions import ClientError
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_BUCKET = os.getenv("S3_BUCKET", "kalilab-docs")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")


def _get_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name="us-east-1",
    )


def ensure_bucket_exists():
    client = _get_client()
    try:
        client.head_bucket(Bucket=S3_BUCKET)
    except ClientError:
        client.create_bucket(Bucket=S3_BUCKET)


async def upload_file(file_bytes: bytes, path: str, content_type: str = "application/octet-stream") -> str:
    """
    Upload file bytes to S3/MinIO.
    Returns the S3 path (key).
    """
    client = _get_client()
    ensure_bucket_exists()
    client.put_object(
        Bucket=S3_BUCKET,
        Key=path,
        Body=file_bytes,
        ContentType=content_type,
    )
    return path


async def get_file_url(path: str, expires: int = 3600) -> str:
    """
    Generate a presigned URL for the given S3 path.
    Default expiry is 1 hour.
    """
    client = _get_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": path},
        ExpiresIn=expires,
    )
    return url


async def get_file_bytes(path: str) -> bytes:
    """Download file content from S3."""
    client = _get_client()
    response = client.get_object(Bucket=S3_BUCKET, Key=path)
    return response["Body"].read()


async def delete_file(path: str) -> bool:
    """Delete a file from S3. Returns True on success."""
    client = _get_client()
    try:
        client.delete_object(Bucket=S3_BUCKET, Key=path)
        return True
    except ClientError:
        return False


async def list_files(prefix: str = "") -> list:
    """List files under a given prefix."""
    client = _get_client()
    response = client.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix)
    return [obj["Key"] for obj in response.get("Contents", [])]
