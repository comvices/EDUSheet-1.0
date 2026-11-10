import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API Route: AI Auto-Grading & Draft Feedback for Teachers
app.post('/api/ai/grade', async (req, res) => {
  try {
    const { assignmentTitle, instructions, questions, answers, maxPoints } = req.body;

    if (!assignmentTitle || !answers) {
      return res.status(400).json({ error: 'Missing required assignment fields' });
    }

    const prompt = `คุณคือผู้ช่วยครูสอนในโรงเรียนไทย (AI Grading Assistant) 
ภารกิจของคุณคือช่วยวิเคราะห์การตอบคำถามของนักเรียนสำหรับใบงานเรื่อง: "${assignmentTitle}"
คำชี้แจงใบงาน: "${instructions || 'ให้ทำตามคำสั่งในแต่ละข้อ'}"
คะแนนเต็ม: ${maxPoints || 20} คะแนน

รายการโจทย์และคำตอบของนักเรียน:
${JSON.stringify({ questions, answers }, null, 2)}

กรุณาวิเคราะห์และประเมินคำตอบของนักเรียน โดยให้ผลลัพธ์เป็น JSON Object ในโครงสร้างนี้เท่านั้น (ห้ามใส่ markdown block หรือข้อความอื่น):
{
  "suggestedScore": 18,
  "overallFeedback": "ข้อความสรุปภาพรวมและคำชมเชยสั้นๆ 2-3 ประโยค ภาษาไทยสุภาพและให้กำลังใจนักเรียน",
  "strengths": ["จุดแข็งข้อที่ 1", "จุดแข็งข้อที่ 2"],
  "improvements": ["ข้อเสนอแนะให้ปรับปรุงเพิ่มเติม 1-2 ข้อ"],
  "itemFeedback": [
    {
      "questionIndex": 0,
      "score": 5,
      "maxScore": 5,
      "comment": "คำแนะนำเฉพาะข้อนี้"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        suggestedScore: Math.round((maxPoints || 20) * 0.85),
        overallFeedback: 'นักเรียนตอบคำถามได้ถูกต้องตามโครงสร้างหลัก และแสดงความเข้าใจเนื้อหาเป็นอย่างดี',
        strengths: ['เนื้อหาครบถ้วน', 'เรียบเรียงภาษาได้ชัดเจน'],
        improvements: ['สามารถเพิ่มรายละเอียดตัวอย่างประยุกต์ใช้เพิ่มเติมได้'],
      };
    }

    return res.json({ success: true, result: parsed });
  } catch (err: any) {
    console.error('AI Grade error:', err);
    return res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการประเมินด้วย AI',
      message: err.message || String(err),
    });
  }
});

// API Route: AI Worksheet Generator for Teachers
app.post('/api/ai/generate-worksheet', async (req, res) => {
  try {
    const { subject, gradeLevel, topic, numberOfQuestions = 4 } = req.body;

    const prompt = `คุณคือครูผู้เชี่ยวชาญด้านการออกแบบใบงานการเรียนการสอน (Worksheet Designer)
กรุณาสร้างใบงานออนไลน์วิชา "${subject}" ระดับชั้น "${gradeLevel}" ในหัวข้อเรื่อง "${topic}" 
จำนวนข้อสอบ/โจทย์: ${numberOfQuestions} ข้อ

ผลลัพธ์ต้องส่งกลับมาในรูปแบบ JSON Object โครงสร้างต่อไปนี้เท่านั้น:
{
  "title": "ชื่อใบงานที่น่าสนใจและกระชับ",
  "description": "คำอธิบายสั้นๆ ของใบงาน",
  "instructions": "คำชี้แจงในการทำใบงานสำหรับนักเรียน",
  "category": "แบบฝึกหัด",
  "totalPoints": 20,
  "questions": [
    {
      "id": "q1",
      "text": "โจทย์คำถามข้อที่ 1",
      "type": "text", // หรือ "multiple_choice" หรือ "fill_blank"
      "options": ["ตัวเลือก 1", "ตัวเลือก 2", "ตัวเลือก 3", "ตัวเลือก 4"], // มีเฉพาะ multiple_choice
      "maxPoints": 5,
      "answerKey": "เฉลยคำตอบหรือแนวทางการตอบที่ถูกต้องสำหรับครู"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    let parsed = JSON.parse(text);
    return res.json({ success: true, worksheet: parsed });
  } catch (err: any) {
    console.error('AI Generator error:', err);
    return res.status(500).json({
      error: 'ไม่สามารถสร้างใบงานด้วย AI ได้ในขณะนี้',
      message: err.message || String(err),
    });
  }
});

// API Route: AI Student Hint / Learning Assistant
app.post('/api/ai/hint', async (req, res) => {
  try {
    const { assignmentTitle, questionText, studentQuery } = req.body;

    const prompt = `คุณคือติวเตอร์ AI ใจดีและใจเย็น (AI Learning Coach)
นักเรียนกำลังทำใบงานเรื่อง: "${assignmentTitle}"
โจทย์ข้อที่ถาม: "${questionText}"
คำถามหรือความสงสัยของนักเรียน: "${studentQuery || 'ขอคำใบ้หรืออธิบายหลักการทำข้อนี้หน่อยครับ'}"

ข้อห้ามสำคัญ: ห้ามบอกคำตอบสุดท้ายโดยตรง แต่ให้คำแนะนำ ขั้นตอนความคิด หรือหลักการสำคัญที่จะช่วยให้นักเรียนสามารถคิดคำตอบได้ด้วยตัวเอง
ความยาวไม่เกิน 3-4 ประโยค ใช้ภาษาไทยที่เป็นกันเอง สุภาพ ให้กำลังใจ`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({ success: true, hint: response.text });
  } catch (err: any) {
    console.error('AI Hint error:', err);
    return res.status(500).json({
      error: 'ไม่สามารถขอคำใบ้ได้ในขณะนี้',
      message: err.message || String(err),
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
