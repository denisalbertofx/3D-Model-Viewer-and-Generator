# Meshy API: Text to 3D

## Overview
This documentation outlines the Meshy API endpoints for generating 3D models from text prompts, which is integrated with our application.

## Endpoints

### Create Preview Task
**Endpoint:** `POST /openapi/v2/text-to-3d`

Creates a preview task to generate a 3D model from text.

**Required Parameters:**
- `mode` (string): Must be `"preview"`.
- `prompt` (string): Description of the 3D object.

**Optional Parameters:**
- `art_style` (string): `"realistic"` (default) or `"sculpture"`.
- `seed` (integer): For consistent results.
- `ai_model` (string): Model used (`"meshy-4"` by default).
- `topology` (string): `"quad"` (quadrangular mesh) or `"triangle"` (default).
- `target_polycount` (integer): Number of polygons, default `30,000`.
- `should_remesh` (boolean): Whether to remesh, default `true`.
- `symmetry_mode` (string): `"off"`, `"auto"` (default) or `"on"`.

**Example Request:**
```bash
curl https://api.meshy.ai/openapi/v2/text-to-3d \
  -H 'Authorization: Bearer ${YOUR_API_KEY}' \
  -H 'Content-Type: application/json' \
  -d '{
  "mode": "preview",
  "prompt": "a monster mask",
  "art_style": "realistic",
  "should_remesh": true
}'
```

**Expected Response:**
```json
{
  "result": "018a210d-8ba4-705c-b111-1f1776f7f578"
}
```

### Create Refinement Task
**Endpoint:** `POST /openapi/v2/text-to-3d`

Refines a 3D model from a previous preview task.

**Required Parameters:**
- `mode` (string): Must be `"refine"`.
- `preview_task_id` (string): ID of the completed preview task.

**Optional Parameters:**
- `enable_pbr` (boolean): Whether to generate PBR maps, default `false`.
- `texture_prompt` (string): Additional text for texture.

**Example Request:**
```bash
curl https://api.meshy.ai/openapi/v2/text-to-3d \
  -H 'Authorization: Bearer ${YOUR_API_KEY}' \
  -H 'Content-Type: application/json' \
  -d '{
  "mode": "refine",
  "preview_task_id": "018a210d-8ba4-705c-b111-1f1776f7f578",
  "enable_pbr": true
}'
```

**Expected Response:**
```json
{
  "result": "018a210d-8ba4-705c-b111-1f1776f7f578"
}
```

### Get Text to 3D Task
**Endpoint:** `GET /openapi/v2/text-to-3d/:id`

Gets the status and result of a specific task.

**Parameter:**
- `id` (string): Unique identifier of the task.

**Example Request:**
```bash
curl https://api.meshy.ai/openapi/v2/text-to-3d/018a210d-8ba4-705c-b111-1f1776f7f578 \
  -H "Authorization: Bearer ${YOUR_API_KEY}"
```

**Expected Response:**
```json
{
  "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
  "model_urls": {
    "glb": "https://assets.meshy.ai/.../model.glb",
    "fbx": "https://assets.meshy.ai/.../model.fbx",
    "obj": "https://assets.meshy.ai/.../model.obj"
  },
  "thumbnail_url": "https://assets.meshy.ai/.../preview.png",
  "prompt": "a monster mask",
  "progress": 100,
  "status": "SUCCEEDED"
}
```

### List Text to 3D Tasks
**Endpoint:** `GET /openapi/v2/text-to-3d`

Gets a list of tasks.

**Optional Parameters:**
- `page_num` (integer): Page number (default 1).
- `page_size` (integer): Items per page (maximum 50).
- `sort_by` (string): `"+created_at"` (ascending) or `"-created_at"` (descending).

**Example Request:**
```bash
curl https://api.meshy.ai/openapi/v2/text-to-3d?page_size=10 \
  -H "Authorization: Bearer ${YOUR_API_KEY}"
```

**Expected Response:**
```json
[
  {
    "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
    "prompt": "a monster mask",
    "progress": 100,
    "status": "SUCCEEDED"
  }
]
```

### Real-time Status Stream
**Endpoint:** `GET /openapi/v2/text-to-3d/:id/stream`

Provides real-time updates on task progress.

**Parameter:**
- `id` (string): Task identifier.

**Example Request:**
```bash
curl -N https://api.meshy.ai/openapi/v2/text-to-3d/018a210d-8ba4-705c-b111-1f1776f7f578/stream \
  -H "Authorization: Bearer ${YOUR_API_KEY}"
```

**Example Streaming Response:**
```
event: message
data: {
  "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
  "progress": 50,
  "status": "IN_PROGRESS"
}

event: message
data: {
  "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
  "progress": 100,
  "status": "SUCCEEDED"
}

event: error
data: {
  "status_code": 404,
  "message": "Task not found"
}
```

## Text to 3D Task Object

Represents a 3D model generation task.

**Key Properties:**
- `id` (string): Unique identifier.
- `model_urls` (object): Download URLs in formats (glb, fbx, obj, etc.).
- `prompt` (string): Description used.
- `art_style` (string): Chosen artistic style.
- `progress` (integer): Progress status (0-100).
- `status` (string): Status (PENDING, IN_PROGRESS, SUCCEEDED).
- `created_at` (timestamp): Creation date.
- `finished_at` (timestamp): Completion date.

## Integration with Our Application

In our application, we're using the `/v2/text-to-3d/generations` endpoint with the following configuration:
- Authorization using Bearer token
- Standard mode for quick 3D model generation
- Supporting both GLB and GLTF formats
- Response handling to extract the model URL correctly

See the implementation in `supabase/functions/generate-model/index.ts`.