import express from 'express';
import cors from 'cors';
import Replicate from 'replicate';
import dotenv from 'dotenv';
import multer from 'multer';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Set up memory storage for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Replicate API client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

app.post('/api/generate-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    console.log("Processing AI image generation request...");
    
    // Convert the uploaded file buffer to a Base64 data URI
    const mimeType = req.file.mimetype;
    const base64Str = req.file.buffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64Str}`;

    console.log("Calling Replicate (SDXL)...");
    
    // We use Stable Diffusion XL img2img
    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          image: dataUri,
          prompt: prompt + ", professional product photography, 4k, highly detailed",
          negative_prompt: "blurry, distorted, ugly, low quality, bad lighting",
          prompt_strength: 0.75, // Keeps ~25% of the original structure
          num_inference_steps: 40,
        }
      }
    );
    
    console.log("Success! Generated image output:", output);
    
    // Output is typically an array of URLs, we want the first one
    if (output && output.length > 0) {
      res.json({ imageUrl: output[0] });
    } else {
      throw new Error("No image generated from API");
    }
    
  } catch (err) {
    console.error("AI Generation failed:", err);
    res.status(500).json({ error: err.message || "Failed to generate image" });
  }
});

const PORT = process.env.PORT || 3001;

app.post('/api/export', async (req, res) => {
  try {
    const productData = req.body;
    if (!productData) {
      return res.status(400).json({ error: 'No product data provided' });
    }

    console.log("Starting website export process...");

    // 1. Save data to productData.json
    const dataPath = path.resolve('src', 'productData.json');
    await fs.writeFile(dataPath, JSON.stringify(productData, null, 2));
    console.log("Saved product data to src/productData.json");

    // 2. Run Vite build with Export Mode flag
    console.log("Running Vite build...");
    await new Promise((resolve, reject) => {
      // In Windows powershell/cmd, setting env vars inline is tricky, so we pass it in the env object
      const env = { ...process.env, VITE_EXPORT_MODE: 'true' };
      exec('npm run build', { env }, (error, stdout, stderr) => {
        if (error) {
          console.error("Build error:", stderr);
          return reject(error);
        }
        resolve(stdout);
      });
    });
    console.log("Vite build completed successfully!");

    // 3. Zip the dist directory
    const distPath = path.resolve('dist');
    
    // Set headers for file download
    res.attachment('generated-website.zip');
    
    // Some versions of archiver need .create() when imported via createRequire
    const archive = typeof archiver === 'function' 
      ? archiver('zip', { zlib: { level: 9 } }) 
      : archiver.create('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      throw err;
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // Append files from a sub-directory, putting its contents at the root of archive
    archive.directory(distPath, false);

    // Finalize the archive (i.e. we are done appending files)
    await archive.finalize();

  } catch (err) {
    console.error("Export failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Failed to export website" });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
