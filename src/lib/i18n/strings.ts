/**
 * Every string the interface shows, in both languages.
 *
 * The two live **in one object per key** rather than in two parallel dictionaries, so a
 * missing Thai translation is a type error at the point it is missing. A parallel-object
 * arrangement can only be checked by a test that runs after the fact, and only reports
 * that *something* is absent.
 *
 * Keys read `screen.thing`. Placeholders are `{name}` and are substituted by `t`.
 *
 * Thai is the translation, not a transliteration of English word order: where a natural
 * Thai sentence puts things differently, it does.
 */
export type Phrase = { en: string; th: string };

export const STRINGS = {
  // ------------------------------------------------------------------- app shell
  "app.name": { en: "EngThai Trainer", th: "EngThai Trainer" },
  "app.tagline": { en: "English–Thai sentence practice", th: "ฝึกประโยคอังกฤษ–ไทย" },
  "nav.main": { en: "Main", th: "เมนูหลัก" },
  "nav.skip": { en: "Skip to content", th: "ข้ามไปยังเนื้อหา" },

  "nav.dashboard": { en: "Dashboard", th: "ภาพรวม" },
  "nav.lessons": { en: "Lessons", th: "บทเรียน" },
  "nav.review": { en: "Review", th: "ทบทวน" },
  "nav.vocabulary": { en: "Vocabulary", th: "คำศัพท์" },
  "nav.settings": { en: "Settings", th: "ตั้งค่า" },
  "nav.learn": { en: "Learn", th: "เรียน" },
  "nav.data": { en: "Import / Export", th: "นำเข้า / ส่งออก" },

  // ------------------------------------------------------------------ page intros
  "page.dashboard.description": {
    en: "Streak, daily goal, accuracy trend and the review heatmap.",
    th: "สถิติต่อเนื่อง เป้าหมายรายวัน ความแม่นยำ และคิวทบทวน",
  },
  "page.lessons.description": {
    en: "Browse lesson decks by level and start a study session.",
    th: "เลือกหมวดตามระดับ แล้วเริ่มฝึกได้เลย",
  },
  "page.learn.description": {
    en: "The exercise loop: prompt, answer, check, grade, next.",
    th: "ขั้นตอนการฝึก: อ่านโจทย์ ตอบ ตรวจ ดูคะแนน แล้วไปข้อถัดไป",
  },
  "page.review.description": {
    en: "Everything the scheduler says is due today, in one mixed queue.",
    th: "ทุกใบที่ถึงกำหนดทบทวนวันนี้ รวมอยู่ในคิวเดียว",
  },
  "page.vocabulary.description": {
    en: "Search, filter and suspend individual words, each with its own schedule.",
    th: "ค้นหา กรอง และพักคำศัพท์แต่ละคำ ซึ่งมีตารางทบทวนของตัวเอง",
  },
  "page.settings.description": {
    en: "Daily goals, answer strictness, speech, theme and the optional AI provider.",
    th: "เป้าหมายรายวัน ความเข้มของการตรวจ เสียง ธีม และตัวช่วย AI ที่จะเปิดหรือไม่ก็ได้",
  },
  "page.data.description": {
    en: "Full JSON backups, CSV and pasted decks, with a preview before anything is written.",
    th: "สำรองข้อมูลเป็น JSON นำเข้า CSV หรือวางข้อความ โดยดูตัวอย่างก่อนบันทึกเสมอ",
  },

  // --------------------------------------------------------------- shared states
  "state.loading": { en: "Loading…", th: "กำลังโหลด…" },
  "state.error.title": {
    en: "Could not open your local database",
    th: "เปิดฐานข้อมูลในเครื่องไม่ได้",
  },
  "state.error.hint": {
    en: "Private browsing windows and blocked site data both prevent storage. Try a normal window.",
    th: "โหมดไม่ระบุตัวตนและการบล็อกข้อมูลเว็บไซต์ทำให้บันทึกข้อมูลไม่ได้ ลองเปิดในหน้าต่างปกติ",
  },

  // ------------------------------------------------------------------- exercise
  "learn.card.of": { en: "Card {index} of {total}", th: "ข้อ {index} จาก {total}" },
  "learn.goal": { en: "Goal {done}/{total} ({percent}%)", th: "เป้าหมาย {done}/{total} ({percent}%)" },
  "learn.xp": { en: "+{amount} XP", th: "+{amount} XP" },
  "learn.listen": { en: "Listen", th: "ฟัง" },
  "learn.replay": { en: "Replay", th: "ฟังอีกครั้ง" },
  "learn.replay.label": { en: "Replay the prompt", th: "เล่นโจทย์อีกครั้ง" },
  "learn.check": { en: "Check", th: "ตรวจ" },
  "learn.hint": { en: "Hint", th: "คำใบ้" },
  "learn.skip": { en: "Skip", th: "ข้าม" },
  "learn.next": { en: "Next", th: "ถัดไป" },
  "learn.retry": { en: "Retry", th: "ลองใหม่" },
  "learn.answer": { en: "Answer", th: "คำตอบ" },
  "learn.why": { en: "Why", th: "ทำไม" },
  "learn.another": { en: "Another example", th: "อีกตัวอย่างหนึ่ง" },
  "learn.vocabulary": { en: "Vocabulary", th: "คำศัพท์" },
  "learn.tapWord": { en: "Tap any English word to look it up.", th: "แตะคำอังกฤษคำไหนก็ได้เพื่อดูความหมาย" },
  "learn.noVoice.none": { en: "This browser has no speech synthesis.", th: "เบราว์เซอร์นี้อ่านออกเสียงไม่ได้" },
  "learn.noVoice.lang": {
    en: "No {language} voice is installed, so audio is unavailable.",
    th: "ไม่มีเสียงภาษา{language}ติดตั้งอยู่ จึงเล่นเสียงไม่ได้",
  },
  "learn.noVoice.shown": { en: " The sentence is shown instead.", th: " จึงแสดงประโยคให้อ่านแทน" },
  "language.english": { en: "English", th: "อังกฤษ" },
  "language.thai": { en: "Thai", th: "ไทย" },

  "learn.xp.earned": { en: "+{amount} XP", th: "ได้ {amount} XP" },
  "learn.xp.none": { en: "No XP — that answer was not a pass.", th: "ยังไม่ได้ XP เพราะคำตอบนี้ยังไม่ผ่าน" },
  "learn.xp.already": {
    en: "Already earned XP for this card today.",
    th: "ได้ XP ของข้อนี้ไปแล้วสำหรับวันนี้",
  },
  "learn.schedule.already": {
    en: "Schedule already updated for this card today, so this attempt was practice only.",
    th: "ตารางทบทวนของข้อนี้ขยับไปแล้ววันนี้ ครั้งนี้จึงนับเป็นการฝึกอย่างเดียว",
  },
  "learn.schedule.practiceOnly": {
    en: "Practice only — the schedule moves on an answer you produce, not one you pick.",
    th: "ฝึกอย่างเดียว ตารางทบทวนจะขยับเมื่อคุณตอบเอง ไม่ใช่เลือกจากตัวเลือก",
  },

  // ------------------------------------------------------------- the happy case
  "praise.perfect.1": { en: "Nailed it", th: "เยี่ยมมาก" },
  "praise.perfect.2": { en: "Every word right", th: "ถูกทุกคำเลย" },
  "praise.perfect.3": { en: "Exactly that", th: "ตรงเป๊ะ" },
  "praise.perfect.4": { en: "Clean sweep", th: "ไม่มีพลาดเลย" },
  "praise.great.1": { en: "Very close", th: "เกือบเต็มแล้ว" },
  "praise.great.2": { en: "Almost word for word", th: "เกือบตรงทุกคำ" },
  "praise.great.3": { en: "Nearly there", th: "อีกนิดเดียว" },
  "praise.streak": { en: "{days} days running", th: "ต่อเนื่อง {days} วันแล้ว" },
  "praise.firstToday": { en: "First one today", th: "ข้อแรกของวันนี้" },
  "praise.goalMet": { en: "Daily goal reached", th: "ถึงเป้าหมายของวันแล้ว" },

  // --------------------------------------------------------------- review screen
  "review.due.title": { en: "Due today", th: "ถึงกำหนดวันนี้" },
  "review.due.description": {
    en: "Cards the scheduler says are ready, longest overdue first.",
    th: "ใบที่ถึงกำหนดแล้ว เรียงจากที่ค้างนานที่สุด",
  },
  "review.due.empty": {
    en: "Nothing is due right now. Study a lesson to put cards into the schedule.",
    th: "ตอนนี้ยังไม่มีอะไรถึงกำหนด ลองเรียนสักบทเพื่อเพิ่มใบเข้าตาราง",
  },
  "review.mistakes.title": { en: "Mistakes", th: "ข้อที่เคยผิด" },
  "review.mistakes.description": {
    en: "Cards you have got wrong, worst first — regardless of when they are next due.",
    th: "ใบที่เคยตอบผิด เรียงจากที่ผิดบ่อยที่สุด ไม่ว่าจะถึงกำหนดหรือยัง",
  },
  "review.mistakes.empty": {
    en: "No mistakes to drill — nothing has been answered wrong yet.",
    th: "ยังไม่มีข้อผิดให้ฝึก เพราะยังไม่เคยตอบผิดเลย",
  },
  "review.start": { en: "Start {queue}", th: "เริ่ม{queue}" },
  "review.back": { en: "Back to review", th: "กลับไปหน้าทบทวน" },
  "review.emptyQueue.title": { en: "Nothing in this queue", th: "คิวนี้ยังว่างอยู่" },
  "review.emptyQueue.description": { en: "{queue} is empty right now.", th: "ตอนนี้{queue}ยังไม่มีอะไร" },
  "learn.building": { en: "Building your queue…", th: "กำลังจัดคิวให้…" },

  // ------------------------------------------------------------- lessons screen
  "lessons.sentences": { en: "{count} sentences", th: "{count} ประโยค" },
  "lessons.sentence": { en: "{count} sentence", th: "{count} ประโยค" },
  "lessons.due": { en: "{count} due", th: "ถึงกำหนด {count}" },
  "lessons.complete": { en: "{percent}% complete", th: "ทำแล้ว {percent}%" },
  "lessons.start": { en: "Start dictation", th: "เริ่มฝึกตามคำบอก" },
  "lessons.empty": {
    en: "No sentences yet — import a deck or add your own to start this category.",
    th: "ยังไม่มีประโยคในหมวดนี้ นำเข้าชุดประโยคหรือเพิ่มเองเพื่อเริ่มต้น",
  },
  "lessons.notStarted": { en: "Not started ({count} of {total})", th: "ยังไม่ได้เริ่ม ({count} จาก {total})" },

  // ---------------------------------------------------------------- settings
  "settings.theme": { en: "Theme", th: "ธีม" },
  "settings.theme.hint": {
    en: "Stored in this browser, not in your library.",
    th: "เก็บไว้ในเบราว์เซอร์นี้ ไม่ได้อยู่ในคลังประโยค",
  },
  "settings.language": { en: "Interface language", th: "ภาษาของหน้าจอ" },
  "settings.language.hint": {
    en: "Changes the app's own wording. Your sentences are untouched.",
    th: "เปลี่ยนเฉพาะข้อความของแอป ประโยคที่คุณเรียนไม่เปลี่ยน",
  },
  "settings.textSize": { en: "Text size", th: "ขนาดตัวอักษร" },
  "settings.textSize.hint": {
    en: "Applies everywhere. Thai gets extra line spacing at every size.",
    th: "ใช้กับทุกหน้าจอ และภาษาไทยจะมีระยะบรรทัดเพิ่มให้ในทุกขนาด",
  },
  "settings.dailyGoal": { en: "Daily goal", th: "เป้าหมายรายวัน" },
  "settings.dailyGoal.hint": { en: "Cards to finish each day.", th: "จำนวนข้อที่ตั้งใจทำต่อวัน" },
  "settings.sound": { en: "Feedback sounds", th: "เสียงตอบรับ" },
  "settings.sound.hint": { en: "A short tone after each answer.", th: "เสียงสั้น ๆ หลังตอบแต่ละข้อ" },
  "settings.tts": { en: "Spoken audio", th: "อ่านออกเสียง" },
  "settings.tts.hint": {
    en: "Reads prompts aloud where a voice is installed.",
    th: "อ่านโจทย์ออกเสียงถ้ามีเสียงภาษานั้นติดตั้งอยู่",
  },
  "settings.rate": { en: "Speech rate", th: "ความเร็วในการอ่าน" },
  "settings.rate.hint": { en: "How fast prompts are read.", th: "ความเร็วที่อ่านโจทย์ออกเสียง" },
  "settings.newPerDay": { en: "New cards per day", th: "ข้อใหม่ต่อวัน" },
  "settings.strictness": { en: "Answer strictness", th: "ความเข้มของการตรวจ" },
  "settings.strictness.hint": {
    en: "Applies to English only. Typed Thai is always checked strictly.",
    th: "ใช้กับภาษาอังกฤษเท่านั้น ภาษาไทยที่พิมพ์จะตรวจแบบเข้มเสมอ",
  },

  "textSize.s": { en: "Small", th: "เล็ก" },
  "textSize.m": { en: "Normal", th: "ปกติ" },
  "textSize.l": { en: "Large", th: "ใหญ่" },
  "textSize.xl": { en: "Extra large", th: "ใหญ่มาก" },
  "textSize.label": { en: "Text size", th: "ขนาดตัวอักษร" },

  "theme.light": { en: "Light", th: "สว่าง" },
  "theme.dark": { en: "Dark", th: "มืด" },
  "theme.system": { en: "System", th: "ตามระบบ" },
  "theme.label": { en: "Colour theme", th: "ธีมสี" },

  "switch.on": { en: "On", th: "เปิด" },
  "switch.off": { en: "Off", th: "ปิด" },

  // ---------------------------------------------------------------- profiles
  "profiles.title": { en: "Profiles", th: "โปรไฟล์" },
  "profiles.description": {
    en: "Separate progress for separate people on this device. Not an account: nothing is sent anywhere, and each profile's data lives in this browser only.",
    th: "แยกความคืบหน้าของแต่ละคนบนเครื่องนี้ ไม่ใช่บัญชีผู้ใช้ ไม่มีการส่งข้อมูลไปไหน และข้อมูลของแต่ละโปรไฟล์อยู่ในเบราว์เซอร์นี้เท่านั้น",
  },
  "profiles.who": { en: "Who is studying?", th: "ใครกำลังเรียน" },
  "profiles.enterPasscode": { en: "Enter passcode", th: "ใส่รหัสผ่าน" },
  "profiles.studyingNow": { en: "Studying now", th: "กำลังใช้อยู่" },
  "profiles.passcodeSet": { en: "Passcode set", th: "ตั้งรหัสผ่านแล้ว" },
  "profiles.noPasscode": { en: "No passcode", th: "ไม่มีรหัสผ่าน" },
  "profiles.passcodeTruth": {
    en: "This hides your progress from someone else using this computer. It is not encryption — the data stays readable to anyone who opens the browser's developer tools or your exported backup file.",
    th: "รหัสนี้ช่วยซ่อนความคืบหน้าจากคนอื่นที่ใช้เครื่องเดียวกัน แต่ไม่ใช่การเข้ารหัส ข้อมูลยังอ่านได้ถ้าเปิดเครื่องมือนักพัฒนาของเบราว์เซอร์หรือไฟล์สำรองที่ส่งออกไว้",
  },
} as const satisfies Record<string, Phrase>;

export type StringKey = keyof typeof STRINGS;
