
# خطة التنفيذ الكاملة لتطوير الشات العادي

سأبني نظامًا متكاملًا حول **راوتر داخلي ذكي** + **سجل أدوات موحّد (Tool Registry)** + الميزات الـ40 التي اخترتها، موزعين على 5 مراحل قابلة للتسليم.

---

## 🏗️ البنية المعمارية الأساسية (تُبنى أولاً قبل أي ميزة)

### 1. Intent Router داخلي
نموذج سريع جدًا (`google/gemini-3-flash-preview`) يُستدعى **قبل** الموديل الأساسي ويُرجع JSON عبر tool calling:
```json
{
  "intent": "code|search|creative|math|chat|media|integration",
  "complexity": "simple|medium|complex",
  "mood": "neutral|happy|frustrated|urgent|curious|sad",
  "language": "ar",
  "dialect": "egyptian|gulf|levantine|maghrebi|msa",
  "persona": "friend|teacher|expert|comedian|default",
  "tools_needed": ["WEB_SEARCH", "WIKIPEDIA", ...],
  "needs_memory": true,
  "needs_reasoning": true
}
```
ثم نختار:
- **الموديل**: simple→Lite، medium→Pro، complex→Max (موجود فعلًا — نحسّنه)
- **الأدوات المُحمَّلة**: فقط ما يحتاجه الطلب (Selective tool loading موجود — نوسّعه)
- **النبرة**: حسب mood + persona + dialect

### 2. Tool Registry موحّد
ملف `supabase/functions/_shared/tool-registry.ts` يحتوي قاموسًا لكل أداة:
```ts
{ name, description, schema, category, when_to_use, handler, github_repo, requires_key }
```
هذا يجعل إضافة أي أداة جديدة سطرًا واحدًا.

### 3. جداول قاعدة البيانات الجديدة
- `user_memory` (mem0): facts, preferences, embeddings
- `user_knowledge_graph`: entities + relations
- `chat_cache` (semantic cache): query_embedding, response, hits, ttl
- `chat_citations`: لكل رسالة مصادرها
- `user_personas`: persona مفضلة لكل مستخدم
- `chat_followups`: اقتراحات بعد كل رد

---

## 📅 المراحل الخمس

### 🟢 المرحلة 1 — البنية + الذكاء الأساسي
**الهدف**: إطار العمل + 5 ميزات فكرية جوهرية.

1. ✅ **Intent Router** (الأساس)
2. ✅ **Tool Registry** (الأساس)
3. **Chain-of-Thought تلقائي** — تفعيل `reasoning.effort` ديناميكيًا حسب complexity
4. **ReAct Pattern** — حلقة Reason→Act→Observe (إعادة هيكلة الحلقة الموجودة بنمط ReAct واضح)
5. **DSPy-style Auto-Prompt Optimization** — قالب يحسّن البرومبت قبل الإرسال (بـ TS، مستوحى من DSPy)
6. **Fallback chain** — موجود جزئيًا، نوحّده: Lovable AI → OpenRouter → LemonData
7. **Streaming with cancellation** — AbortController في الواجهة + إيقاف البث في الـedge function

**ملفات**: `chat/index.ts`, `_shared/router.ts`, `_shared/tool-registry.ts`, `_shared/react-loop.ts`, `ChatPage.tsx`

---

### 🟢 المرحلة 2 — الذاكرة والشخصية
**الهدف**: الشات يعرف المستخدم ويتكلم على مزاجه.

8. **mem0 Long-term Memory** — جدول `user_memory` + edge function `memory-extract` (يستخرج حقائق بعد كل محادثة) + حقن الذكريات في system prompt
9. **Knowledge Graph (itext2kg-style)** — استخراج entities/relations وتخزينها كجراف
10. **Mood-aware tone** — كشف المزاج في الراوتر + تعديل system prompt
11. **Dialect-aware replies** — كشف اللهجة (مصري/خليجي/شامي/مغاربي/فصحى) والرد بنفسها
12. **Persona switching** — قائمة persona في الواجهة (صديق/معلم/خبير/كوميدي) + تخزين التفضيل
13. **Learning mode** — وضع تعليمي تدريجي (شرح خطوة بخطوة + أمثلة + تمارين)

**مكتبات GitHub**: مفاهيم mem0ai/mem0, itext2kg, DSPy (نُعيد بناءها بـ TS بدل تشغيل Python)

---

### 🟢 المرحلة 3 — أدوات البحث وجلب المعلومات (11 أداة)
كل أداة = entry في Tool Registry + handler:

14. **SearxNG meta-search** — استدعاء instance عام (searx.be) مجانًا
15. **Tavily search** — يحتاج TAVILY_API_KEY (سنطلبه)
16. **Wikipedia** — REST API مجاني `en.wikipedia.org/api/rest_v1`
17. **arXiv** — `export.arxiv.org/api/query` مجاني
18. **GitHub search** — `api.github.com/search` (token اختياري)
19. **Reddit search** — `reddit.com/search.json` مجاني
20. **YouTube transcript** — مكتبة `youtube-transcript` (Deno-compatible)
21. **News (GDELT)** — `api.gdeltproject.org` مجاني
22. **Google Scholar** — عبر Serper (موجود مفتاحه)
23. **Stack Overflow** — `api.stackexchange.com` مجاني
24. **Wolfram Alpha** — يحتاج WOLFRAM_APP_ID

**Secrets المطلوبة في هذه المرحلة**: `TAVILY_API_KEY`, `WOLFRAM_APP_ID` (اختياريان — الأدوات الأخرى مجانية)

---

### 🟢 المرحلة 4 — أدوات تنفيذية وميديا (12 أداة)

25. **Code Interpreter (e2b)** — استدعاء `e2b.dev` API لتنفيذ Python (يحتاج E2B_API_KEY)
26. **Shell runner** — داخل نفس e2b sandbox
27. **SQL on CSV/Excel** — DuckDB-WASM في edge function
28. **PDF reader** — `pdf-parse` (Deno) لاستخراج النص + تلخيص
29. **OCR** — Tesseract.js عبر edge function أو Google Vision
30. **Speech-to-Text** — Deepgram (موجود) أو Whisper API
31. **TTS عربي** — موجود (`generate-voice`) — نربطه كأداة
32. **Translation** — DeepL أو NLLB (Hugging Face)
33. **Math solver** — math.js (Deno) للحسابات الرمزية
34. **Excel/CSV analyzer** — DuckDB + إحصائيات
35. **Image vision** — Gemini Vision (مدمج في Lovable AI)
36. **QR generator/reader** — `qrcode` + `jsqr` (Deno)
37. **File converter** — Pandoc عبر CloudConvert API
38. **Video summarization** — استخراج keyframes + transcript + تلخيص

---

### 🟢 المرحلة 5 — الأمان والتجربة

39. **Suggested follow-ups** — بعد كل رد، tool call إضافي يولّد 3 أسئلة متابعة
40. **Proactive notifications** — cron يومي يفحص اهتمامات المستخدم من الذاكرة ويرسل إشعارات
41. **Semantic cache (GPTCache-style)** — embedding للسؤال + cosine similarity ضد cache
42. **Hallucination detection (Guardrails-style)** — moderation pass يفحص الادعاءات
43. **PII redaction** — regex + NER قبل الإرسال للموديل (إيميل/تليفون/بطاقات)
44. **Citation enforcement** — إجبار الموديل على إرفاق `[1]`, `[2]` وعرضها في الـUI
45. **Profanity & jailbreak filter** — قائمة + classifier على المدخلات والمخرجات

---

## 🔑 الأسرار المطلوبة (سأطلبها على دفعات)

| المرحلة | الأسرار |
|---------|---------|
| 3 | TAVILY_API_KEY, WOLFRAM_APP_ID (اختياري) |
| 4 | E2B_API_KEY, DEEPL_API_KEY (اختياري), CLOUDCONVERT_API_KEY (اختياري) |

كل الباقي إما مجاني أو موجود فعلًا (Serper, Deepgram, Gemini).

---

## 📦 ملفات GitHub التي سأستفيد منها (كمراجع/منافذ)

- `mem0ai/mem0` → نعيد بناء فكرة الـmemory layer بـ TS
- `stanfordnlp/dspy` → نمط optimization
- `searxng/searxng` → استخدام instance عام
- `e2b-dev/e2b` → SDK للـcode interpreter
- `guardrails-ai/guardrails` → نمط الفحص
- `zilliztech/GPTCache` → فكرة الـsemantic cache

---

## 🎯 المنتج النهائي

شات يقدر:
- يفهم نية المستخدم ومزاجه ولهجته **قبل** الرد
- يختار الموديل والأدوات المناسبة تلقائيًا
- يتذكر المستخدم عبر المحادثات
- يستخدم 35+ أداة (بحث/تنفيذ/ميديا/تكاملات)
- يقدّم مصادر، ويتجنّب الهلوسة، ويحمي الخصوصية
- يدّخر التكلفة عبر cache دلالي

---

## ❓ قبل التنفيذ

1. **هل أبدأ بالمرحلة 1 كاملة الآن**، أم تفضّل تنفيذ كل مرحلة في chat منفصل؟
2. **الأسرار**: هل عندك بالفعل `TAVILY_API_KEY` و`E2B_API_KEY`؟ لو لا، سأتخطى هذه الأدوات في هذه الجولة وأطلبها لاحقًا.
3. **persona switching**: هل تريد اختياره من زر في الواجهة، أم يكتشفه الراوتر تلقائيًا، أم الاثنين؟
