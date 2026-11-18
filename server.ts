import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

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

// API Route: AI Auto-Grading & Draft Feedback for Teachers
app.post('/api/ai/grade', async (req, res) => {
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

    if (!assignmentTitle || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'ข้อมูลใบงานหรือรายการคำถามไม่ครบถ้วน' });
    }

    const ai = getAiClient();
    const typedQuestions = questions as GradingQuestionInput[];
    const answerMap: Record<string, string> = answers && typeof answers === 'object' ? answers : {};
    const attachedFiles: Array<{ name: string; size?: string }> = Array.isArray(files) ? files : [];

    // Prepare structured items with deterministic pre-evaluation for objective & blank items
    const preparedItems = typedQuestions.map((q, idx) => {
      const rawAnswer = (answerMap[q.id] ?? '').toString().trim();
      const qMax = Number(q.maxPoints) || 0;
      const key = (q.answerKey ?? '').toString().trim();

      const hasFilesForUpload = q.type === 'file_upload' && attachedFiles.length > 0;
      const isUnanswered = q.type === 'file_upload' ? !rawAnswer && !hasFilesForUpload : rawAnswer.length === 0;

      let deterministicMatch: boolean | null = null;
      if (!isUnanswered && q.type === 'multiple_choice' && key.length > 0) {
        deterministicMatch = normalizeAnswerText(rawAnswer) === normalizeAnswerText(key);
      }

      return {
        questionIndex: idx,
        id: q.id,
        type: q.type,
        questionText: q.text,
        options: q.options || [],
        answerKey: key || '(ครูไม่ได้ระบุเฉลยไว้ — ให้ประเมินตามความถูกต้องทางวิชาการอย่างยุติธรรม)',
        maxScore: qMax,
        studentAnswer: isUnanswered
          ? '[ไม่ได้ตอบ]'
          : rawAnswer || `(แนบไฟล์: ${attachedFiles.map((f) => f.name).join(', ')})`,
        isUnanswered,
        deterministicMatch,
      };
    });

    const systemInstruction = `คุณคือครูผู้เชี่ยวชาญในการตรวจใบงานของโรงเรียนไทย (AI Grading Specialist)
หน้าที่ของคุณคือประเมินคำตอบของนักเรียน **อย่างเที่ยงตรง ยุติธรรม และแม่นยำตามหลักวิชาการ** ทีละข้อเทียบกับเฉลย/เกณฑ์การตรวจ

กฎเหล็กในการให้คะแนนแต่ละข้อ (ต้องปฏิบัติตามอย่างเคร่งครัด):
1. **ไม่ได้ตอบ / เว้นว่าง ("[ไม่ได้ตอบ]")**: ต้องได้ **0 คะแนน** เสมอ สถานะ "unanswered" ห้ามให้คะแนนสงสารเด็ดขาด
2. **ข้อสอบปรนัย (multiple_choice)**:
   - หากตรงกับเฉลย (answerKey) ให้คะแนนเต็ม maxScore และสถานะ "correct"
   - หากไม่ตรงกับเฉลย ให้ **0 คะแนน** เสมอ และสถานะ "incorrect" พร้อมอธิบายสั้นๆ ว่าคำตอบที่ถูกต้องตามเฉลยคืออะไร
3. **เติมคำในช่องว่าง (fill_blank)**:
   - ตรวจสอบความถูกต้องของคำศัพท์/ตัวเลข/แนวคิดเทียบกับเฉลย
   - หากถูกครบถ้วนหรือมีความหมายตรงตามหลักวิชาการ (แม้สะกดต่างกันเล็กน้อยหรือใช้คำพ้องความหมายที่ถูกต้อง) ให้เต็ม maxScore
   - หากตอบถูกเพียงบางส่วน ให้คะแนนตามสัดส่วน (status: "partial")
   - หากตอบผิดหรือไม่เกี่ยวข้อง ให้ 0 คะแนน (status: "incorrect")
4. **อัตนัย / แสดงวิธีทำ / เรียงความ (text)**:
   - วิเคราะห์องค์ประกอบสำคัญ (Rubric / Key Points) จากเฉลยหรือหลักวิชาการของวิชา "${subject || 'ทั่วไป'}" ระดับชั้น "${gradeLevel || 'มัธยมศึกษา'}"
   - ให้คะแนนเต็มเฉพาะเมื่อตอบถูกต้องและครบถ้วนตามประเด็นสำคัญ
   - หากถูกบางส่วน ขาดรายละเอียดสำคัญ หรือแสดงวิธีทำถูกแต่คิดเลขผิดบางขั้น ให้คะแนนตามสัดส่วนอย่างสมเหตุสมผล (status: "partial") พร้อมระบุชัดเจนว่าส่วนใดถูกและส่วนใดขาด/ผิด
   - หากคัดลอกโจทย์มาตอบโดยไม่ตอบคำถาม ตอบมั่ว ไม่ตรงประเด็น หรือผิดหลักการโดยสิ้นเชิง ให้ **0 คะแนน** (status: "incorrect")
5. **แนบไฟล์ (file_upload)**:
   - หากนักเรียนเขียนอธิบายหรือแนบไฟล์มา ให้ประเมินจากคำอธิบายที่มีและแนะนำให้ครูตรวจสอบไฟล์แนบเพิ่มเติม
6. **ขอบเขตคะแนน**: คะแนนของแต่ละข้อ ("score") ต้องอยู่ระหว่าง 0 ถึง maxScore ของข้อนั้นเท่านั้น (ใช้เลขจำนวนเต็ม หรือทศนิยม .5 ได้เมื่อเหมาะสม)
7. ใช้ภาษาไทยที่สุภาพ สร้างสรรค์ ตรงประเด็น ไม่อวยเกินจริง หากตอบผิดต้องชี้จุดผิดอย่างสุภาพและตรงไปตรงมา`;

    const prompt = `ข้อมูลใบงาน:
- ชื่อใบงาน: "${assignmentTitle}"
- รายวิชา: "${subject || 'ไม่ระบุ'}"
- ระดับชั้น: "${gradeLevel || 'ไม่ระบุ'}"
- คำชี้แจงใบงาน: "${instructions || 'ให้ทำตามคำสั่งในแต่ละข้อ'}"
- ไฟล์ที่นักเรียนแนบมาทั้งหมด: ${attachedFiles.length > 0 ? attachedFiles.map((f) => f.name).join(', ') : 'ไม่มีไฟล์แนบ'}

รายการโจทย์ เฉลย และคำตอบของนักเรียน (จำนวน ${preparedItems.length} ข้อ):
${JSON.stringify(preparedItems, null, 2)}

กรุณาตรวจให้คะแนนและอธิบายเหตุผลทีละข้อให้ครบทั้ง ${preparedItems.length} ข้อ (questionIndex 0 ถึง ${preparedItems.length - 1})`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallFeedback: {
              type: Type.STRING,
              description:
                'สรุปภาพรวมการทำใบงานของนักเรียน 2-4 ประโยค ระบุสิ่งที่ทำได้ดีและจุดที่ควรปรับปรุงอย่างตรงไปตรงมาและให้กำลังใจ',
            },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'จุดแข็งจากคำตอบของนักเรียน (หากไม่มีจุดแข็งให้ระบุตามจริงหรือปล่อยว่าง)',
            },
            improvements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'ข้อเสนอแนะเฉพาะเจาะจงเพื่อปรับปรุงคำตอบให้สมบูรณ์ขึ้น',
            },
            itemFeedback: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionIndex: {
                    type: Type.INTEGER,
                    description: 'ลำดับข้อ (เริ่มจาก 0)',
                  },
                  status: {
                    type: Type.STRING,
                    description: 'สถานะคำตอบ: "correct" | "partial" | "incorrect" | "unanswered"',
                  },
                  score: {
                    type: Type.NUMBER,
                    description: 'คะแนนที่ได้สำหรับข้อนี้ (0 ถึง maxScore)',
                  },
                  comment: {
                    type: Type.STRING,
                    description: 'เหตุผลการให้คะแนนและข้อแนะนำเฉพาะข้อนี้ (ภาษาไทย)',
                  },
                },
                required: ['questionIndex', 'status', 'score', 'comment'],
              },
            },
          },
          required: ['overallFeedback', 'strengths', 'improvements', 'itemFeedback'],
        },
      },
    });

    const rawText = (response.text || '').trim();
    if (!rawText) {
      throw new Error('AI ไม่ส่งผลลัพธ์กลับมา');
    }

    const aiParsed = JSON.parse(rawText) as {
      overallFeedback?: string;
      strengths?: string[];
      improvements?: string[];
      itemFeedback?: Array<{
        questionIndex: number;
        status: string;
        score: number;
        comment: string;
      }>;
    };

    const aiFeedbackMap = new Map<number, { status: string; score: number; comment: string }>();
    if (Array.isArray(aiParsed.itemFeedback)) {
      for (const item of aiParsed.itemFeedback) {
        aiFeedbackMap.set(Number(item.questionIndex), item);
      }
    }

    // Reconcile and deterministically verify every question's score
    const verifiedItemFeedback = preparedItems.map((item) => {
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
          finalComment = `ตอบไม่ถูกต้อง (คำตอบที่เลือก: "${item.studentAnswer}" — เฉลยที่ถูกต้องคือ: "${item.answerKey}")`;
        }
      } else {
        // Clamp open-ended / fill_blank scores within [0, maxScore] and round to nearest 0.5
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
        status: finalStatus as 'correct' | 'partial' | 'incorrect' | 'unanswered',
        score: finalScore,
        maxScore: item.maxScore,
        comment: finalComment || 'ประเมินตามเกณฑ์ของใบงานเรียบร้อยแล้ว',
      };
    });

    const sumItemScores = verifiedItemFeedback.reduce((acc, it) => acc + it.score, 0);
    const sumQuestionMax = preparedItems.reduce((acc, it) => acc + it.maxScore, 0);
    const targetMaxPoints = Number(maxPoints) > 0 ? Number(maxPoints) : sumQuestionMax;

    // Reconcile total suggestedScore with assignment totalPoints
    let suggestedScore = sumItemScores;
    if (sumQuestionMax > 0 && targetMaxPoints !== sumQuestionMax) {
      suggestedScore = (sumItemScores / sumQuestionMax) * targetMaxPoints;
    }
    suggestedScore = Math.max(0, Math.min(targetMaxPoints, Math.round(suggestedScore * 2) / 2));

    const recommendedStatus =
      targetMaxPoints > 0 && suggestedScore / targetMaxPoints < 0.5 ? 'needs_revision' : 'graded';

    return res.json({
      success: true,
      result: {
        suggestedScore,
        maxPoints: targetMaxPoints,
        recommendedStatus,
        overallFeedback:
          aiParsed.overallFeedback?.trim() ||
          `ได้คะแนนรวม ${suggestedScore} จาก ${targetMaxPoints} คะแนน`,
        strengths: Array.isArray(aiParsed.strengths) ? aiParsed.strengths.filter(Boolean) : [],
        improvements: Array.isArray(aiParsed.improvements)
          ? aiParsed.improvements.filter(Boolean)
          : [],
        itemFeedback: verifiedItemFeedback,
      },
    });
  } catch (err: any) {
    console.error('AI Grade error:', err);
    return res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการประเมินด้วย AI',
      message: err?.message || String(err),
    });
  }
});

// API Route: AI Worksheet Generator for Teachers
app.post('/api/ai/generate-worksheet', async (req, res) => {
  try {
    const { subject, gradeLevel, topic, numberOfQuestions = 4 } = req.body;
    const ai = getAiClient();

    const prompt = `คุณคือครูผู้เชี่ยวชาญด้านการออกแบบใบงานการเรียนการสอน (Worksheet Designer)
กรุณาสร้างใบงานออนไลน์วิชา "${subject}" ระดับชั้น "${gradeLevel}" ในหัวข้อเรื่อง "${topic}"
จำนวนข้อสอบ/โจทย์: ${numberOfQuestions} ข้อ

กรุณาส่งผลลัพธ์เป็น JSON Object ตาม schema โดยระบุเฉลยคำตอบ (answerKey) ที่ชัดเจนสำหรับใช้ตรวจงานด้วย`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
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
      },
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    return res.json({ success: true, worksheet: parsed });
  } catch (err: any) {
    console.error('AI Generator error:', err);
    return res.status(500).json({
      error: 'ไม่สามารถสร้างใบงานด้วย AI ได้ในขณะนี้',
      message: err?.message || String(err),
    });
  }
});

// API Route: AI Student Hint / Learning Assistant
app.post('/api/ai/hint', async (req, res) => {
  try {
    const { assignmentTitle, questionText, studentQuery } = req.body;
    const ai = getAiClient();

    const prompt = `คุณคือติวเตอร์ AI ใจดีและใจเย็น (AI Learning Coach)
นักเรียนกำลังทำใบงานเรื่อง: "${assignmentTitle}"
โจทย์ข้อที่ถาม: "${questionText}"
คำถามหรือความสงสัยของนักเรียน: "${studentQuery || 'ขอคำใบ้หรืออธิบายหลักการทำข้อนี้หน่อยครับ'}"

ข้อห้ามสำคัญ: ห้ามบอกคำตอบสุดท้ายโดยตรง แต่ให้คำแนะนำ ขั้นตอนความคิด หรือหลักการสำคัญที่จะช่วยให้นักเรียนสามารถคิดคำตอบได้ด้วยตัวเอง
ความยาวไม่เกิน 3-4 ประโยค ใช้ภาษาไทยที่เป็นกันเอง สุภาพ ให้กำลังใจ`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
    });

    return res.json({ success: true, hint: response.text });
  } catch (err: any) {
    console.error('AI Hint error:', err);
    return res.status(500).json({
      error: 'ไม่สามารถขอคำใบ้ได้ในขณะนี้',
      message: err?.message || String(err),
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
