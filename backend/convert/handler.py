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

ALLOWED_VOICES = {
    "Joanna", "Matthew", "Amy", "Brian", "Aditi", "Raveena", "Mizuki", "Hans"
}

def lambda_handler(event, context):
   
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "http://localhost:5173",
                "Access-Control-Allow-Methods": "OPTIONS,POST",
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
            },
            "body": json.dumps({"message": "CORS preflight OK"})
        }

    try:
       
        body = json.loads(event.get("body", "{}"))
        text = body.get("text", "").strip()
        voice = body.get("voice", "Joanna").strip()

        if not text:
            return {
                "statusCode": 400,
                "headers": {
                    "Access-Control-Allow-Origin": "http://localhost:5173"
                },
                "body": json.dumps({"error": "text is required"})
            }

        if voice not in ALLOWED_VOICES:
            return {
                "statusCode": 400,
                "headers": {
                    "Access-Control-Allow-Origin": "http://localhost:5173"
                },
                "body": json.dumps({"error": f"Invalid voice: {voice}"})
            }

        user_id = event.get("requestContext", {}).get("authorizer", {}).get("claims", {}).get("sub", "anonymous")

        response = polly.synthesize_speech(Text=text, OutputFormat="mp3", VoiceId=voice)
        audio_stream = response.get("AudioStream")
        if audio_stream is None:
            return {
                "statusCode": 500,
                "headers": {
                    "Access-Control-Allow-Origin": "http://localhost:5173"
                },
                "body": json.dumps({"error": "Polly returned no audio"})
            }

        # --- Upload audio to S3 ---
        audio_bytes = audio_stream.read()
        audio_key = f"{user_id}/{uuid.uuid4()}.mp3"
        s3.put_object(Bucket=BUCKET_NAME, Key=audio_key, Body=audio_bytes, ContentType="audio/mpeg")

        # --- Save metadata to DynamoDB ---
        table = dynamodb.Table(TABLE_NAME)
        item = {
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "audio_key": audio_key,
            "text": text,
            "voice": voice
        }
        table.put_item(Item=item)

        # --- Generate a presigned URL for downloading the audio file ---
        audio_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET_NAME, "Key": audio_key},
            ExpiresIn=3600  # 1 hour
        )

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "http://localhost:5173"
            },
            "body": json.dumps({
                "message": "success",
                "audio_url": audio_url
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "http://localhost:5173"
            },
            "body": json.dumps({"error": str(e)})
        }
