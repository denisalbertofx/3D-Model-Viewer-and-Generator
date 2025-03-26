// Follow Supabase Edge Function format
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Expose-Headers": "Content-Length, Content-Type"
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Get the model URL and auth token from query parameters
    const url = new URL(req.url);
    const modelUrl = url.searchParams.get("url");
    const authToken = url.searchParams.get("token");

    if (!modelUrl) {
      return new Response(
        JSON.stringify({ error: "Model URL is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    console.log("Proxying request for:", modelUrl);

    // Set up headers for the model request
    const headers = new Headers();
    
    // Always include the Meshy API key for their URLs regardless of other tokens
    if (modelUrl.includes("meshy.ai")) {
      const MESHY_API_KEY = Deno.env.get("MESHY_API_KEY") || "";
      if (MESHY_API_KEY) {
        console.log("Using Meshy API key for authentication");
        headers.set("Authorization", `Bearer ${MESHY_API_KEY}`);
      }
    } else if (authToken) {
      // For other URLs, use the provided auth token
      console.log("Using provided auth token");
      headers.set("Authorization", `Bearer ${authToken}`);
    }

    // Use user-agent to mimic a browser request
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
    headers.set("Accept", "*/*");

    console.log("Request headers:", Object.fromEntries(headers.entries()));

    // Fetch the model
    const modelResponse = await fetch(modelUrl, {
      headers,
      redirect: 'follow'
    });

    if (!modelResponse.ok) {
      console.error(`Model fetch failed: ${modelResponse.status} ${modelResponse.statusText}`);
      const errorText = await modelResponse.text();
      console.error("Error response:", errorText);
      
      return new Response(
        JSON.stringify({ 
          error: `Failed to fetch model: ${modelResponse.status} ${modelResponse.statusText}`,
          details: errorText
        }),
        {
          status: modelResponse.status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    // Get the model data
    const modelData = await modelResponse.arrayBuffer();
    
    // Determine content type
    let contentType = modelResponse.headers.get("Content-Type");
    if (!contentType) {
      // Set default content type based on URL extension
      if (modelUrl.endsWith('.glb')) {
        contentType = 'model/gltf-binary';
      } else if (modelUrl.endsWith('.gltf')) {
        contentType = 'model/gltf+json';
      } else if (modelUrl.endsWith('.obj')) {
        contentType = 'model/obj';
      } else if (modelUrl.endsWith('.fbx')) {
        contentType = 'model/fbx';
      } else if (modelUrl.endsWith('.stl')) {
        contentType = 'model/stl';
      } else {
        contentType = 'application/octet-stream';
      }
    }

    console.log("Response content type:", contentType);
    console.log("Response size:", modelData.byteLength);

    // Return the model data with appropriate headers
    return new Response(modelData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Length": modelData.byteLength.toString(),
        "Cache-Control": "public, max-age=31536000"
      }
    });

  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to proxy model request",
        stack: error.stack
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );
  }
});