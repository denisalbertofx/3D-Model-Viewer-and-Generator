import { createClient } from "npm:@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get request data
    const { modelId, format, userId } = await req.json();
    
    if (!modelId || !format || !userId) {
      return new Response(
        JSON.stringify({ error: "Model ID, format, and user ID are required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get model from database
    const { data: model, error: modelError } = await supabase
      .from("models")
      .select("*")
      .eq("id", modelId)
      .eq("user_id", userId)
      .single();

    if (modelError || !model) {
      return new Response(
        JSON.stringify({ error: "Model not found or access denied" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Check user profile for subscription status
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Check if format is allowed for the user's subscription tier
    // Free tier gets GLTF format only
    if (profile.subscription_tier === "free" && format.toLowerCase() !== "gltf") {
      return new Response(
        JSON.stringify({ 
          error: `Format ${format} not available in your current plan. Please upgrade to access more formats.` 
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Check if model is in storage or external
    let downloadUrl;
    if (model.file_path) {
      // The model is in our storage, create a signed URL
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("model-files")
        .createSignedUrl(model.file_path, 3600);
      
      if (signedUrlError) {
        return new Response(
          JSON.stringify({ error: `Failed to create signed URL: ${signedUrlError.message}` }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
      
      downloadUrl = signedUrlData.signedUrl;
    } else {
      // Use the external URL
      downloadUrl = model.model_url;
    }

    return new Response(
      JSON.stringify({
        downloadUrl,
        format,
        message: `Model ready for download in ${format.toUpperCase()} format`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
    
  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to export model" 
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});