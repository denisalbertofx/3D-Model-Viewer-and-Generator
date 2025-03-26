# User Flow Documentation

## Overview
This document outlines the complete user flow for the 3D Generator platform, detailing each step from user registration to model export.

## 1. User Onboarding
### Registration/Login
- Users can register with email and password through the AuthModal component
- Existing users can sign in with their credentials
- User authentication is managed through Supabase Auth

### Plan Selection
- New users start with the Free tier (5 models per month)
- Upgrade options are presented on the pricing section
- Stripe integration handles payment processing securely
- Plans include: Free, Pro ($9.99/mo), and Enterprise ($29.99/mo)

## 2. Model Generation
### Prompt Input
- Users enter a text description in the prompt textarea
- Example: "A metallic sphere with a rough surface"
- Input validation ensures non-empty prompts

### Generation Process
- Backend sends the prompt to Meshy.ai API
- Edge function securely handles API communication
- User credits are deducted for each generation
- Generates 3D model in GLTF format by default

### Display
- Generated model is displayed in an interactive 3D viewer (ThreeScene)
- OrbitControls enable model rotation, zoom, and pan
- Loading state provides visual feedback during generation

## 3. Model Editing
### Transform Tools
- Scale: Adjust model size using slider
- Rotation: Control X, Y, Z rotation independently
- Material: Change color with color picker
- Wireframe: Toggle wireframe display mode

### Preview
- Real-time preview of all transformations
- ThreeScene component reflects changes immediately
- Changes are non-destructive to the original model

## 4. Export Process
### Format Selection
- Dropdown menu offers multiple export formats:
  - GLTF (.gltf) - Default
  - GLB (.glb)
  - OBJ (.obj)
  - FBX (.fbx)
  - STL (.stl)

### Download
- Direct download initiated from the browser
- File is named with model ID for reference
- Backend handles format conversion if needed

## 5. User Management
### Profile Management
- ProfileSettings component allows username updates
- Users can view and manage their subscription
- Displays current credit balance

### Model History
- Users can access their previously generated models
- Select and load past models from dropdown
- Delete unwanted models to free up storage

### Subscription Management
- User can upgrade/downgrade their subscription plan
- View current plan status and renewal date
- Access Stripe customer portal for payment methods

## Technical Flow
1. User makes authentication request through AuthModal
2. AuthModal communicates with Supabase Auth
3. On successful auth, loadProfile() and loadModels() are called
4. When user submits prompt, generateModel() calls Supabase Edge Function
5. Edge Function communicates with Meshy.ai API and returns model URL
6. Model renders in ThreeScene with applied transformations
7. User edits are applied through the ModelEditor component
8. Export request is processed through downloadModel() function
9. Subscription changes are handled by Stripe integration

## Next Steps
- Add multi-user collaboration features
- Implement advanced editing tools for Pro users
- Add model galleries for showcase and sharing
- Integrate a mobile app for on-the-go model viewing