# 🪔 Sakhi — Heritage Craft Marketplace & Artisan Enablement Platform

Welcome to **Sakhi**, a comprehensive digital ecosystem designed to connect India's heritage artisans with conscious buyers globally. Sakhi serves a dual purpose: providing an elegant, modern storefront for showcasing traditional crafts, and empowering artisans with powerful digital tools to manage their inventory, create their own storefronts, and verify the authenticity of their creations.

---

## 🏗️ Monorepo Architecture

Sakhi is organized as a monorepo consisting of multiple interconnected services and applications. Each part plays a vital role in creating a seamless experience for both the buyers and the creators.

### 1. 🛒 Marketplace (`/marketplace`)
The main e-commerce storefront for buyers. A modern web application built with a focus on aesthetics, speed, and seamless user experience.
- **Tech Stack:** Next.js 15 (App Router), Tailwind CSS v4, Drizzle ORM, Cloudflare D1
- **Features:** Dynamic artisan routing, GI (Geographical Indication) verified badges, fast edge-rendering, and visually stunning product grids with micro-animations.

### 2. 📱 Artisan Mobile App (`/Artisan-app`)
A dedicated mobile application tailored for the artisans to manage their inventory and interact with the platform seamlessly.
- **Tech Stack:** React Native (Expo), Skia, Reanimated
- **Features:** Camera integration for product capture, native performance, smooth animations, and easy inventory management.

### 3. ⚙️ Backend Services (`/backend`)
The core infrastructure that powers real-time interactions, data synchronization, and core API needs across the Sakhi ecosystem.
- **Tech Stack:** Cloudflare Workers, Hono, WebSockets, Drizzle ORM, Upstash Redis
- **Features:** Real-time WebSocket communication, low-latency edge computing, and scalable data management.

### 4. 🧠 Deep Research Agents (`/deep-research-agents`)
The *Kala-Mitra* Deep Research & Synthesis Engine. A sophisticated AI layer that performs deep research, data synthesis, and verification for artisan products.
- **Tech Stack:** Node.js, OpenAI API, PostgreSQL, Drizzle ORM, Upstash Redis
- **Features:** Automated product research, GI verification assistance, and rich data generation for heritage crafts.

### 5. 🎨 Artisan Pages (`/artisans-pages`)
A specialized toolset for generating standalone web pages or specific templates for individual artisans.
- **Tech Stack:** Vite, React, Express, Tailwind CSS, Replicate (AI generation)
- **Features:** AI-powered asset generation, dynamic page templates, and product data management for custom artisan portfolios.

### 6. 🏪 Storefront (`/storefront`)
An alternative Next.js application frontend, primarily serving as additional web scaffolding.
- **Tech Stack:** Next.js

---

## 🚀 Getting Started

To get started with the Sakhi ecosystem, you can navigate into individual directories. Each major application contains its own `package.json` and commands.

### Prerequisites
- **Node.js:** v18 or higher recommended.
- **Wrangler CLI:** For Cloudflare D1 and Workers deployment (`npm i -g wrangler`).
- **Expo CLI:** For the Artisan mobile application.

### Running the Marketplace locally:
```bash
cd marketplace
npm install

# Generate and apply local database migrations
npm run db:generate
npx wrangler d1 migrations apply sakhi-db --local

# Seed data and start the development server
npx wrangler d1 execute sakhi-db --local --file=./seed.sql
npm run dev
```
Visit `http://localhost:3000` to interact with the marketplace.

---

## 🌍 Vision & Mission

Sakhi (meaning "friend" or "companion") is built to be a true digital companion to artisans. By abstracting the complexities of modern e-commerce—from fast web performance and AI-generated copy to seamless database scaling at the edge—Sakhi allows artisans to focus on what they do best: creating timeless art.

---

## 📜 License
Private Project — All rights reserved.
