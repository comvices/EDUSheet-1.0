import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));

// Security Headers Middleware (safe for AI Studio iframe preview)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-XSS-Protection', '0');
  next();
});

// Ephemeral CSPRNG fallback guarantees per-instance unpredictability if SESSION_SECRET is unset
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface SessionTokenPayload {
  role: 'teacher' | 'student';
  userId: string;
  code: string;
  exp: number;
}

function signSessionToken(payload: SessionTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    const sigBuf = Buffer.from(sig, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionTokenPayload;
    if (!decoded || typeof decoded.exp !== 'number' || Date.now() > decoded.exp) {
      return null;
    }
    if (decoded.role !== 'teacher' && decoded.role !== 'student') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// Sliding-Window In-Memory Rate Limiter
function createRateLimiter(options: { windowMs: number; maxRequests: number; message: string }) {
  const buckets = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const now = Date.now();
    const cutoff = now - options.windowMs;
    const timestamps = (buckets.get(ip) || []).filter((t) => t > cutoff);

    if (timestamps.length >= options.maxRequests) {
      return res.status(429).json({
        error: 'มีการเรียกใช้งานถี่เกินกำหนด',
        message: options.message,
      });
    }

    timestamps.push(now);
    buckets.set(ip, timestamps);

    // Opportunistic cleanup to keep memory bounded
    if (buckets.size > 1000) {
      for (const [k, v] of buckets.entries()) {
        if (v.every((t) => t <= cutoff)) buckets.delete(k);
      }
    }

    next();
  };
}

const authSessionLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 30,
  message: 'มีการเข้าสู่ระบบหรือขอสิทธิ์บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
});

const aiApiLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 45,
  message: 'เรียกใช้งานระบบ AI ถี่เกินกำหนดชั่วคราว กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
});

function requireApiSession(allowedRoles: Array<'teacher' | 'student'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
      return res.status(401).json({
        error: 'ไม่ได้รับอนุญาต',
        message: 'เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
      });
    }

    if (!allowedRoles.includes(session.role)) {
      return res.status(403).json({
        error: 'ไม่มีสิทธิ์เข้าถึง',
        message: 'เฉพาะครูผู้สอนเท่านั้นที่สามารถใช้งานฟีเจอร์นี้ได้',
      });
    }

    (req as any).apiSession = session;
    next();
  };
}

// Issue HMAC-signed session token after client login
app.post('/api/auth/session', authSessionLimiter, (req, res) => {
  const { role, userId, code } = req.body || {};
  if ((role !== 'teacher' && role !== 'student') || typeof userId !== 'string' || !userId.trim()) {
    return res.status(400).json({ error: 'ข้อมูลเซสชันไม่ถูกต้อง' });
  }

  const token = signSessionToken({
    role,
    userId: userId.slice(0, 128),
    code: typeof code === 'string' ? code.slice(0, 64) : '',
    exp: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
  });

  return res.json({ success: true, token });
});

// Shared Gemini client factory
function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Settings > Secrets ของระบบ');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function normalizeAnswerText(val: unknown): string {
  return String(val ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

interface GradingQuestionInput {
  id: string;
  text: string;
  type: 'text' | 'multiple_choice' | 'fill_blank' | 'file_upload';
  options?: string[];
  maxPoints: number;
  answerKey?: string;
}

interface BatchSubmissionInput {
  submissionId: string;
  studentName?: string;
  studentCode?: string;
  answers?: Record<string, string>;
  files?: Array<{ name: string; size?: string }>;
}

interface GradedItemFeedback {
  questionIndex: number;
  questionId: string;
  status: 'correct' | 'partial' | 'incorrect' | 'unanswered';
  score: number;
  maxScore: number;
  comment: string;
}

interface GradedSubmissionResult {
  suggestedScore: number;
  maxPoints: number;
  recommendedStatus: 'graded' | 'needs_revision';
  overallFeedback: string;
  strengths: string[];
  improvements: string[];
  itemFeedback: GradedItemFeedback[];
}

interface PreparedGradingItem {
  questionIndex: number;
  id: string;
  type: GradingQuestionInput['type'];
  questionText: string;
  options: string[];
  answerKey: string;
  maxScore: number;
  studentAnswer: string;
  isUnanswered: boolean;
  deterministicMatch: boolean | null;
}

function formatGeminiErrorMessage(err: any): { statusCode: number; userMessage: string } {
  const rawMsg = String(err?.message || err || '');
  const lower = rawMsg.toLowerCase();

  if (rawMsg.includes('ยังไม่ได้ตั้งค่า GEMINI_API_KEY')) {
    return { statusCode: 400, userMessage: rawMsg };
  }
  if (rawMsg.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      statusCode: 429,
      userMessage:
        'โควตาการใช้งาน Gemini API ฟรีครบกำหนดชั่วคราวแล้ว (429 RESOURCE_EXHAUSTED) กรุณารอสักครู่แล้วลองใหม่ หรือเพิ่มคีย์แบบชำระเงินในเมนู Settings > Secrets',
    };
  }
  if (
    rawMsg.includes('403') ||
    rawMsg.includes('400') ||
    lower.includes('permission_denied') ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid')
  ) {
    return {
      statusCode: 403,
      userMessage:
        'API Key ของ Gemini ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน กรุณาตรวจสอบการตั้งค่าคีย์ใน Settings > Secrets',
    };
  }
  if (rawMsg.includes('404') || lower.includes('not_found')) {
    return {
      statusCode: 404,
      userMessage: 'ไม่พบโมเดล AI ที่เรียกใช้งาน กรุณาลองใหม่อีกครั้ง',
    };
  }
  return {
    statusCode: 500,
    userMessage: 'ไม่สามารถเชื่อมต่อระบบประเมินผล AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
  };
}

async function callGeminiJsonWithFallback(params: {
  ai: GoogleGenAI;
  prompt: string;
  systemInstruction: string;
  responseSchema: Record<string, any>;
}): Promise<any> {
  const { ai, prompt, systemInstruction, responseSchema } = params;

  const candidates: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
  ];

  let lastError: any = null;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const response = await ai.models.generateContent({
        model: candidate.model,
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
      const rawText = (response.text || '').trim();
      if (!rawText) {
        throw new Error('AI ไม่ส่งผลลัพธ์กลับมา');
      }
      return JSON.parse(rawText);
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err);
      const isQuotaOrOverload =
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('503') ||
        msg.includes('404');
      // Try next fallback model if available
      if (isQuotaOrOverload && i < candidates.length - 1) {
        console.warn(`Model ${candidate.model} unavailable (${msg.slice(0, 120)}), trying fallback model...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function prepareSubmissionItems(
  typedQuestions: GradingQuestionInput[],
  answers?: Record<string, string>,
  files?: Array<{ name: string; size?: string }>
): { preparedItems: PreparedGradingItem[]; attachedFiles: Array<{ name: string; size?: string }> } {
  const answerMap: Record<string, string> =
    answers && typeof answers === 'object' ? answers : {};
  const attachedFiles: Array<{ name: string; size?: string }> = Array.isArray(files)
    ? files
    : [];

  const preparedItems: PreparedGradingItem[] = typedQuestions.map((q, idx) => {
    const rawAnswer = (answerMap[q.id] ?? '').toString().trim();
    const qMax = Number(q.maxPoints) || 0;
    const key = (q.answerKey ?? '').toString().trim();

    const hasFilesForUpload = q.type === 'file_upload' && attachedFiles.length > 0;
    const isUnanswered =
      q.type === 'file_upload' ? !rawAnswer && !hasFilesForUpload : rawAnswer.length === 0;

    let deterministicMatch: boolean | null = null;
    if (!isUnanswered && key.length > 0) {
      if (q.type === 'multiple_choice') {
        deterministicMatch = normalizeAnswerText(rawAnswer) === normalizeAnswerText(key);
      } else if (
        q.type === 'fill_blank' &&
        normalizeAnswerText(rawAnswer) === normalizeAnswerText(key)
      ) {
        deterministicMatch = true;
      }
    }

    return {
      questionIndex: idx,
      id: q.id,
      type: q.type,
      questionText: q.text,
      options: q.options || [],
      answerKey:
        key || '(ครูไม่ได้ระบุเฉลยไว้ — ให้ประเมินตามความถูกต้องทางวิชาการอย่างยุติธรรม)',
      maxScore: qMax,
      studentAnswer: isUnanswered
        ? '[ไม่ได้ตอบ]'
        : rawAnswer || `(แนบไฟล์: ${attachedFiles.map((f) => f.name).join(', ')})`,
      isUnanswered,
      deterministicMatch,
    };
  });

  return { preparedItems, attachedFiles };
}

function finalizeGradedResult(
  preparedItems: PreparedGradingItem[],
  aiParsed: {
    overallFeedback?: string;
    strengths?: string[];
    improvements?: string[];
    itemFeedback?: Array<{
      questionIndex: number;
      status: string;
      score: number;
      comment: string;
    }>;
  },
  maxPoints?: number
): GradedSubmissionResult {
  const aiFeedbackMap = new Map<number, { status: string; score: number; comment: string }>();
  if (Array.isArray(aiParsed?.itemFeedback)) {
    for (const item of aiParsed.itemFeedback) {
      aiFeedbackMap.set(Number(item.questionIndex), item);
    }
  }

  const verifiedItemFeedback: GradedItemFeedback[] = preparedItems.map((item) => {
    const aiItem = aiFeedbackMap.get(item.questionIndex);
    let finalScore = Number(aiItem?.score ?? 0);
    let finalStatus = (aiItem?.status || 'incorrect').toLowerCase();
    let finalComment = (aiItem?.comment || '').trim();

    if (item.isUnanswered) {
      finalScore = 0;
      finalStatus = 'unanswered';
      if (!finalComment) {
        finalComment = 'นักเรียนยังไม่ได้ระบุคำตอบในข้อนี้ (0 คะแนน)';
      }
    } else if (item.deterministicMatch !== null) {
      if (item.deterministicMatch) {
        finalScore = item.maxScore;
        finalStatus = 'correct';
        if (!finalComment) {
          finalComment = `ตอบถูกต้องตรงตามเฉลย (${item.answerKey})`;
        }
      } else {
        finalScore = 0;
        finalStatus = 'incorrect';
        finalComment = `ตอบไม่ถูกต้อง (คำตอบที่เลือก: "${item.studentAnswer}" — เฉลยคือ: "${item.answerKey}")`;
      }
    } else {
      if (!Number.isFinite(finalScore)) finalScore = 0;
      finalScore = Math.max(0, Math.min(item.maxScore, Math.round(finalScore * 2) / 2));

      if (finalScore >= item.maxScore && item.maxScore > 0) {
        finalStatus = 'correct';
      } else if (finalScore > 0) {
        finalStatus = 'partial';
      } else {
        finalStatus = 'incorrect';
      }
    }

    return {
      questionIndex: item.questionIndex,
      questionId: item.id,
      status: finalStatus as GradedItemFeedback['status'],
      score: finalScore,
      maxScore: item.maxScore,
      comment: finalComment || 'ประเมินตามเกณฑ์ของใบงานเรียบร้อยแล้ว',
    };
  });

  const sumItemScores = verifiedItemFeedback.reduce((acc, it) => acc + it.score, 0);
  const sumQuestionMax = preparedItems.reduce((acc, it) => acc + it.maxScore, 0);
  const targetMaxPoints = Number(maxPoints) > 0 ? Number(maxPoints) : sumQuestionMax;

  let suggestedScore = sumItemScores;
  if (sumQuestionMax > 0 && targetMaxPoints !== sumQuestionMax) {
    suggestedScore = (sumItemScores / sumQuestionMax) * targetMaxPoints;
  }
  suggestedScore = Math.max(0, Math.min(targetMaxPoints, Math.round(suggestedScore * 2) / 2));

  const recommendedStatus =
    targetMaxPoints > 0 && suggestedScore / targetMaxPoints < 0.5 ? 'needs_revision' : 'graded';

  const correctCount = verifiedItemFeedback.filter((i) => i.status === 'correct').length;
  const unansweredCount = verifiedItemFeedback.filter((i) => i.status === 'unanswered').length;

  const fallbackOverall =
    unansweredCount === verifiedItemFeedback.length
      ? 'ยังไม่ได้ระบุคำตอบในใบงาน กรุณาทำใบงานให้ครบถ้วนและส่งใหม่อีกครั้ง'
      : `ทำถูกต้อง ${correctCount} จาก ${verifiedItemFeedback.length} ข้อ ได้คะแนนรวม ${suggestedScore}/${targetMaxPoints} คะแนน`;

  return {
    suggestedScore,
    maxPoints: targetMaxPoints,
    recommendedStatus,
    overallFeedback: aiParsed?.overallFeedback?.trim() || fallbackOverall,
    strengths: Array.isArray(aiParsed?.strengths) ? aiParsed.strengths.filter(Boolean) : [],
    improvements: Array.isArray(aiParsed?.improvements)
      ? aiParsed.improvements.filter(Boolean)
      : [],
    itemFeedback: verifiedItemFeedback,
  };
}

// API Route: AI Auto-Grading & Draft Feedback for Single Submission
app.post('/api/ai/grade', aiApiLimiter, requireApiSession(['teacher']), async (req, res) => {
  try {
    const {
      assignmentTitle,
      subject,
      gradeLevel,
      instructions,
      questions,
      answers,
      files,
      maxPoints,
    } = req.body;

    if (!assignmentTitle || !Array.isArray(questions) || questions.length === 0 || questions.length > 50) {
      return res.status(400).json({ error: 'ข้อมูลใบงานหรือรายการคำถามไม่ครบถ้วนหรือเกินขีดจำกัด (สูงสุด 50 ข้อ)' });
    }

    const ai = getAiClient();
    const typedQuestions = (questions as GradingQuestionInput[]).slice(0, 50);
    const { preparedItems, attachedFiles } = prepareSubmissionItems(
      typedQuestions,
      answers,
      files
    );

    const itemsForAi = preparedItems.filter(
      (item) => !item.isUnanswered && item.deterministicMatch === null
    );

    let aiParsed: any = {};
    if (itemsForAi.length > 0) {
      const compactPayload = itemsForAi.map((it) => ({
        questionIndex: it.questionIndex,
        type: it.type,
        questionText: it.questionText,
        answerKey: it.answerKey,
        maxScore: it.maxScore,
        studentAnswer: it.studentAnswer,
      }));

      const systemInstruction = `คุณคือผู้เชี่ยวชาญการตรวจใบงานไทย ตรวจอย่างรวดเร็ว เที่ยงตรง และกระชับ
กฎการให้คะแนนแต่ละข้อ:
1. fill_blank: เทียบความหมาย/คำศัพท์/ตัวเลขกับเฉลย ถูกครบได้เต็ม maxScore ถูกบางส่วนได้ตามสัดส่วน ผิดได้ 0
2. text (อัตนัย/วิธีทำ): ให้คะแนนตามประเด็นสำคัญจากเฉลยและหลักวิชา "${subject || 'ทั่วไป'}" ชั้น "${gradeLevel || 'มัธยมศึกษา'}" (เต็ม maxScore, บางส่วน .5, คัดลอกโจทย์หรือตอบไม่ตรงประเด็นได้ 0)
3. file_upload: ประเมินจากคำอธิบายและแนะนำให้ครูตรวจสอบไฟล์แนบเพิ่มเติม
4. comment ต่อข้อ: สั้น กระชับ ชัดเจน 1-2 ประโยคภาษาไทย
5. overallFeedback: สรุปภาพรวม 1-2 ประโยคภาษาไทย`;

      const prompt = `ใบงาน: "${assignmentTitle}" | วิชา: "${subject || '-'}" | ชั้น: "${gradeLevel || '-'}"
คำชี้แจง: "${instructions || '-'}"
ไฟล์แนบ: ${attachedFiles.length > 0 ? attachedFiles.map((f) => f.name).join(', ') : 'ไม่มี'}

รายการข้อที่ต้องประเมิน (${compactPayload.length} ข้อ):
${JSON.stringify(compactPayload)}`;

      aiParsed = await callGeminiJsonWithFallback({
        ai,
        prompt,
        systemInstruction,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallFeedback: {
              type: Type.STRING,
              description: 'สรุปภาพรวม 1-2 ประโยคภาษาไทย',
            },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'จุดแข็งสั้นๆ 1-2 ข้อ',
            },
            improvements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'ข้อเสนอแนะสั้นๆ 1-2 ข้อ',
            },
            itemFeedback: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionIndex: { type: Type.INTEGER },
                  status: {
                    type: Type.STRING,
                    description: '"correct" | "partial" | "incorrect"',
                  },
                  score: { type: Type.NUMBER },
                  comment: { type: Type.STRING },
                },
                required: ['questionIndex', 'status', 'score', 'comment'],
              },
            },
          },
          required: ['overallFeedback', 'strengths', 'improvements', 'itemFeedback'],
        },
      });
    }

    const result = finalizeGradedResult(preparedItems, aiParsed, maxPoints);
    return res.json({ success: true, result });
  } catch (err: any) {
    console.error('AI Grade error:', err);
    const formatted = formatGeminiErrorMessage(err);
    return res.status(formatted.statusCode).json({
      error: 'เกิดข้อผิดพลาดในการประเมินด้วย AI',
      message: formatted.userMessage,
    });
  }
});

// API Route: Single-Call Multi-Student Batch AI Auto-Grading
app.post('/api/ai/grade-batch', aiApiLimiter, requireApiSession(['teacher']), async (req, res) => {
  try {
    const {
      assignmentTitle,
      subject,
      gradeLevel,
      instructions,
      questions,
      maxPoints,
      submissions,
    } = req.body;

    if (
      !assignmentTitle ||
      !Array.isArray(questions) ||
      questions.length === 0 ||
      questions.length > 50 ||
      !Array.isArray(submissions) ||
      submissions.length === 0
    ) {
      return res.status(400).json({ error: 'ข้อมูลใบงานหรือรายชื่อการส่งงานไม่ครบถ้วน' });
    }

    const ai = getAiClient();
    const typedQuestions = (questions as GradingQuestionInput[]).slice(0, 50);
    const typedSubmissions = (submissions as BatchSubmissionInput[]).slice(0, 15);

    const preparedSubmissions = typedSubmissions.map((sub) => {
      const { preparedItems, attachedFiles } = prepareSubmissionItems(
        typedQuestions,
        sub.answers,
        sub.files
      );
      const itemsForAi = preparedItems.filter(
        (item) => !item.isUnanswered && item.deterministicMatch === null
      );
      return {
        sub,
        preparedItems,
        attachedFiles,
        itemsForAi,
      };
    });

    const subsNeedingAi = preparedSubmissions.filter((entry) => entry.itemsForAi.length > 0);
    const aiResultsMap = new Map<string, any>();

    // Pack ALL students needing AI evaluation into ONE single API request to maximize speed & preserve quota!
    if (subsNeedingAi.length > 0) {
      const sharedQuestionsMeta = typedQuestions.map((q, idx) => ({
        questionIndex: idx,
        type: q.type,
        questionText: q.text,
        answerKey:
          (q.answerKey ?? '').toString().trim() ||
          '(ครูไม่ได้ระบุเฉลยไว้ — ให้ประเมินตามความถูกต้องทางวิชาการอย่างยุติธรรม)',
        maxScore: Number(q.maxPoints) || 0,
      }));

      const studentAnswersBatch = subsNeedingAi.map((entry) => ({
        submissionId: entry.sub.submissionId,
        studentName: entry.sub.studentName || '',
        files: entry.attachedFiles.map((f) => f.name),
        answersToGrade: entry.itemsForAi.map((it) => ({
          questionIndex: it.questionIndex,
          studentAnswer: it.studentAnswer,
        })),
      }));

      const systemInstruction = `คุณคือผู้เชี่ยวชาญการตรวจใบงานไทย จงตรวจคำตอบของนักเรียนหลายคนพร้อมกันในครั้งเดียวอย่างเที่ยงตรง รวดเร็ว และกระชับ
กฎการให้คะแนน:
1. fill_blank: เทียบความหมาย/คำศัพท์/ตัวเลขกับเฉลย ถูกครบได้เต็ม maxScore ถูกบางส่วนได้ตามสัดส่วน ผิดได้ 0
2. text (อัตนัย/วิธีทำ): ประเมินเทียบกับเฉลยและหลักวิชา "${subject || 'ทั่วไป'}" ชั้น "${gradeLevel || 'มัธยมศึกษา'}" (เต็ม maxScore, บางส่วน .5, คัดลอกโจทย์/ไม่ตรงประเด็นได้ 0)
3. file_upload: ประเมินจากคำอธิบายและแนะนำให้ครูตรวจสอบไฟล์แนบ
4. comment ต่อข้อ: สั้นกระชับ 1 ประโยคภาษาไทย
5. overallFeedback ต่อคน: สรุปภาพรวม 1-2 ประโยคภาษาไทย`;

      const prompt = `ใบงาน: "${assignmentTitle}" | วิชา: "${subject || '-'}" | ชั้น: "${gradeLevel || '-'}"
คำชี้แจง: "${instructions || '-'}"

เกณฑ์โจทย์และเฉลย:
${JSON.stringify(sharedQuestionsMeta)}

คำตอบของนักเรียนที่ต้องประเมิน (${subsNeedingAi.length} คน):
${JSON.stringify(studentAnswersBatch)}

ส่งผลลัพธ์ในอาร์เรย์ results ให้ครบทุก submissionId`;

      const aiBatchParsed = await callGeminiJsonWithFallback({
        ai,
        prompt,
        systemInstruction,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  submissionId: { type: Type.STRING },
                  overallFeedback: { type: Type.STRING },
                  strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                  improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
                  itemFeedback: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        questionIndex: { type: Type.INTEGER },
                        status: { type: Type.STRING },
                        score: { type: Type.NUMBER },
                        comment: { type: Type.STRING },
                      },
                      required: ['questionIndex', 'status', 'score', 'comment'],
                    },
                  },
                },
                required: ['submissionId', 'overallFeedback', 'itemFeedback'],
              },
            },
          },
          required: ['results'],
        },
      });

      if (Array.isArray(aiBatchParsed?.results)) {
        for (const r of aiBatchParsed.results) {
          if (r?.submissionId) {
            aiResultsMap.set(String(r.submissionId), r);
          }
        }
      }
    }

    const results = preparedSubmissions.map((entry) => {
      const aiParsed = aiResultsMap.get(entry.sub.submissionId) || {};
      const result = finalizeGradedResult(entry.preparedItems, aiParsed, maxPoints);
      return {
        submissionId: entry.sub.submissionId,
        success: true,
        result,
      };
    });

    return res.json({
      success: true,
      results,
    });
  } catch (err: any) {
    console.error('AI Batch Grade error:', err);
    const formatted = formatGeminiErrorMessage(err);
    return res.status(formatted.statusCode).json({
      error: 'เกิดข้อผิดพลาดในการตรวจงานแบบกลุ่มด้วย AI',
      message: formatted.userMessage,
    });
  }
});

// API Route: AI Worksheet Generator for Teachers
app.post('/api/ai/generate-worksheet', aiApiLimiter, requireApiSession(['teacher']), async (req, res) => {
  try {
    const { subject, gradeLevel, topic, numberOfQuestions = 4 } = req.body;
    const cleanTopic = String(topic || '').trim().slice(0, 200);
    if (!cleanTopic) {
      return res.status(400).json({ error: 'กรุณาระบุหัวข้อเรื่องสำหรับสร้างใบงาน' });
    }
    const safeQuestionCount = Math.max(1, Math.min(20, Number(numberOfQuestions) || 4));
    const ai = getAiClient();

    const prompt = `คุณคือครูผู้เชี่ยวชาญด้านการออกแบบใบงานการเรียนการสอน (Worksheet Designer)
กรุณาสร้างใบงานออนไลน์วิชา "${String(subject || 'ทั่วไป').slice(0, 100)}" ระดับชั้น "${String(gradeLevel || 'ทั่วไป').slice(0, 50)}" ในหัวข้อเรื่อง "${cleanTopic}"
จำนวนข้อสอบ/โจทย์: ${safeQuestionCount} ข้อ

กรุณาส่งผลลัพธ์เป็น JSON Object ตาม schema โดยระบุเฉลยคำตอบ (answerKey) ที่ชัดเจนสำหรับใช้ตรวจงานด้วย`;

    const parsed = await callGeminiJsonWithFallback({
      ai,
      prompt,
      systemInstruction:
        'คุณคือผู้เชี่ยวชาญการออกแบบใบงานไทย สร้างคำถามและเฉลยคำตอบ (answerKey) ที่ชัดเจนถูกต้องทางวิชาการ',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          instructions: { type: Type.STRING },
          category: { type: Type.STRING },
          totalPoints: { type: Type.NUMBER },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING },
                type: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                maxPoints: { type: Type.NUMBER },
                answerKey: { type: Type.STRING },
              },
              required: ['id', 'text', 'type', 'maxPoints', 'answerKey'],
            },
          },
        },
        required: ['title', 'description', 'instructions', 'totalPoints', 'questions'],
      },
    });
    return res.json({ success: true, worksheet: parsed });
  } catch (err: any) {
    console.error('AI Generator error:', err);
    const formatted = formatGeminiErrorMessage(err);
    return res.status(formatted.statusCode).json({
      error: 'ไม่สามารถสร้างใบงานด้วย AI ได้ในขณะนี้',
      message: formatted.userMessage,
    });
  }
});

// API Route: AI Student Hint / Learning Assistant
app.post('/api/ai/hint', aiApiLimiter, requireApiSession(['teacher', 'student']), async (req, res) => {
  try {
    const { assignmentTitle, questionText, studentQuery } = req.body;
    const safeTitle = String(assignmentTitle || '').slice(0, 200);
    const safeQuestion = String(questionText || '').slice(0, 1000);
    const safeQuery = String(studentQuery || 'ขอคำใบ้หรืออธิบายหลักการทำข้อนี้หน่อยครับ').slice(0, 500);

    if (!safeQuestion.trim()) {
      return res.status(400).json({ error: 'กรุณาระบุโจทย์ที่ต้องการขอคำใบ้' });
    }

    const ai = getAiClient();

    const prompt = `คุณคือติวเตอร์ AI ใจดีและใจเย็น (AI Learning Coach)
นักเรียนกำลังทำใบงานเรื่อง: "${safeTitle}"
โจทย์ข้อที่ถาม: "${safeQuestion}"
คำถามหรือความสงสัยของนักเรียน: "${safeQuery}"

ข้อห้ามสำคัญ: ห้ามบอกคำตอบสุดท้ายโดยตรง แต่ให้คำแนะนำ ขั้นตอนความคิด หรือหลักการสำคัญที่จะช่วยให้นักเรียนสามารถคิดคำตอบได้ด้วยตัวเอง
ความยาวไม่เกิน 3-4 ประโยค ใช้ภาษาไทยที่เป็นกันเอง สุภาพ ให้กำลังใจ`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
    });

    return res.json({ success: true, hint: response.text });
  } catch (err: any) {
    console.error('AI Hint error:', err);
    const formatted = formatGeminiErrorMessage(err);
    return res.status(formatted.statusCode).json({
      error: 'ไม่สามารถขอคำใบ้ได้ในขณะนี้',
      message: formatted.userMessage,
    });
  }
});

// Setup Vite middleware in dev mode
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduSheet TH Server running on http://localhost:${PORT}`);
  });
}

startServer();
