import React, { useState } from 'react';
import {
  X,
  BookOpen,
  ShieldCheck,
  HelpCircle,
  CheckCircle2,
  Users,
  GraduationCap,
  Sparkles,
  Database,
  ExternalLink,
  Lock,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';

export type InfoModalTab = 'guide' | 'security' | 'support';

interface InfoModalProps {
  initialTab?: InfoModalTab;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  initialTab = 'guide',
  onClose,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<InfoModalTab>(initialTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              {activeTab === 'guide' && <BookOpen className="w-5 h-5" />}
              {activeTab === 'security' && <ShieldCheck className="w-5 h-5" />}
              {activeTab === 'support' && <HelpCircle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                {activeTab === 'guide' && 'คู่มือการใช้งาน EduSheet TH'}
                {activeTab === 'security' && 'ความปลอดภัยและความเป็นส่วนตัวของข้อมูล'}
                {activeTab === 'support' && 'ศูนย์ช่วยเหลือและติดต่อสนับสนุน'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ระบบจัดเก็บ ค้นหา ส่ง และตรวจใบงานออนไลน์
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/50 p-1.5 gap-1">
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'guide'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>คู่มือการใช้งาน</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'security'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>ความปลอดภัยข้อมูล</span>
          </button>

          <button
            onClick={() => setActiveTab('support')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'support'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>ช่วยเหลือ & FAQ</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-700 dark:text-slate-300 space-y-4 text-xs leading-relaxed">
          {/* TAB 1: User Guide */}
          {activeTab === 'guide' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl space-y-1">
                <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 font-prompt">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  สำหรับนักเรียน (Student Workflow)
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  1. เข้าใช้งานด้วย <strong>เลขประจำตัวนักเรียน (Username)</strong> และรหัสผ่านของตนเอง<br />
                  2. เลือกดูใบงานจากหน้าแรก, ค้นหาตามระดับชั้นเรียน, หรือหมวดวิชา<br />
                  3. กดปุ่ม <strong>"ส่งใบงาน"</strong> พิมพ์คำตอบและแนบไฟล์รูปถ่าย/เอกสารการบ้าน<br />
                  4. สามารถคลิกปุ่ม <strong>"ขอคำใบ้ AI"</strong> เพื่อรับคำแนะนำเชิงแนวคิดโดยไม่เฉลยคำตอบตรงๆ<br />
                  5. ติดตามผลการตรวจ คะแนน และข้อเสนอแนะจากคุณครูผ่านกระดิ่งแจ้งเตือน
                </p>
              </div>

              <div className="p-3.5 bg-violet-50/80 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/60 rounded-2xl space-y-1">
                <span className="font-bold text-violet-900 dark:text-violet-200 flex items-center gap-1.5 font-prompt">
                  <Users className="w-4 h-4 text-violet-600" />
                  สำหรับครูผู้สอน (Teacher Workflow)
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  1. สลับไปที่โหมด <strong>"ครูผู้สอน"</strong> เพื่อจัดการระบบ<br />
                  2. คลิก <strong>"+ สร้างใบงานใหม่"</strong> เพื่อกำหนดโจทย์ คะแนน และกำหนดส่ง หรือใช้ AI ช่วยร่างโจทย์<br />
                  3. คลิกปุ่ม <strong>"ตรวจให้คะแนน"</strong> หรือ <strong>"ดูรายชื่อนักเรียนส่งงาน"</strong> เพื่อดูรายการส่งของนักเรียนทั้งหมด (เช่น ใบงานที่ 3 มีตัวอย่าง 20 คน)<br />
                  4. คลิก <strong>"⚙️ เมนูตั้งค่า"</strong> เพื่อเพิ่ม/ลบชั้นเรียน, วิชาเรียน และจัดการบัญชีนักเรียนผ่านไฟล์ Excel
                </p>
              </div>

              {onOpenSettings && (
                <div className="pt-2 flex justify-center">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                  >
                    <span>ไปที่ "เมนูตั้งค่าระบบ" (สำหรับครู)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Data Security */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold font-prompt">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>การจัดเก็บข้อมูลบน Google Firebase Firestore</span>
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                  ข้อมูลใบงาน การส่งการบ้าน คะแนน และบัญชีนักเรียนถูกจัดเก็บบน Google Firebase Cloud Firestore ปลอดภัยด้วยกฎ <code>firestore.rules</code> และซิงก์ข้อมูลแบบเรียลไทม์
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-500" />
                    ความเป็นส่วนตัวของนักเรียน
                  </span>
                  <p className="text-[11px] text-slate-500">
                    นักเรียนเข้าถึงได้เฉพาะใบงานและประวัติการส่งงานของตนเองด้วยเลขประจำตัว
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                    การสำรองข้อมูล (Data Export)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    ครูสามารถดาวน์โหลดรายงานคะแนน และรายชื่อนักเรียนเป็นไฟล์ Excel (.xlsx) ได้ตลอดเวลา
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Support & FAQ */}
          {activeTab === 'support' && (
            <div className="space-y-3">
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white font-prompt">
                  ❓ หากนักเรียนลืมรหัสผ่านต้องทำอย่างไร?
                </p>
                <p className="text-[11px] text-slate-500">
                  คุณครูสามารถเข้าไปที่ <strong>เมนูตั้งค่า &gt; จัดการนักเรียน</strong> แล้วกดปุ่มไอคอนกุญแจ 🔑 เพื่อรีเซ็ตรหัสผ่านเป็น <code>123456</code> ได้ใน 1 คลิก
                </p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white font-prompt">
                  ❓ นักเรียนสามารถแก้ไขหรือส่งงานซ้ำได้หรือไม่?
                </p>
                <p className="text-[11px] text-slate-500">
                  หากยังไม่หมดเวลากำหนดส่ง หรือครูส่งใบงานกลับมาให้ "ต้องแก้ไขเพิ่มเติม" นักเรียนสามารถเปิดใบงานและกดส่งคำตอบฉบับปรับปรุงใหม่ได้ทันที
                </p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white font-prompt">
                  ❓ การนำเข้ารายชื่อนักเรียนจากไฟล์ Excel ต้องมีหัวข้ออะไรบ้าง?
                </p>
                <p className="text-[11px] text-slate-500">
                  ไฟล์ Excel ควรกำหนดหัวคอลัมน์: <strong>เลขประจำตัวนักเรียน</strong>, <strong>ชื่อ-นามสกุล</strong>, <strong>รหัสผ่าน</strong>, และ <strong>ระดับชั้น</strong> หรือดาวน์โหลดแม่แบบจากในเมนูตั้งค่า
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white dark:bg-indigo-600 hover:bg-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
