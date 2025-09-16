provider "aws" {
  region = "us-east-1"
}

# Cognito User Pool
resource "aws_cognito_user_pool" "this" {
  name = "${var.project_name}-user-pool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_uppercase = true
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
  }

  mfa_configuration = "OFF"
}

# Cognito User Pool Client
resource "aws_cognito_user_pool_client" "this" {
  name            = "${var.project_name}-client"
  user_pool_id    = aws_cognito_user_pool.this.id
  generate_secret = false

  allowed_oauth_flows                   = ["code"]
  allowed_oauth_scopes                  = ["openid", "profile", "email"]
  allowed_oauth_flows_user_pool_client = true
  callback_urls                         = ["http://localhost:5173/dashboard"]
  logout_urls                           = ["http://localhost:5173"]
  supported_identity_providers         = ["COGNITO"]
}

# Cognito Domain (Hosted UI)
resource "aws_cognito_user_pool_domain" "this" {
  domain       = "${var.project_name}-login"
  user_pool_id = aws_cognito_user_pool.this.id
}

# API Gateway HTTP API with CORS
resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["OPTIONS", "POST", "GET"]
    allow_headers = ["Content-Type", "Authorization"]
    expose_headers = []
    max_age       = 600
  }
}

# JWT Authorizer for API Gateway
resource "aws_apigatewayv2_authorizer" "cognito_auth" {
  api_id          = aws_apigatewayv2_api.http_api.id
  name            = "${var.project_name}-cognito-auth"
  authorizer_type = "JWT"

  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.this.id]
    issuer   = "https://cognito-idp.us-east-1.amazonaws.com/${aws_cognito_user_pool.this.id}"
  }
}

# Lambda Function (make sure your handler is zipped and uploaded)
resource "aws_lambda_function" "convert" {
  function_name = "${var.project_name}-convert"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.9"

  filename         = "../backend/convert/convert.zip"
  source_code_hash = filebase64sha256("../backend/convert/convert.zip")

  environment {
    variables = {
      BUCKET_NAME = aws_s3_bucket.audio.bucket
      TABLE_NAME  = aws_dynamodb_table.history.name
    }
  }
}

# API Gateway Integration for Lambda
resource "aws_apigatewayv2_integration" "convert_integration" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.convert.invoke_arn
}

# API Gateway Route with JWT authorization
resource "aws_apigatewayv2_route" "convert_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "POST /convert"
  target    = "integrations/${aws_apigatewayv2_integration.convert_integration.id}"

  authorizer_id      = aws_apigatewayv2_authorizer.cognito_auth.id
  authorization_type = "JWT"
}

# Permission for API Gateway to invoke Lambda
resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.convert.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# IAM Role for Lambda Execution
resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "polly_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonPollyFullAccess"
}

resource "aws_iam_role_policy_attachment" "s3_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_role_policy_attachment" "dynamodb_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

# Random suffix for unique bucket name
resource "random_id" "suffix" {
  byte_length = 4
}

# S3 Bucket for audio files
resource "aws_s3_bucket" "audio" {
  bucket = "${var.project_name}-audio-files-${random_id.suffix.hex}"
  tags   = { Name = "tts-audio-bucket" }

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "PublicReadGetObject",
        Effect    = "Allow",
        Principal = "*",
        Action    = "s3:GetObject",
        Resource  = "arn:aws:s3:::${var.project_name}-audio-files-${random_id.suffix.hex}/*"
      }
    ]
  })
}

# DynamoDB Table for history
resource "aws_dynamodb_table" "history" {
  name         = "${var.project_name}-history"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "timestamp"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }
}

# Outputs
output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.this.id
}

output "cognito_domain" {
  value = aws_cognito_user_pool_domain.this.domain
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.http_api.api_endpoint
}

output "s3_bucket_name" {
  value = aws_s3_bucket.audio.bucket
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.history.name
}
