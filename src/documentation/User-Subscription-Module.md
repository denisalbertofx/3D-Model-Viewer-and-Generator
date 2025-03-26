# User and Subscription Management Module

## Overview
This module extends the 3D Generator platform with comprehensive user management features and a subscription-based business model powered by Stripe. It enables role-based access control, tiered subscriptions, and automated credit allocation.

## Core Components

### User Management
- **Role-based Access Control**: User roles (user, designer, admin) with appropriate permissions
- **Profile Management**: Username, avatar, preferences, and model history
- **Authentication**: Email/password using Supabase Auth
- **Profile Settings**: User interface for managing account details

### Subscription System
- **Tiered Plans**: Free, Pro, and Enterprise with different credit allocations
- **Stripe Integration**: Secure payment processing and subscription management
- **Webhooks**: Automated handling of subscription events (creation, updates, cancellation)
- **Credit System**: Automatic credit allocation based on subscription tier
- **Billing Portal**: Customer self-service for managing billing details

## Database Schema Extensions

### Profile Table Enhancements
- Added role column (enum: user, designer, admin)
- Stripe-related fields: customer_id, subscription_id, status
- Subscription tracking: tier, status, end date

### New Tables
- **subscription_tiers**: Defines available plans and their features
- **subscription_history**: Tracks subscription changes for audit purposes

## Edge Functions

### subscription-checkout
- Creates Stripe checkout sessions for new subscriptions
- Associates user profiles with Stripe customers
- Handles free tier subscriptions without payment

### subscription-webhook
- Processes Stripe webhook events
- Updates user profiles based on subscription changes
- Manages credit allocation on renewal
- Handles subscription cancellations or failures

### subscription-portal
- Creates Stripe customer portal sessions
- Allows users to manage payment methods and subscription details

## User Interface
- **Profile Settings Component**: Tabbed interface for managing account details
- **Subscription Management**: View current plan, credits, and upgrade options
- **Model History**: Browse and manage previously generated models

## Flow
1. User registers an account (default: free tier)
2. User can upgrade to Pro or Enterprise tier via subscription checkout
3. On successful payment, subscription is activated and credits allocated
4. Monthly/yearly renewal automatically refreshes credits
5. User can manage subscription through customer portal

## Security
- Row Level Security (RLS) enforces role-based access
- Admin-only operations protected by RLS policies
- Secure handling of Stripe API keys via environment variables
- Webhook signature verification for secure event processing

## Next Steps
- Add team collaboration features for Enterprise tier
- Implement role-specific permissions in the UI
- Create admin dashboard for subscription management
- Add usage analytics and reporting