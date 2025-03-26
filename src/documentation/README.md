# 3D Generator Platform Documentation

## Overview
This application is a micro-SaaS platform that enables users to generate high-quality 3D objects from text prompts. The platform is built with React, Three.js, and Supabase, offering a modern and intuitive interface for 3D model generation.

## Core Components

### Authentication (`src/components/auth/AuthModal.tsx`)
- Modal component for user authentication
- Handles both sign-in and sign-up flows
- Form validation and error handling
- Seamless integration with Supabase Auth

### ThreeScene (`src/components/scene/ThreeScene.tsx`)
The main 3D viewport component that renders the generated models.
- Uses `@react-three/fiber` for React integration with Three.js
- Implements `OrbitControls` for interactive model viewing
- Provides basic lighting setup for optimal model visualization
- Shows loading state during model generation
- Handles model display and interaction

### Button (`src/components/ui/button.tsx`)
A reusable button component with multiple variants and sizes:
- Variants: default, secondary, outline, ghost
- Sizes: default, sm, lg
- Fully accessible and keyboard navigable
- Styled with Tailwind CSS

## Main Features
1. Text-to-3D Generation
   - Input field for descriptive prompts
   - Real-time 3D preview with loading states
   - Credit system for model generation
   - Error handling and validation
   - Interactive model viewer

2. User Interface
   - Clean, modern design
   - Responsive layout
   - Intuitive controls

## Utilities

### Supabase Client (`src/lib/supabase.ts`)
- Singleton Supabase client instance
- Environment variable configuration

### Store (`src/lib/store.ts`)
- Global state management using Zustand
- User authentication state
- Model generation state and logic
- Profile management
- Authentication methods
- Credit management

### Utils (`src/lib/utils.ts`)
Helper functions for the application:
- `cn`: Combines Tailwind classes with proper precedence using `clsx` and `tailwind-merge`

## Dependencies
- @react-three/fiber: React renderer for Three.js
- @react-three/drei: Useful helpers for React Three Fiber
- three.js: 3D graphics library
- zustand: State management
- clsx & tailwind-merge: Utility styling helpers
- Lucide React: Icon library

## Database Schema

### Profiles Table
- Stores user profile information
- Links to Supabase auth.users
- Tracks subscription and credits

### Models Table
- Stores generated 3D models
- Links to user profiles
- Includes prompt and model data

## Security
- Row Level Security (RLS) enabled
- User-specific data access policies
- Secure authentication flow

## Next Implementations
2. Model Export Functionality
3. Subscription Management
4. Advanced Model Customization
5. Gallery and Model History