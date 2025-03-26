// Follow Supabase Edge Function format
import { createClient } from "npm:@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Meshy API configuration
const MESHY_API_KEY = Deno.env.get("MESHY_API_KEY") || "msy_FDE2VrseaOTDWEFYYwMiK91cHPgHccs7WmVj";
const MESHY_API_URL = "https://api.meshy.ai/openapi/v2/text-to-3d";

Deno.serve(async (req: Request) => {
  console.log("Received request to generate model");
  
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get request data
    const { prompt, userId } = await req.json();
    console.log("Request data:", { prompt, userId });
    
    if (!prompt) {
      console.error("Missing prompt in request");
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
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

    console.log("Checking user credits...");
    // Check user credits before proceeding
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);
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

    if (profile.credits < 1) {
      console.error("Insufficient credits:", profile.credits);
      return new Response(
        JSON.stringify({ error: "Insufficient credits" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    console.log("Calling Meshy API...");
    // Call Meshy API to generate 3D model
    const meshyResponse = await fetch(MESHY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MESHY_API_KEY}`,
      },
      body: JSON.stringify({
        mode: "preview",
        prompt: prompt,
        art_style: "realistic",
        should_remesh: true,
        topology: "triangle",
        target_polycount: 30000
      }),
    });

    if (!meshyResponse.ok) {
      const errorData = await meshyResponse.json();
      console.error("Meshy API error:", errorData);
      throw new Error(`Error en la API de Meshy: ${JSON.stringify(errorData)}`);
    }

    const meshyData = await meshyResponse.json();
    console.log("Respuesta de Meshy API:", meshyData);

    // Verificar que tenemos una URL válida del modelo
    const modelUrl = meshyData.model_url || meshyData.output?.glb_url || meshyData.output?.gltf_url;
    
    if (!modelUrl) {
      console.error("No se encontró URL del modelo en la respuesta:", meshyData);
      throw new Error("La API de Meshy no devolvió una URL válida del modelo");
    }

    console.log("URL del modelo encontrada:", modelUrl);

    // Create a new model record in the database
    const { data: model, error: modelError } = await supabase
      .from("models")
      .insert({
        user_id: userId,
        prompt: prompt,
        model_url: modelUrl,
        status: "completed",
        format: modelUrl.endsWith('.glb') ? 'glb' : 'gltf'
      })
      .select()
      .single();

    if (modelError) {
      console.error("Error en la base de datos:", modelError);
      throw new Error(`Error al crear el registro del modelo: ${modelError.message}`);
    }

    console.log("Registro del modelo creado:", model);

    // Deduct credits from user's profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ credits: profile.credits - 1 })
      .eq("id", userId);

    if (updateError) {
      console.error("Error al actualizar créditos:", updateError);
      // No lanzamos error aquí ya que el modelo ya fue generado
    }

    console.log("Generación del modelo completada exitosamente");
    return new Response(
      JSON.stringify({
        model_id: model.id,
        model_url: modelUrl,
        message: "Modelo generado exitosamente"
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
    console.error("Error in generate-model function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        details: error.stack
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