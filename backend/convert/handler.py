import boto3
import uuid
import os
import json
from datetime import datetime

polly = boto3.client("polly")
s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

BUCKET_NAME = os.environ.get("BUCKET_NAME")
TABLE_NAME = os.environ.get("TABLE_NAME")

def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body", "{}"))
        text = body.get("text", "").strip()
        if not text:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "text is required"}),
                "headers": {"Access-Control-Allow-Origin": "*"}
            }

        # Get user ID from Cognito JWT claims
        claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
        user_id = claims.get("sub", "anonymous")

        # Polly synthesize speech
        response = polly.synthesize_speech(Text=text, OutputFormat="mp3", VoiceId="Joanna")
        audio_stream = response.get("AudioStream")
        if audio_stream is None:
            return {
                "statusCode": 500,
                "body": json.dumps({"error": "Polly returned no audio"}),
                "headers": {"Access-Control-Allow-Origin": "*"}
            }

        audio_bytes = audio_stream.read()
        audio_stream.close()

        audio_key = f"{user_id}/{uuid.uuid4()}.mp3"

        # Upload to S3
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=audio_key,
            Body=audio_bytes,
            ContentType="audio/mpeg"
        )

        # Save record to DynamoDB
        table = dynamodb.Table(TABLE_NAME)
        timestamp = datetime.utcnow().isoformat()
        item = {
            "user_id": user_id,
            "timestamp": timestamp,
            "audio_key": audio_key,
            "text": text
        }
        table.put_item(Item=item)

        # Generate presigned URL
        audio_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET_NAME, "Key": audio_key},
            ExpiresIn=3600
        )

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "success",
                "audio_url": audio_url,
                "timestamp": timestamp,
                "text": text
            }),
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
            "headers": {"Access-Control-Allow-Origin": "*"}
        }
