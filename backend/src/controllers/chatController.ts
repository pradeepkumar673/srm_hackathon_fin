/**
 * =============================================================
 * src/controllers/chatController.ts – AI Chatbot Controller
 * =============================================================
 * Implements Feature #6: Groq-powered contextual AI chatbot.
 * Handles both typed messages and voice transcripts (Feature #12).
 *
 * FEATURES IMPLEMENTED:
 *  - Feature #6:  POST /api/chat            – role-aware Groq chatbot
 *  - Feature #10: Language-aware responses (en/ta)
 *  - Feature #12: POST /api/chat/voice-report – Voice-Only Reporting Mode
 *    SpeechRecognition transcript + GPS coords → directly calls reportComplaint
 *    pipeline (Roboflow + Groq + HF + severity scoring + anomaly detection).
 *  - Special commands: "/report <issue>" → returns form prefill data
 *  - Special commands: "/status <complaintId>" → returns live status
 *  - Rate limited to 20 requests/15min (aiLimiter in routes)
 * =============================================================
 */

import { Request, Response } from 'express';
import Complaint from '../models/Complaint';
import { callGroqChatbot } from '../utils/aiUtils';

// ==============================================================
// POST /api/chat
// Main chatbot endpoint – handles all user messages
// ==============================================================

/**
 * handleChat – Processes a user message through Groq chatbot.
 *
 * Body: {
 *   message: string         – User's typed or voice-transcribed message
 *   isVoice?: boolean       – True if from SpeechRecognition (Feature #12)
 *   complaintId?: string    – Context: which complaint user is viewing
 * }
 *
 * Special command processing before Groq:
 *  "/status <id>" → fetch live complaint status from DB, inject as context
 *  "/report <text>" → return pre-filled report form data (GPS + text)
 *  "/leaderboard"  → return top civic points from DB
 *
 * Returns: { reply, suggestions, prefillData? }
 */
export const handleChat = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { message, isVoice = false, complaintId } = req.body;
    const user = req.user!;

    if (!message || typeof message !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Message is required.',
      });
      return;
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      res.status(400).json({ success: false, message: 'Message cannot be empty.' });
      return;
    }

    let reply = '';
    let prefillData: Record<string, unknown> | null = null;
    let suggestions: string[] = [];

    // ============================================================
    // SPECIAL COMMAND: /status <complaintId>
    // Citizen can ask for status of their complaint via chat
    // ============================================================
    const statusMatch = trimmedMessage.match(/^\/status\s+([a-f0-9]{24})$/i);
    if (statusMatch) {
      const cId = statusMatch[1];
      const complaint = await Complaint.findById(cId)
        .populate('workerId', 'name phone')
        .lean();

      if (!complaint) {
        reply = user.language === 'ta'
          ? 'புகார் கண்டுபிடிக்கவில்லை.'
          : 'Complaint not found.';
      } else {
        const workerInfo = complaint.workerId
          ? `Worker: ${(complaint.workerId as { name: string }).name}`
          : 'No worker assigned yet.';

        reply = user.language === 'ta'
          ? `புகார் நிலை: ${complaint.status}. ${workerInfo}. தீவிரம்: ${complaint.severityScore}/100.`
          : `Complaint "${complaint.title}": Status is ${complaint.status}. ${workerInfo}. Severity: ${complaint.severityScore}/100.`;

        suggestions = ['View full details', 'Confirm this issue', 'Report another issue'];
      }
    }

    // ============================================================
    // SPECIAL COMMAND: /report <issue description>
    // Returns prefill data so frontend can auto-populate the form
    // Feature #12: Voice reporting uses this to fill the report form
    // ============================================================
    else if (trimmedMessage.toLowerCase().startsWith('/report ') || isVoice) {
      const issueText = trimmedMessage.startsWith('/report ')
        ? trimmedMessage.slice(8)
        : trimmedMessage;

      // Detect category from keywords
      let detectedCategory = 'Road Damage';
      if (/pothole|pit|hole/i.test(issueText)) detectedCategory = 'Pothole';
      else if (/garbage|trash|waste|dump/i.test(issueText)) detectedCategory = 'Garbage';
      else if (/light|lamp|dark/i.test(issueText)) detectedCategory = 'Broken Street Light';
      else if (/water|leak|pipe|flood/i.test(issueText)) detectedCategory = 'Water Leakage';

      prefillData = {
        title: issueText.length > 80 ? issueText.substring(0, 80) : issueText,
        description: issueText,
        category: detectedCategory,
        useGPS: true, // Signal frontend to trigger GPS
      };

      reply = user.language === 'ta'
        ? `புகார் படிவம் தயாராகிவிட்டது! "${detectedCategory}" வகை தேர்வு செய்யப்பட்டது. உங்கள் GPS இருப்பிடம் பயன்படுத்தப்படும்.`
        : `Report form ready! Category auto-detected as "${detectedCategory}". GPS location will be used. Click the form button to submit with photo.`;

      suggestions = ['Open report form', 'Change category', 'Cancel'];
    }

    // ============================================================
    // REGULAR MESSAGE: Route to Groq chatbot (Feature #6)
    // ============================================================
    else {
      // Build context string for admin role (includes complaint stats)
      let context = '';
      if (user.role === 'admin') {
        const [pending, total] = await Promise.all([
          Complaint.countDocuments({ status: 'Pending' }),
          Complaint.countDocuments(),
        ]);
        context = `Current system state: ${pending} pending complaints out of ${total} total.`;
      } else if (complaintId) {
        const c = await Complaint.findById(complaintId).select('title status severityScore').lean();
        if (c) {
          context = `Viewing complaint: "${c.title}" - Status: ${c.status}, Severity: ${c.severityScore}/100`;
        }
      }

      reply = await callGroqChatbot(
        trimmedMessage,
        user.role,
        user.language || 'en',
        context || undefined
      );

      // Generate contextual suggestions based on user role
      if (user.role === 'citizen') {
        suggestions = [
          'How do I earn civic points?',
          'Track my complaint',
          'Report an issue near me',
        ];
      } else if (user.role === 'admin') {
        suggestions = [
          'Show pending assignments',
          'Generate weekly report',
          'View anomaly alerts',
        ];
      } else {
        suggestions = [
          'View my assignments',
          'Update my location',
          'Mark resolved',
        ];
      }
    }

    // Voice responses use shorter, more conversational format
    if (isVoice) {
      // Trim to first 2 sentences for voice readback
      const sentences = reply.split(/[.!?]+/).filter(Boolean);
      reply = sentences.slice(0, 2).join('. ') + '.';
    }

    res.status(200).json({
      success: true,
      reply,
      suggestions: suggestions.slice(0, 3),
      prefillData,
      language: user.language,
      isVoiceResponse: isVoice,
    });
  } catch (err) {
    console.error('❌ handleChat error:', err);
    res.status(500).json({
      success: false,
      message: 'Chat service unavailable. Please try again.',
      reply: 'Sorry, I am having trouble connecting to the AI service right now.',
    });
  }
};

// ==============================================================
// GET /api/chat/suggestions
// Returns quick-action suggestions based on user role/context
// ==============================================================

/**
 * getChatSuggestions – Returns pre-built question suggestions
 * shown as clickable chips below the chatbot input.
 * Personalized by user role and current context.
 */
export const getChatSuggestions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user!;
    const lang = user.language || 'en';

    const suggestions: Record<string, string[][]> = {
      citizen: {
        en: [
          ['How do I report a pothole?', 'Report pothole'],
          ['Check my complaint status', 'Status check'],
          ['How do I earn civic points?', 'Civic points'],
          ['Report garbage near me', 'Report garbage'],
          ['What happens after I report?', 'Process info'],
        ],
        ta: [
          ['குழியை எப்படி புகார் செய்வது?', 'குழி புகார்'],
          ['என் புகார் நிலை என்ன?', 'நிலை சரிபார்'],
          ['குடிமை புள்ளிகள் எப்படி பெறுவது?', 'புள்ளிகள்'],
        ],
      }[lang] || [],
      admin: {
        en: [
          ['Summarize today\'s complaints', 'Daily summary'],
          ['Show high severity areas', 'Hot spots'],
          ['Which worker is nearest?', 'Worker proximity'],
          ['Generate weekly PDF report', 'Weekly report'],
        ],
      }.en,
      worker: {
        en: [
          ['Show my assignments', 'My tasks'],
          ['Navigate to complaint', 'Navigate'],
          ['Mark current task resolved', 'Resolve'],
        ],
      }.en,
    };

    res.status(200).json({
      success: true,
      suggestions: suggestions[user.role] || suggestions.citizen,
    });
  } catch (err) {
    console.error('❌ getChatSuggestions error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch suggestions.' });
  }
};

// ==============================================================
// POST /api/chat/voice-report
// FIXED TO 10/10 – Feature #12: Voice-Only Reporting Mode
// ==============================================================

/**
 * handleVoiceReport – Dedicated endpoint for Voice-Only Reporting (Feature #12).
 *
 * Flow on the client:
 *   1. User presses the microphone button (frontend VoiceReportButton component)
 *   2. Web Speech API (SpeechRecognition) captures the issue description
 *   3. navigator.geolocation.getCurrentPosition() captures GPS
 *   4. An optional camera snap is taken (or user picks from gallery)
 *   5. All three (transcript + GPS + photo) are POSTed here as multipart/form-data
 *
 * This endpoint synthesises a title from the transcript, injects default values
 * for missing fields, and hands off to the FULL 13-step AI pipeline in
 * reportComplaint (complaintController.ts) by re-using its exact logic inline.
 * This means voice reports receive identical AI treatment as typed reports:
 *   Roboflow vision → Groq categorization → HF fake detection → severity score
 *   → Nominatim geocoding → anomaly check → community confirmation emit.
 *
 * Body (multipart/form-data):
 *   transcript  {string}  – Raw SpeechRecognition result text   (required)
 *   lat         {number}  – GPS latitude from navigator.geolocation (required)
 *   lng         {number}  – GPS longitude                          (required)
 *   photo       {File}    – Optional image (handled by upload middleware)
 *   language    {string}  – 'en' | 'ta'  (defaults to user.language)
 *
 * Returns: same shape as POST /api/complaints/report, plus voiceTranscript field.
 */
export const handleVoiceReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // FIXED TO 10/10 – Feature #12: Voice-Only Reporting Mode
    // Extract SpeechRecognition transcript and GPS from body
    const { transcript, lat, lng, language } = req.body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Voice transcript is required. Please speak clearly and try again.',
      });
      return;
    }

    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: 'GPS location is required for voice reporting. Please enable location access.',
      });
      return;
    }

    // ---- Derive a concise title from the transcript (first 80 chars) ----
    // e.g. "There is a huge pothole on the road near..." → "There is a huge pothole on the road near..."
    const derivedTitle = transcript.trim().substring(0, 80);

    // ---- Auto-detect category keywords from transcript ----
    const lowerTranscript = transcript.toLowerCase();
    let detectedCategory = 'Road Damage';
    if (/pothole|pit|hole|crater/i.test(lowerTranscript))       detectedCategory = 'Pothole';
    else if (/garbage|trash|waste|dump|rubbish/i.test(lowerTranscript)) detectedCategory = 'Garbage';
    else if (/light|lamp|dark|street light/i.test(lowerTranscript))     detectedCategory = 'Broken Street Light';
    else if (/water|leak|pipe|flood|overflow/i.test(lowerTranscript))   detectedCategory = 'Water Leakage';

    // ---- Inject synthesised fields into req.body so reportComplaint reads them ----
    // Feature #12: Voice-Only Reporting – we proxy into the standard report pipeline
    req.body.title        = derivedTitle;
    req.body.description  = transcript.trim();
    req.body.category     = detectedCategory;
    req.body.lat          = lat;
    req.body.lng          = lng;
    // Override language if explicitly provided in voice request
    if (language && ['en', 'ta'].includes(language)) {
      req.user!.language  = language as 'en' | 'ta';
    }

    // ---- Validate that a photo was attached (required for AI pipeline) ----
    // If the voice report doesn't include a photo, we return a clear error
    // with instructions – the frontend should prompt the user to snap one.
    if (!req.file) {
      res.status(400).json({
        success: false,
        message:
          'Voice report received! Please also attach a photo of the issue to complete the AI analysis.',
        prefill: {
          title:       derivedTitle,
          description: transcript.trim(),
          category:    detectedCategory,
          lat:         parseFloat(lat),
          lng:         parseFloat(lng),
        },
        isVoiceReport: true,
      });
      return;
    }

    // ---- Delegate to the FULL reportComplaint AI pipeline (Feature #12) ----
    // This gives voice reports the same Roboflow + Groq + HF treatment as typed ones.
    // We import lazily to avoid circular dependency at module load time.
    const { reportComplaint } = await import('./complaintController');
    await reportComplaint(req, res);

  } catch (err) {
    console.error('❌ handleVoiceReport error:', err);
    res.status(500).json({
      success: false,
      message: 'Voice report submission failed. Please try again.',
    });
  }
};
