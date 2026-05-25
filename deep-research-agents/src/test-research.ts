import { runMarketResearch } from './agents/market-agent.js';
import { synthesizeAndStore } from './synthesis/engine.js';

/**
 * Runs the end-to-end Tier 2 deep research and synthesis pipeline:
 * 1. Executes Tavily market research crawls for 'Channapatna wooden toys'.
 * 2. Pipes raw search findings into OpenAI GPT-4o in strict JSON mode.
 * 3. Extracts structured insights, voice Kannada summaries, and roadmaps.
 * 4. Connects to Postgres and stores results in the database.
 * 5. Prints the complete generated outcome in the console.
 */
async function testResearchFlow() {
  const artisanId = "demo-artisan-999";
  const productCategory = "Channapatna wooden toys";

  console.log("=== STARTING TIER 2 DEEP RESEARCH TEST FLOW ===");
  console.log(`Target Artisan ID: ${artisanId}`);
  console.log(`Product Category: ${productCategory}`);

  try {
    // Check for environment variables
    if (!process.env.TAVILY_API_KEY) {
      throw new Error("Missing environment variable: TAVILY_API_KEY");
    }
    if (!process.env.LLM_API_KEY && !process.env.OPENAI_API_KEY) {
      throw new Error("Missing environment variable: LLM_API_KEY or OPENAI_API_KEY");
    }
    if (!process.env.BACKEND_API_URL) {
      console.log("[Test Setup] BACKEND_API_URL not specified. Defaulting to local Hono worker: http://127.0.0.1:8787");
    }

    // Step 1: Run Tavily Web Crawls
    console.log("\n[Test] Step 1: Executing runMarketResearch via Tavily...");
    const rawMarketData = await runMarketResearch(artisanId, productCategory);
    const resultsCount = rawMarketData.results?.length || 0;
    console.log(`-> Success! Tavily returned search results successfully! Results count: ${resultsCount}`);

    // Step 2: Synthesize and Store in Postgres
    console.log("\n[Test] Step 2: Synthesizing with GPT-4o and storing in PostgreSQL...");
    const result = await synthesizeAndStore(artisanId, rawMarketData);

    console.log("\n=== TEST SEQUENCE COMPLETED WITH SUCCESS! ===");
    console.log(`Postgres Saved Record ID: ${result.insightId}`);
    console.log(`\nGenerated Empathetic Kannada Digest (Voice Companion Summary):`);
    console.log(result.kannadaDigest);
    console.log(`\nGenerated 3-Point Actions Roadmap in Kannada:`);
    result.roadmap.forEach((item: string, index: number) => {
      console.log(`${index + 1}. ${item}`);
    });
  } catch (error: any) {
    console.error("\n[Test FATAL ERROR] E2E Research sequence failed:", error.message);
  }
}

testResearchFlow();
