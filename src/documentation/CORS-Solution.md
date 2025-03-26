# CORS Solution Documentation

## Problem Overview

Our application was experiencing several "Failed to fetch" errors when trying to load 3D models directly from external URLs. These errors occurred because:

1. Modern browsers enforce Same-Origin Policy, which prevents web pages from making requests to domains different from the one that served the web page
2. In development environments like WebContainer, there are additional restrictions on accessing external resources
3. Many API providers don't include proper CORS headers that would allow direct access from browsers
4. Authentication tokens weren't being properly passed in the proxy chain

## Solution: Enhanced Edge Function Proxy

To solve this problem, we implemented an improved proxy pattern using a Supabase Edge Function that acts as an intermediary between our frontend application and external resources.

### How It Works

1. **Enhanced Edge Function Proxy**: We updated the `proxy-model` Edge Function to:
   - Accept a URL parameter with the location of the external 3D model
   - Accept an auth token parameter for authentication
   - Intelligently handle authentication for Meshy.ai by using our API key
   - Add proper CORS headers for browser compatibility
   - Make a server-side request to fetch the model (server-side requests aren't subject to CORS restrictions)
   - Return the model data with proper CORS headers to allow browser access
   - Include detailed logging for debugging

2. **Frontend Integration**: We updated our frontend components to:
   - Properly obtain current auth tokens from Supabase
   - Use the proxy URL with appropriate authentication
   - Add better error handling and reporting
   - Implement a robust error boundary for model loading failures

### Implementation Details

#### 1. The Enhanced Proxy Edge Function
The `proxy-model` Edge Function now handles:
- Retrieving the model URL and authentication token from query parameters
- Intelligently selecting the appropriate authentication method
- Fetching the model data using server-side requests
- Setting proper content types and CORS headers
- Providing detailed error information
- Returning the binary data to the client

```typescript
// Key improvements
if (modelUrl.includes("meshy.ai")) {
  // For Meshy.ai URLs, use the Meshy API key
  const MESHY_API_KEY = Deno.env.get("MESHY_API_KEY");
  if (MESHY_API_KEY) {
    headers.set("Authorization", `Bearer ${MESHY_API_KEY}`);
  }
} else if (authToken) {
  // For other URLs, use the provided auth token
  headers.set("Authorization", `Bearer ${authToken}`);
}
```

#### 2. ThreeScene Component Update
The ThreeScene component now properly obtains and uses auth tokens:

```typescript
// Set up proxy URL with auth token
useEffect(() => {
  const setupProxyUrl = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-model`;
      const params = new URLSearchParams({
        url: url,
        token: session.access_token
      });
      setProxyUrl(`${baseUrl}?${params.toString()}`);
    }
  };
  setupProxyUrl();
}, [url, supabase]);
```

#### 3. Fix for Missing handleViewModel in ProfileSettings
We added the missing `handleViewModel` function and implemented proper parameter passing:

```typescript
const handleViewModel = (model) => {
  setCurrentModel(model);
  onClose();
};
```

We also updated the ModelHistory component to receive the necessary callback functions:

```typescript
<ModelHistory 
  models={models} 
  onViewModel={handleViewModel} 
  onDownloadModel={handleDownload}
/>
```

## Benefits

This solution provides several advantages:

1. **Bypass CORS Restrictions**: The proxy allows us to access resources from any domain
2. **Security**: API keys and authentication remain on the server side
3. **Authentication**: Proper token handling for both Meshy.ai and user-specific resources
4. **Error Handling**: Centralized and detailed error handling for better debugging
5. **Content Type Management**: Ensures proper Content-Type headers for binary files

## Future Improvements

Potential enhancements to this solution:

1. **Caching**: Implement more sophisticated caching to reduce duplicate requests
2. **Rate Limiting**: Add rate limiting to prevent abuse of the proxy function
3. **Compression**: Add compression for large models to reduce bandwidth usage
4. **Advanced Authentication**: Support more authentication methods and providers