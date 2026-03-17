/**
 * =============================================================
 * src/utils/aiUtils.ts – AI Services Integration Layer
 * =============================================================
 * Central module for all external AI API calls.
 * Every function is wrapped in try/catch with graceful fallbacks.
 *
 * FEATURES IMPLEMENTED:
 *  - Feature #1:  callRoboflow()              – pothole/garbage detection
 *  - Feature #1:  callGroqAnalysis()           – natural language description + category
 *  - Feature #2:  callFakeDetector()           – HuggingFace deepfake detection
 *  - Feature #3:  computeSeverityScore()       – multi-factor severity engine
 *  - Feature #4:  getWeatherData()             – OpenWeatherMap rain forecast
 *  - Feature #5:  callGroqWorkerAssignment()   – smart worker selection
 *  - Feature #6:  callGroqChatbot()            – contextual AI chatbot
 *  - Feature #8:  callGroqResolutionVerify()   – before/after comparison
 *  - Feature #10: callGroqTranslate()          – Tamil translation
 *  - Feature #11: callGroqWeeklySummary()      – PDF content generation
 *  - Feature #13: callGroqAnomalyExplanation() – anomaly banner text
 *  - reverseGeocode() – Nominatim address lookup with 1000ms delay
 *
 * ---------------------------------------------------------------
 * KEY FIX – LAZY Groq Initialization
 * ---------------------------------------------------------------
 * PROBLEM: Old code had `const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })`
 * at module top-level. Node.js imports this module BEFORE dotenv.config() runs
 * in index.ts, so GROQ_API_KEY is undefined at import time → Groq constructor throws.
 *
 * SOLUTION: getGroq() lazily creates the client on first actual API call,
 * by which time index.ts has already called dotenv.config().
 *
 * PACKAGE FIX: correct npm package name is 'groq-sdk' (not '@groq/groq-sdk').
 * Run: npm install groq-sdk
 * =============================================================
 */

import axios from 'axios';
// FIXED: correct npm package name is 'groq-sdk', NOT '@groq/groq-sdk'
import Groq from 'groq-sdk';
import fs from 'fs';
import FormData from 'form-data';
import {
  haversineDistance,
  isNearCriticalLocation,
  Coords,
} from './haversine';

// ==============================================================
// LAZY Groq Client – FIXED
// ==============================================================

/**
 * Groq model (keep configurable).
 * Default updated because `llama-3.1-70b-versatile` is decommissioned.
 */
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/** Module-level singleton – null until first actual API call */
let _groqClient: Groq | null = null;

/**
 * getGroq – Returns (or lazily creates) the Groq SDK singleton.
 *
 * Why lazy? This file is imported at module load time, which happens
 * before index.ts runs dotenv.config(). By deferring `new Groq(...)` to
 * the first actual function call, we guarantee the env vars are populated.
 *
 * Returns null with a warning if GROQ_API_KEY is still missing,
 * allowing each caller to return a graceful fallback response.
 */
function getGroq(): Groq | null {
  if (_groqClient) return _groqClient;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  GROQ_API_KEY not set – Groq AI features will be skipped');
    return null;
  }

  _groqClient = new Groq({ apiKey });
  console.log('✅ Groq client initialized');
  return _groqClient;
}

// ---- Type Definitions ----

export interface RoboflowDetection {
  class: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoboflowResponse {
  predictions: RoboflowDetection[];
  image: { width: number; height: number };
  time: number;
}

export interface GroqAnalysisResult {
  category: string;
  description: string;
  severity: number;
  tags: string[];
  tamilDescription: string;
}

export interface GroqPrefillResult {
  title: string;
  category: string;
  description: string;
  severity: number;
  tags: string[];
  approxSize: string;
  keyDetails: string[];
}

export interface WeatherData {
  rainProbabilityNext48h: number;
  description: string;
  temperature: number;
  city: string;
}

export interface WorkerAssignmentResult {
  topWorkerIds: string[];
  reasoning: string;
  routePolyline: Array<{ lat: number; lng: number }>;
}

// ==============================================================
// FEATURE #1 – Roboflow Computer Vision API
// Model: pothole-detection-in1d6/1 (free public model)
// ==============================================================

/**
 * callRoboflow – Sends image to Roboflow inference API.
 * Uses multipart/form-data for reliable binary upload.
 * Falls back to [] if API key missing or call fails.
 *
 * @param imagePath – Absolute local path to uploaded image
 */
export async function callRoboflow(
  imagePath: string
): Promise<RoboflowDetection[]> {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  ROBOFLOW_API_KEY not set – skipping vision detection');
    return [];
  }

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath));

    const response = await axios.post<RoboflowResponse>(
      `https://detect.roboflow.com/pothole-detection-in1d6/1?api_key=${apiKey}`,
      form,
      {
        headers: { ...form.getHeaders() },
        timeout: 15000,
      }
    );

    const detections = response.data.predictions || [];
    console.log(`🤖 Roboflow detected ${detections.length} objects`);
    return detections;
  } catch (err: unknown) {
    console.error('❌ Roboflow API error:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ==============================================================
// FEATURE #1 – Groq LLM Analysis & Auto-Categorization
// ==============================================================

/**
 * callGroqAnalysis – Uses Groq llama-3.1-70b-versatile to:
 *   1. Generate natural language description of the civic issue
 *   2. Auto-categorize into one of 5 categories
 *   3. Estimate severity 0-100
 *   4. Produce Tamil translation (Feature #10)
 *   5. Generate searchable tags
 *
 * Uses EXACT prompt template from the original requirements spec.
 *
 * @param detections      – Roboflow detection results
 * @param userDescription – Raw text from report form
 * @param language        – 'en' | 'ta'
 */
export async function callGroqAnalysis(
  detections: RoboflowDetection[],
  userDescription: string,
  language: 'en' | 'ta' = 'en'
): Promise<GroqAnalysisResult> {
  const defaultResult: GroqAnalysisResult = {
    category: 'Road Damage',
    description: userDescription,
    severity: 30,
    tags: [],
    tamilDescription: userDescription,
  };

  // FIXED: lazy init – safe to call after dotenv.config() has run
  const groq = getGroq();
  if (!groq) return defaultResult;

  const detectionsText =
    detections.length > 0
      ? detections
          .map(
            (d) =>
              `${d.class} (confidence: ${(d.confidence * 100).toFixed(1)}%, size: ${d.width}x${d.height}px)`
          )
          .join(', ')
      : 'No objects detected by vision model';

  // EXACT prompt from requirements spec:
  // "You are a civic AI analyst. Given these Roboflow detections: {detections}.
  //  Generate a natural Tamil/English description and choose one category from:
  //  Pothole, Garbage, Broken Street Light, Water Leakage, Road Damage.
  //  Also give severity 0-100. Output JSON."
  const prompt = `You are a civic AI analyst. Given these Roboflow detections: ${detectionsText}. Generate a natural ${language === 'ta' ? 'Tamil' : 'English'} description and choose one category from: Pothole, Garbage, Broken Street Light, Water Leakage, Road Damage. Also give severity 0-100. Output JSON.

Additional context from user: "${userDescription}"

Return ONLY this JSON (no markdown, no explanation):
{
  "category": "<one of: Pothole, Garbage, Broken Street Light, Water Leakage, Road Damage>",
  "description": "<2-3 sentence natural English description of the civic issue>",
  "tamilDescription": "<same description translated to Tamil>",
  "severity": <integer 0-100 based on detection size, type, and description>,
  "tags": ["<tag1>", "<tag2>", "<tag3>"]
}

Severity guide: 0-30 minor, 31-60 moderate, 61-80 serious, 81-100 critical.`;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const rawText = completion.choices[0]?.message?.content || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in Groq response');

    const parsed = JSON.parse(jsonMatch[0]) as GroqAnalysisResult;

    const validCategories = [
      'Pothole', 'Garbage', 'Broken Street Light', 'Water Leakage', 'Road Damage',
    ];
    if (!validCategories.includes(parsed.category)) parsed.category = 'Road Damage';
    parsed.severity = Math.max(0, Math.min(100, parsed.severity || 30));

    console.log(`🧠 Groq: category="${parsed.category}", severity=${parsed.severity}`);
    return parsed;
  } catch (err) {
    console.error('❌ Groq analysis error:', err instanceof Error ? err.message : err);
    return defaultResult;
  }
}

// ==============================================================
// FEATURE #1 – Groq LLM Prefill (upload-time auto-fill helper)
// ==============================================================
/**
 * callGroqPrefill – Used for upload-time form auto-fill.
 * Returns a suggested title + structured details such as approx size.
 * This is intentionally separate from callGroqAnalysis so the main
 * pipeline prompt/response shape stays unchanged.
 */
export async function callGroqPrefill(
  detections: RoboflowDetection[],
  userHint: string,
  language: 'en' | 'ta' = 'en'
): Promise<GroqPrefillResult> {
  const defaultResult: GroqPrefillResult = {
    title: userHint || 'Civic issue report',
    category: 'Road Damage',
    description: userHint || '',
    severity: 30,
    tags: [],
    approxSize: 'Unknown (insufficient visual signal)',
    keyDetails: [],
  };

  const groq = getGroq();
  if (!groq) return defaultResult;

  const detectionsText =
    detections.length > 0
      ? detections
          .map(
            (d) =>
              d.class +
              ' (confidence: ' +
              (d.confidence * 100).toFixed(1) +
              '%, bbox: ' +
              Math.round(d.width) +
              'x' +
              Math.round(d.height) +
              'px)'
          )
          .join(', ')
      : 'No objects detected by vision model';

  const prompt = [
    'You are a civic AI analyst helping pre-fill a report form.',
    'Given Roboflow detections: ' + detectionsText + '.',
    '',
    'Task:',
    '- Choose ONE category from: Pothole, Garbage, Broken Street Light, Water Leakage, Road Damage',
    '- Suggest a concise title (max 70 chars)',
    '- Write a 1-2 sentence description in ' + (language === 'ta' ? 'Tamil' : 'English'),
    '- Provide an approximate size string ONLY if you have enough signal from bbox size. If not, say "Unknown".',
    '  If category is Pothole or Road Damage, approxSize should look like: "Approx. medium (bbox 220x140px) — size unknown in meters"',
    '- Provide severity 0-100 (rough)',
    '- Provide 3-6 bullet keyDetails strings (short, factual, based on detections)',
    '',
    'User hint: "' + userHint + '"',
    '',
    'Return ONLY this JSON (no markdown):',
    '{',
    '  "title": "<string>",',
    '  "category": "<one of: Pothole, Garbage, Broken Street Light, Water Leakage, Road Damage>",',
    '  "description": "<string>",',
    '  "approxSize": "<string>",',
    '  "severity": <integer 0-100>,',
    '  "tags": ["<tag1>", "<tag2>"],',
    '  "keyDetails": ["<detail1>", "<detail2>"]',
    '}',
  ].join('\\n');

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 500,
    });

    const rawText = completion.choices[0]?.message?.content || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in Groq response');

    const parsed = JSON.parse(jsonMatch[0]) as GroqPrefillResult;

    const validCategories = [
      'Pothole', 'Garbage', 'Broken Street Light', 'Water Leakage', 'Road Damage',
    ];
    if (!validCategories.includes(parsed.category)) parsed.category = 'Road Damage';
    parsed.severity = Math.max(0, Math.min(100, parsed.severity || 30));
    parsed.title = (parsed.title || defaultResult.title).slice(0, 70);
    parsed.description = parsed.description || defaultResult.description;
    parsed.approxSize = parsed.approxSize || defaultResult.approxSize;
    parsed.tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [];
    parsed.keyDetails = Array.isArray(parsed.keyDetails) ? parsed.keyDetails.slice(0, 8) : [];

    return parsed;
  } catch (err) {
    console.error('❌ Groq prefill error:', err instanceof Error ? err.message : err);
    return defaultResult;
  }
}

// ==============================================================
// FEATURE #2 – HuggingFace Fake/Deepfake Detection
// Model: prithivMLmods/deepfake-detector-model-v1
// ==============================================================

/**
 * callFakeDetector – Sends image to HuggingFace Inference API.
 * Returns 0-100 probability that the image is fake/AI-generated.
 * Report is rejected in complaintController if score > 70.
 *
 * @param imagePath – Local image file path
 */
export async function callFakeDetector(imagePath: string): Promise<number> {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  HF_API_KEY not set – skipping fake detection');
    return 0;
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);

    const response = await axios.post(
      'https://api-inference.huggingface.co/models/prithivMLmods/deepfake-detector-model-v1',
      imageBuffer,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/octet-stream',
        },
        timeout: 20000,
      }
    );

    // Response: [{"label":"Fake","score":0.85},{"label":"Real","score":0.15}]
    const results = response.data as Array<{ label: string; score: number }>;
    const fakeResult = results.find((r) => r.label.toLowerCase() === 'fake');
    const fakeScore = fakeResult ? Math.round(fakeResult.score * 100) : 0;

    console.log(`🔍 Fake detection score: ${fakeScore}%`);
    return fakeScore;
  } catch (err) {
    // HF sometimes returns 410 when a model is not available on the hosted Inference API
    const status = (err as any)?.response?.status;
    if (status === 410) {
      console.warn('⚠️  HuggingFace Inference returned 410 – skipping fake detection');
      return 0;
    }
    console.error('❌ HuggingFace fake detector error:', err instanceof Error ? err.message : err);
    return 0;
  }
}

// ==============================================================
// FEATURE #3 – AI Severity & Impact Scoring Engine (pure fn)
// ==============================================================

/**
 * computeSeverityScore – Multi-factor severity computation.
 * Pure function – no API calls, runs synchronously.
 *
 * Factors:
 *   1. Base severity from Groq (0-100)
 *   2. Roboflow bbox size (+max 20)
 *   3. Near hospital/school (+15)
 *   4. Complaint density in 200m/30days (count×2, max +20)
 *   5. Rain >30% next 48h → score ×1.5 (capped 100)
 */
export function computeSeverityScore(params: {
  baseSeverity: number;
  detections: RoboflowDetection[];
  location: Coords;
  nearbyComplaintsCount: number;
  weatherData: WeatherData | null;
}): { score: number; factors: string[]; weatherImpact: boolean } {
  const factors: string[] = [];
  let score = params.baseSeverity;
  factors.push(`Base AI severity: ${score}/100`);

  if (params.detections.length > 0) {
    const avgArea =
      params.detections.reduce((sum, d) => sum + d.width * d.height, 0) /
      params.detections.length;
    const sizeFactor = Math.min(avgArea / 307200, 1) * 20;
    score += sizeFactor;
    factors.push(`Detection size factor: +${sizeFactor.toFixed(1)}`);
  }

  const criticalCheck = isNearCriticalLocation(params.location, 500);
  if (criticalCheck.near) {
    score += 15;
    factors.push(`Near critical location (${criticalCheck.locationName}): +15`);
  }

  if (params.nearbyComplaintsCount > 0) {
    const densityBoost = Math.min(params.nearbyComplaintsCount * 2, 20);
    score += densityBoost;
    factors.push(`Area density (${params.nearbyComplaintsCount} nearby): +${densityBoost}`);
  }

  let weatherImpact = false;
  if (params.weatherData && params.weatherData.rainProbabilityNext48h > 30) {
    score = Math.min(score * 1.5, 100);
    weatherImpact = true;
    factors.push(`Rain ${params.weatherData.rainProbabilityNext48h}% next 48h: ×1.5`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, factors, weatherImpact };
}

// ==============================================================
// FEATURE #4 – OpenWeatherMap Weather Integration
// ==============================================================

/**
 * getWeatherData – Fetches 48h rain forecast for a location.
 * Used by severity scoring + heatmap multiplier.
 *
 * @param lat – Latitude
 * @param lng – Longitude
 */
export async function getWeatherData(
  lat: number,
  lng: number
): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  OPENWEATHER_API_KEY not set – skipping weather');
    return null;
  }

  try {
    const response = await axios.get(
      'https://api.openweathermap.org/data/2.5/forecast',
      {
        params: { lat, lon: lng, appid: apiKey, units: 'metric', cnt: 16 },
        timeout: 8000,
      }
    );

    const forecasts = response.data.list || [];
    const rainProbs = forecasts
      .slice(0, 16)
      .map((f: { pop?: number }) => Math.round((f.pop || 0) * 100));
    const avgRainProb =
      rainProbs.length > 0
        ? Math.round(
            rainProbs.reduce((a: number, b: number) => a + b, 0) / rainProbs.length
          )
        : 0;

    const current = forecasts[0];
    const result: WeatherData = {
      rainProbabilityNext48h: avgRainProb,
      description: current?.weather?.[0]?.description || 'unknown',
      temperature: Math.round(current?.main?.temp || 25),
      city: response.data.city?.name || 'Chennai',
    };

    console.log(`🌧️  Weather: ${result.description}, rain: ${avgRainProb}%`);
    return result;
  } catch (err) {
    console.error('❌ OpenWeatherMap error:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ==============================================================
// FEATURE #5 – Groq Smart Worker Assignment
// ==============================================================

/**
 * callGroqWorkerAssignment – Groq prompt analyzes skills +
 * haversine distance + workload. Returns top-3 workers +
 * Leaflet polyline coordinates for route.
 *
 * @param workers         – Available worker profiles
 * @param complaint       – Complaint category/severity/description
 * @param complaintCoords – Complaint GPS location
 */
export async function callGroqWorkerAssignment(
  workers: Array<{
    id: string;
    name: string;
    skills: string[];
    location: Coords;
    workload: number;
  }>,
  complaint: { category: string; severity: number; description: string },
  complaintCoords: Coords
): Promise<WorkerAssignmentResult> {
  const defaultResult: WorkerAssignmentResult = {
    topWorkerIds: workers.slice(0, 3).map((w) => w.id),
    reasoning: 'Assigned based on proximity and availability.',
    routePolyline: [],
  };

  // FIXED: lazy init
  const groq = getGroq();
  if (!groq || workers.length === 0) return defaultResult;

  const workerProfiles = workers.map((w) => ({
    id: w.id,
    name: w.name,
    skills: w.skills.join(', '),
    distanceKm: haversineDistance(w.location, complaintCoords) / 1000,
    workload: w.workload,
  }));

  // EXACT spec: "Groq prompt analyzes skills + distance (haversine) + workload.
  // Return top-3 workers + Leaflet polyline coordinates for route."
  const prompt = `You are a city operations AI for Chennai, India. Analyze workers using skills, haversine distance from the complaint, and current workload. Return top-3 workers + Leaflet polyline coordinates for the route.

Complaint: Category="${complaint.category}", Severity=${complaint.severity}/100, Description="${complaint.description}", Location=[${complaintCoords.lat},${complaintCoords.lng}]

Available workers (haversine distances pre-computed):
${JSON.stringify(workerProfiles, null, 2)}

Skill-to-category mapping: Pothole/Road Damage→road-worker, Water Leakage→plumber, Broken Street Light→electrician, Garbage→sanitation.
Rank by: 1) skill match 2) shortest distance 3) lowest workload.

Return ONLY this JSON (no markdown):
{
  "topWorkerIds": ["<id1>", "<id2>", "<id3>"],
  "reasoning": "<2-3 sentences on skill match, distance, workload logic>",
  "routePolyline": [{"lat": <workerLat>, "lng": <workerLng>}, {"lat": ${complaintCoords.lat}, "lng": ${complaintCoords.lng}}]
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 300,
    });

    const rawText = completion.choices[0]?.message?.content || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in worker assignment response');

    const parsed = JSON.parse(jsonMatch[0]);

    const topWorker = workers.find((w) => w.id === parsed.topWorkerIds?.[0]);
    const fallback = topWorker
      ? [
          { lat: topWorker.location.lat, lng: topWorker.location.lng },
          { lat: complaintCoords.lat,    lng: complaintCoords.lng    },
        ]
      : [];

    return {
      topWorkerIds:  parsed.topWorkerIds  || defaultResult.topWorkerIds,
      reasoning:     parsed.reasoning     || defaultResult.reasoning,
      routePolyline:
        Array.isArray(parsed.routePolyline) && parsed.routePolyline.length >= 2
          ? parsed.routePolyline
          : fallback,
    };
  } catch (err) {
    console.error('❌ Groq worker assignment error:', err instanceof Error ? err.message : err);
    return defaultResult;
  }
}

// ==============================================================
// FEATURE #6 – Groq AI Chatbot
// ==============================================================

/**
 * callGroqChatbot – Role-aware conversational AI.
 * Citizens get civic reporting help; admins get analytics;
 * workers get task guidance. Supports Tamil (Feature #10).
 *
 * @param message  – User's message or voice transcript
 * @param role     – 'citizen' | 'admin' | 'worker'
 * @param language – 'en' | 'ta'
 * @param context  – Optional extra context string
 */
export async function callGroqChatbot(
  message: string,
  role: 'citizen' | 'admin' | 'worker',
  language: 'en' | 'ta' = 'en',
  context?: string
): Promise<string> {
  // FIXED: lazy init
  const groq = getGroq();
  if (!groq) {
    return language === 'ta'
      ? 'மன்னிக்கவும், AI சேவை தற்போது கிடைக்கவில்லை.'
      : 'Sorry, AI service is currently unavailable.';
  }

  const systemPrompts: Record<string, string> = {
    citizen: `You are CivicBot, a helpful assistant for Chennai's smart civic platform.
Help citizens report issues, track complaint status, earn civic points, and understand AI features.
If they mention a location issue (pothole, garbage, etc.), encourage them to use the GPS report button.
Keep responses concise (under 100 words). ${language === 'ta' ? 'Respond in Tamil.' : 'Respond in English.'}`,

    admin: `You are CivicBot for Admin. Help city administrators manage complaints, assign workers, and interpret AI analytics.
Context: ${context || 'No additional context'}.
${language === 'ta' ? 'Respond in Tamil.' : 'Respond in English.'}`,

    worker: `You are CivicBot for field workers. Help with assignments, location updates, and resolving complaints.
Be practical and brief. ${language === 'ta' ? 'Respond in Tamil.' : 'Respond in English.'}`,
  };

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompts[role] || systemPrompts.citizen },
        { role: 'user',   content: message },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    return completion.choices[0]?.message?.content || 'I could not process that request.';
  } catch (err) {
    console.error('❌ Groq chatbot error:', err);
    return 'Sorry, I am having trouble connecting to the AI service.';
  }
}

// ==============================================================
// FEATURE #8 – AI Resolution Verification
// ==============================================================

/**
 * callGroqResolutionVerify – Compares before/after complaint photos.
 * EXACT prompt from spec: "Compare before photo {url1} and after {url2}.
 * Return percentage fixed and suggestion."
 *
 * @param beforePhotoUrl  – Original complaint photo URL
 * @param afterPhotoUrl   – Worker's resolution photo URL
 * @param category        – Complaint category for context
 * @param pixelDiffScore  – Optional TF.js pixel diff score (0-100)
 */
export async function callGroqResolutionVerify(
  beforePhotoUrl: string,
  afterPhotoUrl: string,
  category: string,
  pixelDiffScore?: number
): Promise<{ fixedPercentage: number; suggestion: string; verified: boolean }> {
  // FIXED: lazy init
  const groq = getGroq();
  if (!groq) {
    return { fixedPercentage: 75, suggestion: 'Resolution appears satisfactory.', verified: true };
  }

  // EXACT prompt from requirements spec (Feature #8):
  // "Compare before photo {url1} and after {url2}. Return percentage fixed and suggestion."
  const prompt = `You are a civic quality inspector AI.
Compare before photo ${beforePhotoUrl} and after ${afterPhotoUrl}. Return percentage fixed and suggestion.

Issue category: "${category}"
${pixelDiffScore !== undefined ? `TensorFlow.js pixel difference score: ${pixelDiffScore}% (higher = more visual change detected)` : ''}

Return ONLY this JSON (no markdown):
{
  "fixedPercentage": <number 0-100>,
  "verified": <boolean – true if fixedPercentage >= 60>,
  "suggestion": "<'Resolution verified satisfactorily' OR brief further action needed>"
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 150,
    });

    const rawText = completion.choices[0]?.message?.content || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in resolution verify response');

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('❌ Groq resolution verify error:', err);
    return {
      fixedPercentage: pixelDiffScore || 60,
      suggestion: 'Manual review recommended.',
      verified: (pixelDiffScore || 0) > 40,
    };
  }
}

// ==============================================================
// FEATURE #10 – Multilingual Translation
// ==============================================================

/**
 * callGroqTranslate – Translates text to Tamil (or English) via Groq.
 *
 * @param text       – Source text
 * @param targetLang – 'ta' for Tamil, 'en' for English
 */
export async function callGroqTranslate(
  text: string,
  targetLang: 'ta' | 'en'
): Promise<string> {
  if (targetLang === 'en') return text;

  // FIXED: lazy init
  const groq = getGroq();
  if (!groq) return text;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: `Translate the following to ${targetLang === 'ta' ? 'Tamil' : 'English'}. Return ONLY the translation, nothing else:\n\n${text}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 300,
    });

    return completion.choices[0]?.message?.content?.trim() || text;
  } catch (err) {
    console.error('❌ Groq translation error:', err);
    return text;
  }
}

// ==============================================================
// FEATURE #11 – Groq Weekly Summary for PDF
// ==============================================================

/**
 * callGroqWeeklySummary – Generates 3-paragraph executive summary
 * for the weekly PDF report (pdf-lib). City-official language.
 *
 * @param stats – Aggregated weekly statistics
 */
export async function callGroqWeeklySummary(stats: {
  totalComplaints: number;
  resolved: number;
  pending: number;
  byCategory: Record<string, number>;
  avgSeverity: number;
  topAreas: string[];
  dateRange: string;
}): Promise<string> {
  // FIXED: lazy init
  const groq = getGroq();
  if (!groq) {
    return `Weekly Report ${stats.dateRange}\nTotal: ${stats.totalComplaints} complaints, ${stats.resolved} resolved.`;
  }

  const resolutionPct = Math.round(
    (stats.resolved / Math.max(stats.totalComplaints, 1)) * 100
  );

  const prompt = `You are a city analytics AI generating a weekly civic report for Chennai.
Statistics for ${stats.dateRange}:
- Total complaints: ${stats.totalComplaints}
- Resolved: ${stats.resolved} (${resolutionPct}%)
- Pending: ${stats.pending}
- By category: ${JSON.stringify(stats.byCategory)}
- Average severity: ${stats.avgSeverity}/100
- Top affected areas: ${stats.topAreas.join(', ')}

Write a professional 3-paragraph executive summary:
1. Overview of the week's performance
2. Key issues and hotspots
3. Recommendations for next week

Use clear, concise language suitable for city officials.`;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 600,
    });

    return completion.choices[0]?.message?.content || 'Summary generation failed.';
  } catch (err) {
    console.error('❌ Groq weekly summary error:', err);
    return `Weekly Report ${stats.dateRange}\nTotal: ${stats.totalComplaints} complaints, ${stats.resolved} resolved.`;
  }
}

// ==============================================================
// FEATURE #13 – Anomaly Detection Explanation
// ==============================================================

/**
 * callGroqAnomalyExplanation – Generates urgent admin alert text.
 * Triggered when >5 complaints cluster in 100m within 30 minutes.
 *
 * @param count    – Number of complaints in the cluster
 * @param category – Most common complaint category
 * @param location – Address/area name
 */
export async function callGroqAnomalyExplanation(
  count: number,
  category: string,
  location: string
): Promise<string> {
  // FIXED: lazy init
  const groq = getGroq();
  if (!groq) {
    return `⚠️ ANOMALY ALERT: ${count} ${category} reports in ${location} within 30 minutes. Immediate attention required.`;
  }

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: `Generate a brief (1-2 sentence) urgent alert for city administrators: 
${count} civic complaints of type "${category}" were reported within 100 meters in ${location} within the last 30 minutes. 
This may indicate a major infrastructure event. Be concise and actionable.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (err) {
    console.error('❌ Groq anomaly explanation error:', err);
    return `⚠️ ANOMALY: ${count} ${category} reports in ${location} within 30 minutes.`;
  }
}

// ==============================================================
// Nominatim Reverse Geocoding (Feature #1 – address lookup)
// ==============================================================

/** Tracks last call time to enforce Nominatim's 1 req/second policy */
let lastNominatimCall = 0;

/**
 * reverseGeocode – Converts GPS coordinates to a readable address.
 * Uses Nominatim (OpenStreetMap) – free, no API key required.
 * Enforces 1000ms minimum gap between calls per usage policy.
 *
 * @param lat – Latitude
 * @param lng – Longitude
 * @returns Address string or "lat, lng" fallback
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const now = Date.now();
    const elapsed = now - lastNominatimCall;
    if (elapsed < 1000) {
      await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
    }
    lastNominatimCall = Date.now();

    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { lat, lon: lng, format: 'json', addressdetails: 1 },
      headers: {
        'User-Agent': 'AI-SmartCivic/1.0 (hackathon-project)',
      },
      timeout: 8000,
    });

    if (response.data.display_name) {
      const parts = response.data.display_name.split(',').slice(0, 3);
      return parts.join(',').trim();
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (err) {
    console.error('❌ Nominatim error:', err instanceof Error ? err.message : err);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}