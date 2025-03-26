# API Integration Documentation

## Overview
This document outlines the integration of third-party APIs in our 3D Generator application. These integrations enable core functionality like 3D model generation, payment processing, and user authentication.

## Meshy API Integration

### Purpose
Meshy AI API is used for text-to-3D model generation, allowing users to create 3D models from natural language descriptions.

### Implementation
The integration is implemented in the `generate-model` Supabase Edge Function, which acts as a secure proxy between our frontend and Meshy's API.

### Key Features
- Secure API key handling through server-side calls
- Credit management for users
- Model storage and tracking
- Error handling and response normalization

### Authentication
We use Bearer token authentication with the Meshy API:
```javascript
const meshyResponse = await fetch(MESHY_API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${MESHY_API_KEY}`,
  },
  body: JSON.stringify({
    prompt: prompt,
    negative_prompt: "low quality, distorted, blurry",
    style: "normal",
    mode: "standard"
  }),
});
```

### Response Handling
The Edge Function processes the API response to extract the model URL and save it to our database:
```javascript
const modelUrl = meshyData.output?.glb_url || meshyData.output?.gltf_url || meshyData.model_url;

if (!modelUrl) {
  throw new Error("No model URL returned from Meshy API");
}

// Save model to database
const { data: model, error: modelError } = await supabase
  .from("models")
  .insert({
    user_id: userId,
    prompt: prompt,
    model_url: modelUrl,
    format: "gltf"
  })
  .select()
  .single();
```

## Stripe API Integration

### Purpose
Stripe handles our payment processing for subscription plans, enabling users to upgrade to premium tiers.

### Implementation
The integration is implemented through Supabase Edge Functions:
- `subscription-checkout` - Creates checkout sessions for new subscriptions
- `subscription-webhook` - Processes webhook events from Stripe
- `subscription-portal` - Creates customer portal sessions for subscription management

### Authentication
We use the Stripe secret key for server-side API calls:
```javascript
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});
```

### Key Features
- Secure handling of customer payment information
- Subscription creation and management
- Webhook processing for subscription lifecycle events
- Credit allocation based on subscription tier

## Supabase Integration

### Purpose
Supabase provides our backend infrastructure, including:
- User authentication
- Database storage
- Edge Functions for API integrations
- Row-level security policies

### Key Components
- Authentication for user management
- Database for storing models, user profiles, and subscription data
- Storage for uploaded files
- Edge Functions for secure API calls

### Security
All API integrations use server-side Edge Functions to:
- Keep API keys secure
- Validate user permissions
- Enforce business logic
- Handle errors gracefully

## Error Handling

All API integrations include comprehensive error handling:
- Specific error messages for different failure scenarios
- Proper HTTP status codes
- Error logging for debugging
- User-friendly error responses

## Future Enhancements

Planned improvements to our API integrations:
- Caching mechanisms to improve performance
- Retry logic for transient failures
- More granular error handling
- Extended logging for better observability