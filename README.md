# VisualScale 3D — Product-to-Revenue Studio

> **Live Application URL:** [https://visual-scale-ai.vercel.app](https://visual-scale-ai.vercel.app)

---

## 1. Problem Statement & Core Idea
**Target Audience:** E-commerce store owners, boutique digital brands, and online marketers.  
**The Problem:** Small e-commerce sellers struggle to create interactive 3D product experiences due to high rendering costs, complex 3D modeling tools, and expensive external API subscriptions. Furthermore, writing ad copy that accurately aligns with specific product features is time-consuming.  
**The Solution:** VisualScale 3D provides a free, end-to-end interactive studio. E-commerce merchants can upload a single 2D image, convert it into an interactive 360° .glb 3D model, interactively place dynamic hotspot callouts, auto-generate aligned ad copy using AI, and test garment outfits on models in one unified workspace.

---

## 2. Features List
- **AI-Powered 360° 3D Generation:** Turns flat 2D product photos into interactive .glb 3D meshes using Hugging Face cloud GPU inference.
- **Holographic HD Parallax Card:** Renders high-resolution 2D product cards with depth parallax for rapid visual inspection.
- **3D Asset Downloads:** Direct download options for generated 360° .glb models and HD Parallax cards.
- **Interactive Hotspot Annotations:** 
  - Single-click pin placement on models.
  - Double-click action menu to edit or reposition pins on mesh coordinates without camera drag conflicts.
  - Live bi-directional sync with the Hotspot Callouts management panel.
- **AI Auto-Hotspots:** Computer vision analysis that automatically detects key product features and places initial callout pins.
- **Aligned AI Marketing Campaign Studio:** Generates headlines, ad copy, and social hooks tailored specifically to active hotspot annotations.
- **Outfit Mix & Match Studio:** Try-on module supporting top and bottom clothing uploads on custom photos or preset AI models.

---

## 3. AI Features & System Instructions

### AI Engine 1: 3D Mesh Generation (Hugging Face / TRELLIS)
- **Model:** trellis-community/TRELLIS via @gradio/client
- **Function:** Receives 2D product image blobs and runs sparse-structure and structured-latent sampling to generate a sealed 360° .glb mesh file.

### AI Engine 2: Campaign Copy & Auto-Hotspot Alignment (Gemini API)
- **Model:** gemini-1.5-pro
- **System Instructions:**
  "You are an expert e-commerce marketing strategist and product reviewer. Analyze the provided product image and the list of active hotspot feature labels. 
  1. Identify 3-5 key product highlight callouts based on visual geometry if none exist.
  2. Generate a cohesive marketing campaign consisting of 1 High-Converting Headline, 3 Social Media Hooks, and a Product Description.
  3. CONSTRAINT: Every piece of generated copy MUST directly reference and align with the visual hotspot callout labels provided."

---

## 4. Tools, Services & Frameworks Used
- **Frontend & App Builder:** React, TypeScript, Tailwind CSS, Lovable
- **3D Rendering & Viewport:** <model-viewer>, WebGL, Three.js
- **AI Cloud Services:** 
  - Hugging Face Inference API (@gradio/client)
  - Google Gemini API (@google/generative-ai)
- **Hosting & Deployment:** Vercel

---

## 5. Local Setup & Running Instructions

### 1. Clone the repository:
git clone [https://github.com/amk00079/visual-scale-ai.git](https://github.com/amk00079/visual-scale-ai.git)
cd visual-scale-ai

### 2. Install dependencies:
npm install

### 3. Configure Environment Variables:
Create a .env file in the root directory:
VITE_GEMINI_API_KEY=your_gemini_api_key_here
HF_TOKEN=your_huggingface_token_here

### 4. Run local development server:
npm run dev
