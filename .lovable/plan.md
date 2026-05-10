## Goal
عندما يكون "Learn mode" مفعّلاً، نغيّر شكل قائمة `+` ولون الزر، ونضيف ميزات خاصة بالتعلّم — كل القوائم الفرعية تفتح داخل نفس البانل.

## Changes

### 1. `AnimatedInput.tsx` — green `+` button in Learn mode
- Add new prop `accentMode?: "learn" | null`.
- When `accentMode === "learn"`: زر `+` بخلفية Emerald عميقة (`bg-emerald-600` مع نص أبيض، وهالة خفيفة `shadow-emerald-500/30`)، بدلاً من الشكل الشفاف الحالي.
- Pass `accentMode={chatMode === "learning" ? "learn" : null}` from `ChatPage.tsx`.

### 2. `ChatPage.tsx` — Learn-aware Plus menu
في `renderPlusMenu()` نضيف فرع منفصل للوضع التعليمي (`chatMode === "learning"`):

**Hidden in Learn mode:** Web search row, Model row, Use tools row, Skills row.

**Kept:** Camera / Photos / Files (الصف العلوي يبقى كما هو).

**New rows (تفتح كلها داخل نفس البانل عبر `plusView`):**
- **Play music** (أيقونة `Music2`) → يفتح `plusView === "music"` داخل نفس البانل، يعرض قائمة أنواع: `Lo-fi`, `Classical`, `Nature sounds`, `Focus beats`, `White noise`, `Off`. اختيار نوع يبدأ تشغيله عبر عنصر `<audio loop>` مخفي يُدار في `ChatPage` (state: `studyMusic: { kind, playing }`). نفس الزر يعرض النوع الحالي على اليمين.
- **Focus timer** (أيقونة `Timer`) → يفتح `plusView === "timer"` داخل نفس البانل: حقل دقائق + أزرار سريعة (15 / 25 / 45 / 60). الضغط على Start يغلق البانل ويُحقن **بطاقة عدّاد** داخل المحادثة (فقاعة بمحاذاة الرسائل، ليست فوق الإدخال) — انظر القسم 3.
- **Flashcards** (أيقونة `Layers`) → يرسل برومبت سريع للـMegsy: "Generate 5 flashcards from our current conversation."
- **Quick quiz** (أيقونة `ClipboardCheck`) → يرسل برومبت: "Give me a 5-question quiz on what we just discussed."
- **Read aloud** (أيقونة `Volume2`) → toggle لتشغيل TTS على الرد التالي (state flag فقط الآن، الربط بمزود الصوت لاحقاً إن طُلب).

كلها تستخدم نفس نمط الصفوف الموجود (`liquid-glass-hover`, `rounded-2xl`)، ولون accent أخضر Emerald للأيقونات النشطة.

### 3. In-chat Pomodoro widget (يظهر داخل المحادثة لا فوق الإدخال)
- مكوّن جديد `src/components/learn/InChatTimerCard.tsx`: بطاقة دائرية ضمن قائمة الرسائل تعرض عدّ تنازلي حيّ مع زر إيقاف/استئناف/إلغاء.
- نوع رسالة جديد `kind: "timer"` في مصفوفة الرسائل المحلية في `ChatPage` (لا يُحفظ في DB — جلسة فقط).
- عند انتهاء العدّ: تتحول البطاقة إلى "Session complete 🎉" + صوت تنبيه قصير اختياري.

### 4. Visual polish
- Toggle Learn mode في `LearnModeToggle.tsx`: الحالة النشطة بلون Emerald عميق متّسقة مع الزر.
- ضمان أن جميع subviews الجديدة (`music`, `timer`) تستخدم نفس انتقال `AnimatePresence mode="wait"` الموجود حالياً (slide + fade) داخل نفس بانل `+` بدون أي popup خارجي.

## Files
- edit `src/components/AnimatedInput.tsx`
- edit `src/components/learn/LearnModeToggle.tsx`
- edit `src/pages/ChatPage.tsx` (renderPlusMenu, music audio element, timer message injection, accentMode prop)
- new `src/components/learn/InChatTimerCard.tsx`

## Out of scope
- لا تغييرات على backend / edge functions.
- لا حفظ المؤقّت في قاعدة البيانات (جلسة فقط).
- ربط Read-aloud الفعلي بمزود TTS (نضيف الـtoggle فقط، التشغيل لاحقاً).
