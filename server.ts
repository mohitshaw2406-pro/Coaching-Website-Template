import express, { Request, Response, NextFunction } from 'express';
import cookieSession from 'cookie-session';
import nunjucks from 'nunjucks';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { db, getTodayIST } from './src/db.js';
import { migrateStudent3Password } from './src/migrateStudent3Password.js';
import { generateStudentIdQrSvg } from './src/qrCodeSvg.js';

// Extend String prototype for Jinja-like template calls like s['name'][0].upper()
declare global {
  interface String {
    upper(): string;
    lower(): string;
  }
}
String.prototype.upper = function (this: string) {
  return this.toUpperCase();
};
String.prototype.lower = function (this: string) {
  return this.toLowerCase();
};

const app = express();
app.set('trust proxy', true);
const PORT = 3000;
const HOST = '0.0.0.0';

// Notes file constants (max 10MB, supported documents & images)
const MAX_NOTE_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_NOTE_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.jpg',
  '.jpeg',
  '.png'
]);
const ALLOWED_NOTE_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/octet-stream'
]);

function isAllowedNoteFile(file: Express.Multer.File): boolean {
  if (!file) return false;
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  if (ALLOWED_NOTE_EXTENSIONS.has(ext)) {
    return true;
  }
  if (ALLOWED_NOTE_MIME_TYPES.has(mime) && mime !== 'application/octet-stream') {
    return true;
  }
  return false;
}

// Multer memory storage for notes (max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_NOTE_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedNoteFile(file)) {
      return cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG ❌'));
    }
    cb(null, true);
  }
});

function parseNoteUpload(req: Request, res: Response, next: NextFunction) {
  (upload.single('file') as any)(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        req.flash('Note file size must not exceed 10 MB ❌', 'error');
      } else {
        req.flash(err.message || 'Invalid file upload ❌', 'error');
      }
      return res.redirect('/upload_notes');
    }
    next();
  });
}

// Multer memory storage for student profile photos (max 2MB, images only)
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
]);
const MAX_STUDENT_PHOTO_BYTES = 2 * 1024 * 1024; // 2MB

const studentPhotoMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_STUDENT_PHOTO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      return cb(new Error('Only JPG, PNG, WEBP, or GIF images are allowed ❌'));
    }
    cb(null, true);
  }
});

function parseStudentPhotoUpload(req: Request, res: Response, next: NextFunction) {
  (studentPhotoMulter.single('photo') as any)(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        (req as any).photoUploadError = 'Image size must not exceed 2MB ❌';
      } else {
        (req as any).photoUploadError = err.message || 'Invalid image file ❌';
      }
    }
    next();
  });
}

async function uploadStudentPhotoToCloudinary(file: Express.Multer.File): Promise<string> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    throw new Error('Only JPG, PNG, WEBP, or GIF images are allowed ❌');
  }
  if (file.size > MAX_STUDENT_PHOTO_BYTES) {
    throw new Error('Image size must not exceed 2MB ❌');
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

  if (!cloudName || !apiKey || !apiSecret) {
    // Graceful fallback to data URI when Cloudinary is not configured
    return dataUri;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = 'brilliance_students';
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');
  const body = new URLSearchParams({
    file: dataUri,
    api_key: apiKey,
    timestamp,
    folder,
    signature
  });

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const result: any = await response.json().catch(() => null);
  if (!response.ok || !result?.secure_url) {
    const errMsg = result?.error?.message || 'Failed to upload image to Cloudinary ❌';
    throw new Error(errMsg);
  }

  return result.secure_url as string;
}

/**
 * Uploads study notes/documents (PDF, DOC, DOCX, PPT, PPTX, JPG, PNG) to Cloudinary
 * as RAW/document files in folder 'brilliance_notes' using memory-efficient multipart/form-data.
 */
async function uploadNoteToCloudinary(file: Express.Multer.File): Promise<string> {
  if (!isAllowedNoteFile(file)) {
    throw new Error('Invalid file type. Allowed: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG ❌');
  }
  if (file.size > MAX_NOTE_FILE_BYTES) {
    throw new Error('Note file size must not exceed 10 MB ❌');
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    // Graceful fallback: return data URI so the file is stored and downloadable
    const base64 = file.buffer ? file.buffer.toString('base64') : '';
    return `data:${file.mimetype || 'application/octet-stream'};base64,${base64}`;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = 'brilliance_notes';
  const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const publicId = `${Date.now()}_${sanitizedName}`;

  // Cloudinary signature parameters in alphabetical order: folder, public_id, timestamp
  const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

  // Memory-efficient multipart streaming: use Blob from file.buffer (memoryStorage)
  let fileBlob: Blob;
  if (file.buffer) {
    fileBlob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'application/octet-stream' });
  } else if (file.path && fs.existsSync(file.path)) {
    fileBlob = await fs.openAsBlob(file.path);
  } else {
    throw new Error('No file content available for upload ❌');
  }

  const formData = new FormData();
  formData.append('file', fileBlob, file.originalname);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('folder', folder);
  formData.append('public_id', publicId);
  formData.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
    method: 'POST',
    body: formData
  });

  const result: any = await response.json().catch(() => null);
  if (!response.ok || !result?.secure_url) {
    const errMsg = result?.error?.message || 'Failed to upload note to Cloudinary ❌';
    throw new Error(errMsg);
  }

  return result.secure_url as string;
}

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session management
app.use(
  (cookieSession as any)({
    name: 'session',
    keys: [process.env.SECRET_KEY || 'brilliance_academy_key'],
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    signed: false
  })
);

// Custom Nunjucks FileSystemLoader to guarantee 100% Jinja2 template compatibility
class JinjaCompatLoader extends nunjucks.FileSystemLoader {
  getSource(name: string) {
    const res = super.getSource(name);
    if (!res || !res.src) return res;
    let src = res.src;

    // 1. Convert Jinja2 {% with messages = get_flashed_messages(...) %} -> {% set messages = get_flashed_messages(true) %}
    src = src.replace(
      /{%\s*with\s+messages\s*=\s*get_flashed_messages\([^)]*\)\s*%}/g,
      '{% set messages = get_flashed_messages(true) %}'
    );
    // 2. Convert {% endwith %} -> no-op
    src = src.replace(/{%\s*endwith\s*%}/g, '');

    // 3. Fix Python string slice e[3][:80] in admin_dashboard.html
    src = src.replace(/e\[3\]\[:80\]/g, 'e[3].slice(0, 80)');

    // 4. Fix Jinja if without else inside {{ ... }}: {{ 's' if students|length != 1 }} -> {{ 's' if students|length != 1 else '' }}
    src = src.replace(
      /{{\s*'s'\s+if\s+students\|length\s*!=\s*1\s*}}/g,
      "{{ 's' if students|length != 1 else '' }}"
    );

    return { ...res, src };
  }
}

// Nunjucks Environment
const loader = new JinjaCompatLoader(path.join(process.cwd(), 'templates'), {
  noCache: true,
  watch: false
});

const nunjucksEnv = new nunjucks.Environment(loader, {
  autoescape: true
});

// Custom Filters
nunjucksEnv.addFilter('string', (val: any) => String(val ?? ''));
nunjucksEnv.addFilter('upper', (val: any) => String(val ?? '').toUpperCase());
nunjucksEnv.addFilter('lower', (val: any) => String(val ?? '').toLowerCase());
nunjucksEnv.addFilter('length', (val: any) => {
  if (val == null) return 0;
  if (typeof val === 'string' || Array.isArray(val)) return val.length;
  if (typeof val === 'object') return Object.keys(val).length;
  return 0;
});
nunjucksEnv.addFilter('round', (val: any, precision: number = 0) => {
  const n = Number(val || 0);
  return n.toFixed(precision);
});
nunjucksEnv.addFilter('list', (val: any) => (Array.isArray(val) ? val : Array.from(val || [])));
nunjucksEnv.addFilter('selectattr', (arr: any[], attr: string, op: string, testVal: any) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => {
    const val = item ? item[attr] : undefined;
    if (op === 'equalto') return val === testVal;
    return Boolean(val);
  });
});
nunjucksEnv.addFilter('slice', (val: any, start: number, end?: number) => {
  if (typeof val === 'string' || Array.isArray(val)) {
    return val.slice(start, end);
  }
  return val;
});
nunjucksEnv.addFilter('urlencode', (val: any) => encodeURIComponent(String(val ?? '')));

// Custom Globals
nunjucksEnv.addGlobal('url_for', (endpoint: string, kwargs?: Record<string, any>) => {
  if (endpoint === 'static') {
    const filename = kwargs?.filename || '';
    return filename.startsWith('/') ? filename : `/${filename}`;
  }
  if (endpoint === 'home') return '/';
  if (kwargs?.id !== undefined) {
    return `/${endpoint}/${kwargs.id}`;
  }
  return `/${endpoint}`;
});

nunjucksEnv.addGlobal('range', (start: number, end: number) => {
  const arr: number[] = [];
  for (let i = start; i < end; i++) arr.push(i);
  return arr;
});

// Flash Messages & Request Context Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Session flash storage
  if (req.session && !req.session._flash) {
    req.session._flash = [];
  }

  // Flash method
  (req as any).flash = (message: string, category: string = 'info') => {
    if (req.session) {
      if (!req.session._flash) req.session._flash = [];
      req.session._flash.push([category, message]);
    }
  };

  // Consume flashed messages
  const flashedMessages: [string, string][] = req.session?._flash ? [...req.session._flash] : [];
  if (req.session) {
    req.session._flash = [];
  }

  // Context locals
  const sessionObj = req.session || {};
  (sessionObj as any).get = (key: string, defaultVal?: any) => {
    return sessionObj[key] !== undefined ? sessionObj[key] : defaultVal;
  };

  res.locals.session = sessionObj;
  res.locals.request = { path: req.path };
  res.locals.get_flashed_messages = (withCategories: boolean = true) => {
    if (withCategories) {
      return flashedMessages;
    }
    return flashedMessages.map(m => m[1]);
  };

  // Helper render method
  res.renderTemplate = (templateName: string, context: Record<string, any> = {}) => {
    const combinedContext = {
      ...res.locals,
      ...context
    };
    nunjucksEnv.render(templateName, combinedContext, (err, html) => {
      if (err) {
        console.error(`Error rendering template ${templateName}:`, err);
        return res.status(500).send(`Template Error: ${err.message}`);
      }
      res.send(html);
    });
  };

  next();
});

declare global {
  namespace Express {
    interface Response {
      renderTemplate: (templateName: string, context?: Record<string, any>) => void;
    }
    interface Request {
      flash: (message: string, category?: string) => void;
    }
  }
}

// Static Assets
app.use(express.static(path.join(process.cwd(), 'static')));
app.use('/static', express.static(path.join(process.cwd(), 'static')));

// Auth Guard Decorator / Middleware
function verifyPassword(password: string, storedHash?: string | null): Promise<boolean> {
  return new Promise(resolve => {
    if (!password || !storedHash || typeof password !== 'string' || typeof storedHash !== 'string') {
      return resolve(false);
    }

    if (storedHash.startsWith('$2')) {
      try {
        return resolve(bcrypt.compareSync(password, storedHash));
      } catch {
        return resolve(false);
      }
    }

    if (storedHash.startsWith('scrypt:')) {
      const parts = storedHash.split('$');
      if (parts.length !== 3) {
        return resolve(false);
      }
      const [methodPart, salt, hexDigest] = parts;
      const paramParts = methodPart.split(':');
      if (paramParts.length !== 4 || paramParts[0] !== 'scrypt') {
        return resolve(false);
      }
      const N = parseInt(paramParts[1], 10);
      const r = parseInt(paramParts[2], 10);
      const p = parseInt(paramParts[3], 10);
      if (
        !Number.isInteger(N) ||
        N <= 1 ||
        !Number.isInteger(r) ||
        r <= 0 ||
        !Number.isInteger(p) ||
        p <= 0 ||
        !salt ||
        !hexDigest
      ) {
        return resolve(false);
      }

      let expectedKey: Buffer;
      try {
        expectedKey = Buffer.from(hexDigest, 'hex');
      } catch {
        return resolve(false);
      }
      if (expectedKey.length !== 64) {
        return resolve(false);
      }

      const maxmem = Math.max(64 * 1024 * 1024, 256 * N * r);
      crypto.scrypt(
        Buffer.from(password, 'utf8'),
        Buffer.from(salt, 'utf8'),
        64,
        { N, r, p, maxmem },
        (err, derivedKey) => {
          if (err || derivedKey.length !== expectedKey.length) {
            return resolve(false);
          }
          try {
            return resolve(crypto.timingSafeEqual(derivedKey, expectedKey));
          } catch {
            return resolve(false);
          }
        }
      );
      return;
    }

    return resolve(false);
  });
}

function loginRequired(role: 'admin' | 'teacher' | 'student') {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = req.session;
    if (!session || (!session.user_id && !session.student_id)) {
      return res.redirect(role === 'student' ? '/login' : '/');
    }
    const userRole = session.role;
    if (role === 'admin' && userRole !== 'admin') {
      return res.status(403).send('Access Denied: Admins Only');
    }
    if (role === 'teacher' && userRole !== 'teacher') {
      return res.status(403).send('Access Denied: Teachers Only');
    }
    if (role === 'student' && !session.student_id) {
      return res.redirect('/login');
    }
    next();
  };
}

// ---------------------------
// Home & Public Routes
// ---------------------------
app.get('/', (_req, res) => {
  res.renderTemplate('index.html');
});

app.get('/about', (_req, res) => {
  res.renderTemplate('about.html');
});

app.get('/contact', (_req, res) => {
  res.renderTemplate('contact.html');
});

app.get('/enquiry', (_req, res) => {
  res.renderTemplate('enquiry.html');
});

app.post('/enquiry', (req, res) => {
  const { name, email, message } = req.body;
  if (name && email && message) {
    db.createEnquiry(name, email, message);
    req.flash('Enquiry sent successfully ✅', 'success');
  }
  res.redirect('/enquiry');
});

// ---------------------------
// Student Doubts
// ---------------------------
app.get('/ask_doubt', (req, res) => {
  if (!req.session?.student_id) {
    return res.redirect('/login');
  }
  const doubts = db.getDoubtsByStudent(req.session.student_id);
  res.renderTemplate('ask_doubt.html', { doubts });
});

app.post('/ask_doubt', (req, res) => {
  if (!req.session?.student_id) {
    return res.redirect('/login');
  }
  const { subject, question } = req.body;
  const studentId = req.session.student_id;
  const studentName = req.session.student_name || 'Student';
  const className = req.session.student_class || '';

  if (!subject || !subject.trim() || !question || !question.trim()) {
    req.flash('Please fill in both the subject and your question ❌', 'error');
    return res.redirect('/ask_doubt');
  }

  db.createDoubt(studentId, studentName, className, subject.trim(), question.trim());
  req.flash('Your question has been sent to the teachers! ✅', 'success');
  res.redirect('/ask_doubt');
});

app.get('/teacher_doubts', loginRequired('teacher'), (req, res) => {
  const teacher = db.findUserById(req.session!.user_id);
  const subject = teacher?.subject && teacher.subject !== 'N/A' ? teacher.subject : undefined;
  let classesArray: string[] | undefined = undefined;
  if (teacher && teacher.assigned_classes && teacher.assigned_classes !== 'N/A') {
    classesArray = teacher.assigned_classes
      .split(',')
      .map((c: string) => c.trim())
      .filter(Boolean);
  }
  const doubts = db.getDoubtsByTeacher(subject, classesArray);
  res.renderTemplate('teacher_doubts.html', { doubts });
});

app.post('/answer_doubt/:id', loginRequired('teacher'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { answer } = req.body;
  if (isNaN(id)) {
    req.flash('Invalid doubt ID ❌', 'error');
    return res.redirect('/teacher_doubts');
  }
  if (!answer || !answer.trim()) {
    req.flash('Answer cannot be empty ❌', 'error');
    return res.redirect('/teacher_doubts');
  }
  const teacherUsername = req.session!.username || 'teacher';
  db.answerDoubt(id, answer.trim(), teacherUsername);
  req.flash('Doubt answered successfully ✅', 'success');
  res.redirect('/teacher_doubts');
});

// ---------------------------
// Authentication Systems
// ---------------------------
app.get('/register', (_req, res) => {
  res.renderTemplate('register.html');
});

app.post('/register', (req, res) => {
  const { name, class_name, mobile, password } = req.body;
  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    db.createStudent({
      name,
      class_name,
      email: mobile,
      password: passwordHash
    });
    req.flash('Registration successful ✅', 'success');
    res.redirect('/login');
  } catch (_err: any) {
    req.flash('Mobile already registered ❌', 'error');
    res.redirect('/register');
  }
});

app.get('/login', (_req, res) => {
  res.renderTemplate('login.html');
});

app.post('/login', async (req, res) => {
  const { mobile, password } = req.body;
  const student = db.findStudentByEmail(mobile);
  if (student && (await verifyPassword(password, student.password))) {
    req.session!.student_id = student.id;
    req.session!.student_name = student.name;
    req.session!.student_class = student.class_name;
    return res.redirect('/student_dashboard');
  }
  req.flash('Invalid Mobile or Password ❌', 'error');
  res.renderTemplate('login.html');
});

app.get('/teacher_login', (_req, res) => {
  res.renderTemplate('teacher_login.html');
});

app.post('/teacher_login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.findUserByUsernameAndRole(username, 'teacher');
  if (user && (await verifyPassword(password, user.password))) {
    req.session!.user_id = user.id;
    req.session!.username = user.username;
    req.session!.role = 'teacher';
    return res.redirect('/teacher_dashboard');
  }
  req.flash('Invalid Teacher Credentials ❌', 'error');
  res.renderTemplate('teacher_login.html');
});

app.get('/admin_login', (_req, res) => {
  res.renderTemplate('admin_login.html');
});

app.post('/admin_login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.findUserByUsernameAndRole(username, 'admin');
  if (user && (await verifyPassword(password, user.password))) {
    req.session!.user_id = user.id;
    req.session!.username = user.username;
    req.session!.role = 'admin';
    return res.redirect('/admin_dashboard');
  }
  req.flash('Invalid Admin Credentials ❌', 'error');
  res.renderTemplate('admin_login.html');
});

// ---------------------------
// Dashboards
// ---------------------------
app.get('/student_dashboard', (req, res) => {
  const hasCookieHeader = Boolean(req.headers.cookie);
  console.log('[DIAGNOSTIC] GET /student_dashboard received. Cookie header present:', hasCookieHeader);
  console.log('[DIAGNOSTIC] GET /student_dashboard incoming session:', req.session ? {
    student_id: req.session.student_id,
    student_name: req.session.student_name,
    student_class: req.session.student_class
  } : null);
  if (!req.session?.student_id) {
    console.log('[DIAGNOSTIC] GET /student_dashboard: no student_id in session, redirecting to /login');
    return res.redirect('/login');
  }
  let latestNotice = null;
  try {
    latestNotice = db.getLatestNotice();
  } catch (err) {
    console.error('Failed to load latest notice for student dashboard:', err);
    latestNotice = null;
  }
  const student = db.findStudentById(req.session.student_id);
  const unique_student_id = student
    ? `BCA-2026-${String(student.id).padStart(4, '0')}`
    : `BCA-2026-${String(req.session.student_id).padStart(4, '0')}`;
  const academic_session = '2026-27';
  const qr_svg = generateStudentIdQrSvg(unique_student_id);

  res.renderTemplate('student_dashboard.html', {
    class_name: req.session.student_class,
    subjects: 'Core Subjects',
    notice: latestNotice ? latestNotice.content : 'Welcome!',
    student,
    unique_student_id,
    academic_session,
    qr_svg
  });
});

app.get('/admin_dashboard', loginRequired('admin'), (_req, res) => {
  const s_count = db.countStudents();
  const t_count = db.countTeachers();
  const e_count = db.countEnquiries();
  const enquiries = db.getEnquiries();

  const fee_overview = {
    total_expected: 0,
    total_collected: 0,
    total_pending: 0,
    paid_count: 0,
    partial_count: 0,
    pending_count: 0,
    not_set_count: 0
  };

  try {
    const students = db.getAllStudents();
    const { fees, payments } = db.getAllStudentFeeSummaries();

    const feeByStudent = new Map<number, number>();
    for (const f of fees) {
      const sid = Number(f.student_id);
      if (Number.isSafeInteger(sid) && sid > 0) {
        feeByStudent.set(sid, Number(Number(f.total_fee || 0).toFixed(2)));
      }
    }

    const paidByStudent = new Map<number, number>();
    const seenPaymentIds = new Set<number>();
    for (const p of payments) {
      const pid = Number(p.id);
      if (Number.isSafeInteger(pid) && pid > 0) {
        if (seenPaymentIds.has(pid)) continue;
        seenPaymentIds.add(pid);
      }
      const sid = Number(p.student_id);
      const amt = Number(p.amount || 0);
      if (Number.isSafeInteger(sid) && sid > 0 && Number.isFinite(amt) && amt > 0) {
        paidByStudent.set(sid, Number(((paidByStudent.get(sid) || 0) + amt).toFixed(2)));
      }
    }

    for (const s of students) {
      const sid = Number(s.id);
      const totalFee = feeByStudent.get(sid) || 0;
      const paidAmt = paidByStudent.get(sid) || 0;
      const pendingAmt = Math.max(0, Number((totalFee - paidAmt).toFixed(2)));

      fee_overview.total_expected = Number((fee_overview.total_expected + totalFee).toFixed(2));
      fee_overview.total_collected = Number((fee_overview.total_collected + paidAmt).toFixed(2));
      fee_overview.total_pending = Number((fee_overview.total_pending + pendingAmt).toFixed(2));

      if (totalFee <= 0 && paidAmt > 0) {
        fee_overview.paid_count += 1;
      } else if (totalFee <= 0) {
        fee_overview.not_set_count += 1;
      } else if (pendingAmt === 0) {
        fee_overview.paid_count += 1;
      } else if (paidAmt > 0) {
        fee_overview.partial_count += 1;
      } else {
        fee_overview.pending_count += 1;
      }
    }
  } catch (err) {
    console.warn('Fee overview calculation skipped or tables not initialized yet:', err);
  }

  res.renderTemplate('admin_dashboard.html', {
    enquiries,
    students_count: s_count,
    teachers_count: t_count,
    enquiries_count: e_count,
    fee_overview
  });
});

function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  let str = String(value).replace(/\r\n/g, ' ').replace(/[\r\n]/g, ' ');
  // Prevent spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

app.get('/admin/fee_reports', loginRequired('admin'), (req, res) => {
  const searchQuery = String(req.query.search || '').trim();
  const classFilter = String(req.query.class_filter || '').trim();
  const statusFilter = String(req.query.status_filter || '').trim();
  const exportFormat = String(req.query.export || '').trim().toLowerCase();

  let records: Array<{
    id: number;
    unique_student_id: string;
    name: string;
    class_name: string;
    mobile: string;
    total_fee: number;
    paid_amount: number;
    pending_balance: number;
    status: 'Paid' | 'Partial' | 'Pending' | 'Not Set';
    payments_count: number;
    last_payment_date: string;
  }> = [];

  let filteredPayments: Array<{
    id: number;
    receipt_no: string;
    student_id: number;
    unique_student_id: string;
    student_name: string;
    class_name: string;
    amount: number;
    payment_date: string;
    payment_mode: string;
    remarks: string;
    collected_by: string;
  }> = [];

  const totals = {
    total_expected: 0,
    total_collected: 0,
    total_pending: 0,
    paid_count: 0,
    partial_count: 0,
    pending_count: 0,
    not_set_count: 0
  };

  try {
    const students = db.getAllStudents();
    const { fees, payments } = db.getAllStudentFeeSummaries();

    const feeByStudent = new Map<number, number>();
    for (const f of fees) {
      const sid = Number(f.student_id);
      if (Number.isSafeInteger(sid) && sid > 0) {
        feeByStudent.set(sid, Number(Number(f.total_fee || 0).toFixed(2)));
      }
    }

    const paymentsByStudent = new Map<number, any[]>();
    const seenPaymentIds = new Set<number>();
    for (const p of payments) {
      const pid = Number(p.id);
      if (Number.isSafeInteger(pid) && pid > 0) {
        if (seenPaymentIds.has(pid)) continue;
        seenPaymentIds.add(pid);
      }
      const sid = Number(p.student_id);
      const amt = Number(p.amount || 0);
      if (Number.isSafeInteger(sid) && sid > 0 && Number.isFinite(amt) && amt > 0) {
        const list = paymentsByStudent.get(sid) || [];
        list.push(p);
        paymentsByStudent.set(sid, list);
      }
    }

    const searchLower = searchQuery.toLowerCase();

    for (const s of students) {
      const sid = Number(s.id);
      const uniqueId = `BCA-2026-${String(sid).padStart(4, '0')}`;
      const studentPayments = paymentsByStudent.get(sid) || [];
      const totalFee = feeByStudent.get(sid) || 0;
      const paidAmt = Number(
        studentPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0).toFixed(2)
      );
      const pendingAmt = Math.max(0, Number((totalFee - paidAmt).toFixed(2)));

      let status: 'Paid' | 'Partial' | 'Pending' | 'Not Set' = 'Not Set';
      if (totalFee <= 0 && paidAmt > 0) {
        status = 'Paid';
      } else if (totalFee <= 0) {
        status = 'Not Set';
      } else if (pendingAmt === 0) {
        status = 'Paid';
      } else if (paidAmt > 0) {
        status = 'Partial';
      } else {
        status = 'Pending';
      }

      if (classFilter && String(s.class_name) !== classFilter) {
        continue;
      }
      if (statusFilter && status !== statusFilter) {
        continue;
      }
      if (searchLower) {
        const hay = `${s.name || ''} ${uniqueId} ${s.email || ''} class ${s.class_name || ''}`.toLowerCase();
        if (!hay.includes(searchLower)) {
          continue;
        }
      }

      const lastPaymentDate = studentPayments.length > 0 ? String(studentPayments[0].payment_date || '—') : '—';

      records.push({
        id: sid,
        unique_student_id: uniqueId,
        name: s.name || '',
        class_name: String(s.class_name || ''),
        mobile: s.email || '—',
        total_fee: totalFee,
        paid_amount: paidAmt,
        pending_balance: pendingAmt,
        status,
        payments_count: studentPayments.length,
        last_payment_date: lastPaymentDate
      });

      totals.total_expected = Number((totals.total_expected + totalFee).toFixed(2));
      totals.total_collected = Number((totals.total_collected + paidAmt).toFixed(2));
      totals.total_pending = Number((totals.total_pending + pendingAmt).toFixed(2));

      if (status === 'Paid') totals.paid_count += 1;
      else if (status === 'Partial') totals.partial_count += 1;
      else if (status === 'Pending') totals.pending_count += 1;
      else totals.not_set_count += 1;

      for (const p of studentPayments) {
        filteredPayments.push({
          id: Number(p.id),
          receipt_no: String(p.receipt_no || ''),
          student_id: sid,
          unique_student_id: uniqueId,
          student_name: s.name || '',
          class_name: String(s.class_name || ''),
          amount: Number(Number(p.amount || 0).toFixed(2)),
          payment_date: String(p.payment_date || ''),
          payment_mode: String(p.payment_mode || ''),
          remarks: p.remarks ? String(p.remarks) : '—',
          collected_by: String(p.collected_by || '')
        });
      }
    }

    filteredPayments.sort((a, b) => {
      if (a.payment_date !== b.payment_date) {
        return b.payment_date.localeCompare(a.payment_date);
      }
      return b.id - a.id;
    });
  } catch (err: any) {
    req.flash(err?.message || 'Unable to load fee reports ❌', 'error');
  }

  if (exportFormat === 'csv') {
    const headers = [
      'Student ID',
      'Student Name',
      'Class',
      'Mobile',
      'Total Fee (INR)',
      'Paid Amount (INR)',
      'Pending Balance (INR)',
      'Payment Status',
      'Payments Count',
      'Last Payment Date'
    ];

    const csvRows: string[] = [headers.map(escapeCsvCell).join(',')];
    for (const r of records) {
      csvRows.push(
        [
          r.unique_student_id,
          r.name,
          `Class ${r.class_name}`,
          r.mobile,
          r.total_fee.toFixed(2),
          r.paid_amount.toFixed(2),
          r.pending_balance.toFixed(2),
          r.status,
          String(r.payments_count),
          r.last_payment_date
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }

    const filename = `bca_fee_report_${getTodayIST()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvRows.join('\r\n'));
  }

  res.renderTemplate('admin_fee_reports.html', {
    records,
    filtered_payments: filteredPayments,
    totals,
    search_query: searchQuery,
    class_filter: classFilter,
    status_filter: statusFilter
  });
});

app.get('/teacher_dashboard', loginRequired('teacher'), (req, res) => {
  const teacher = db.findUserById(req.session!.user_id);
  const sub = teacher?.subject || 'N/A';
  const assigned = teacher?.assigned_classes || 'N/A';
  res.renderTemplate('teacher_dashboard.html', {
    assigned_classes: assigned,
    next_lecture: sub
  });
});

app.get('/my_students', loginRequired('teacher'), (req, res) => {
  const teacher = db.findUserById(req.session!.user_id);
  let students: any[] = [];
  if (teacher && teacher.assigned_classes) {
    const classes = teacher.assigned_classes.split(',').map((c: string) => c.trim());
    students = db.getStudentsByClasses(classes);
  }
  res.renderTemplate('my_students.html', { students });
});

// ---------------------------
// Attendance System
// ---------------------------
function buildTodayAttendanceOverview(today: string) {
  const allStudents = db.getAllStudents();
  const todayRecords = db.getAttendanceByDate(today);

  const attendanceByStudentId = new Map<number, any>();
  for (const rec of todayRecords) {
    const sid = Number(rec.student_id);
    if (!attendanceByStudentId.has(sid)) {
      attendanceByStudentId.set(sid, rec);
    }
  }

  const students = allStudents.map((s: any) => {
    const sid = Number(s.id);
    const unique_id = `BCA-2026-${String(sid).padStart(4, '0')}`;
    const rec = attendanceByStudentId.get(sid);
    return {
      id: sid,
      unique_id,
      name: s.name,
      class_name: String(s.class_name),
      photo_url: s.photo_url || null,
      today_status: rec ? rec.status : null,
      marked_by: rec ? rec.marked_by : null
    };
  });

  const studentById = new Map<number, any>();
  for (const s of students) {
    studentById.set(s.id, s);
  }

  const attendance = todayRecords.map((rec: any) => {
    const sid = Number(rec.student_id);
    const st = studentById.get(sid);
    return {
      id: rec.id,
      student_id: sid,
      unique_id: st ? st.unique_id : `BCA-2026-${String(sid).padStart(4, '0')}`,
      name: st ? st.name : `Student #${sid}`,
      class_name: String(rec.class_name || (st ? st.class_name : '')),
      status: rec.status as 'Present' | 'Absent',
      marked_by: rec.marked_by || '',
      date: rec.date
    };
  });

  return { students, attendance };
}

app.get('/scan_attendance', loginRequired('teacher'), (_req, res) => {
  const today = getTodayIST();
  const overview = buildTodayAttendanceOverview(today);
  res.renderTemplate('scan_attendance.html', {
    today,
    students_json: JSON.stringify(overview.students),
    today_attendance_json: JSON.stringify(overview.attendance)
  });
});

app.get('/api/qr_attendance/today', loginRequired('teacher'), (req, res) => {
  if (!req.session?.user_id || req.session?.role !== 'teacher') {
    return res.status(403).json({ status: 'FORBIDDEN', message: 'Access Denied: Teachers Only' });
  }
  const today = getTodayIST();
  const overview = buildTodayAttendanceOverview(today);
  return res.status(200).json({
    date: today,
    students: overview.students,
    attendance: overview.attendance
  });
});

app.post('/api/attendance/correct', loginRequired('teacher'), (req, res) => {
  if (!req.session?.user_id || req.session?.role !== 'teacher') {
    return res.status(403).json({ status: 'FORBIDDEN', message: 'Access Denied: Teachers Only' });
  }

  const confirmed = req.body?.confirmed === true || req.body?.confirmed === 'true';
  if (!confirmed) {
    return res.status(400).json({
      status: 'CONFIRMATION_REQUIRED',
      message: 'Explicit teacher confirmation is required to correct attendance.'
    });
  }

  const studentId = Number(req.body?.student_id);
  if (!Number.isSafeInteger(studentId) || studentId <= 0) {
    return res.status(400).json({
      status: 'INVALID_STUDENT',
      message: 'Valid student ID is required.'
    });
  }

  const newStatus = req.body?.status;
  if (newStatus !== 'Present' && newStatus !== 'Absent') {
    return res.status(400).json({
      status: 'INVALID_STATUS',
      message: 'Status must be Present or Absent.'
    });
  }

  const student = db.findStudentById(studentId);
  if (!student) {
    return res.status(404).json({
      status: 'STUDENT_NOT_FOUND',
      message: `No student found for ID ${studentId}.`
    });
  }

  const today = getTodayIST();
  const teacherUsername = req.session.username || 'teacher';

  try {
    const result = db.correctStudentAttendance(
      student.id,
      String(student.class_name),
      newStatus,
      teacherUsername,
      today
    );

    if (result.status === 'NOT_FOUND') {
      return res.status(404).json({
        status: 'NOT_FOUND',
        message: `No existing attendance record found today for ${student.name} to correct.`
      });
    }

    const uniqueId = `BCA-2026-${String(student.id).padStart(4, '0')}`;
    return res.status(200).json({
      status: 'CORRECTED',
      message: `${student.name} attendance corrected to ${newStatus}.`,
      date: today,
      student: {
        id: student.id,
        unique_id: uniqueId,
        name: student.name,
        class_name: student.class_name,
        photo_url: student.photo_url || null
      },
      record: result.record
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'ERROR',
      message: err?.message || 'Failed to correct attendance record.'
    });
  }
});

app.get('/mark_attendance', loginRequired('teacher'), (req, res) => {
  const selected_class = (req.query.class_name as string) || '';
  let students: any[] = [];
  if (selected_class) {
    students = db.getStudentsByClass(selected_class);
  }
  res.renderTemplate('mark_attendance.html', {
    students,
    selected_class
  });
});

app.post('/mark_attendance', loginRequired('teacher'), (req, res) => {
  const today = getTodayIST();
  const class_to_mark = req.body.class_name;

  const all_students = db.getStudentsByClass(class_to_mark);
  const records = all_students.map(s => {
    const status = req.body[`status_${s.id}`] || 'Absent';
    return {
      student_id: s.id,
      date: today,
      status: status as 'Present' | 'Absent',
      class_name: class_to_mark,
      marked_by: req.session!.username
    };
  });

  db.recordAttendance(records);
  req.flash(`Attendance for Class ${class_to_mark} saved! ✅`, 'success');
  res.redirect('/teacher_dashboard');
});

app.post('/api/qr_attendance', loginRequired('teacher'), (req, res) => {
  if (!req.session?.user_id || req.session?.role !== 'teacher') {
    return res.status(403).json({ status: 'FORBIDDEN', message: 'Access Denied: Teachers Only' });
  }

  const rawCode = String(req.body?.qr_code ?? req.body?.code ?? '').trim();
  const match = /^BCA-2026-(\d{4,})$/.exec(rawCode);
  if (!match) {
    return res.status(400).json({
      status: 'INVALID_QR',
      message: 'Invalid QR format. Expected BCA-2026-XXXX.'
    });
  }

  const studentId = Number(match[1]);
  if (!Number.isSafeInteger(studentId) || studentId <= 0) {
    return res.status(400).json({
      status: 'INVALID_QR',
      message: 'Invalid student ID in QR code.'
    });
  }

  const student = db.findStudentById(studentId);
  if (!student) {
    return res.status(404).json({
      status: 'STUDENT_NOT_FOUND',
      message: `No student found for ID ${rawCode}.`
    });
  }

  const today = getTodayIST();
  const teacherUsername = req.session.username || 'teacher';

  try {
    const result = db.markSingleStudentAttendance(
      student.id,
      String(student.class_name),
      teacherUsername,
      today
    );

    const uniqueId = `BCA-2026-${String(student.id).padStart(4, '0')}`;
    const statusMessage =
      result.status === 'ALREADY_MARKED'
        ? `${student.name} is already marked Present today.`
        : result.status === 'UPDATED_TO_PRESENT'
        ? `${student.name} updated from Absent to Present.`
        : `${student.name} marked Present for today.`;

    return res.status(200).json({
      status: result.status,
      message: statusMessage,
      date: today,
      student: {
        id: student.id,
        unique_id: uniqueId,
        name: student.name,
        class_name: student.class_name,
        photo_url: student.photo_url || null
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'ERROR',
      message: err?.message || 'Failed to record QR attendance.'
    });
  }
});

app.get('/view_attendance', (req, res) => {
  if (!req.session?.student_id) {
    return res.redirect('/login');
  }
  const selected_month = (req.query.month as string) || '';
  const records = db.getStudentAttendance(req.session.student_id, selected_month);
  const months = db.getStudentAttendanceMonths(req.session.student_id);

  res.renderTemplate('view_attendance.html', {
    records,
    months,
    selected_month
  });
});

// ---------------------------
// Timetable System
// ---------------------------
app.get('/manage_timetable', loginRequired('admin'), (req, res) => {
  const selected_class = (req.query.filter_class as string) || '';
  const timetable = db.getTimetable(selected_class);
  res.renderTemplate('manage_timetable.html', {
    timetable,
    selected_class
  });
});

app.post('/manage_timetable', loginRequired('admin'), (req, res) => {
  const { class_name, day, time, subject, teacher } = req.body;
  if (class_name && day && time && subject && teacher) {
    db.createTimetable(class_name, day, time, subject, teacher);
    req.flash('Timetable Entry Added ✅', 'success');
  }
  res.redirect('/manage_timetable');
});

app.post('/delete_timetable/:id', loginRequired('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!isNaN(id)) {
    db.deleteTimetable(id);
    req.flash('Entry Deleted ✅', 'success');
  }
  res.redirect('/manage_timetable');
});

app.get('/view_timetable', (req, res) => {
  if (!req.session?.student_id) {
    return res.redirect('/login');
  }
  const timetable = db.getTimetable(req.session.student_class);
  res.renderTemplate('view_timetable.html', { timetable });
});

// ---------------------------
// Management: Students & Teachers
// ---------------------------
app.get('/students_section', loginRequired('admin'), (_req, res) => {
  const students = db.getAllStudents();
  res.renderTemplate('students.html', { students });
});

app.post('/students_section', loginRequired('admin'), parseStudentPhotoUpload, async (req, res) => {
  if ((req as any).photoUploadError) {
    req.flash((req as any).photoUploadError, 'error');
    return res.redirect('/students_section');
  }

  const { name, class_name, mobile, password } = req.body;
  try {
    let photo_url: string | undefined;
    if (req.file && req.file.size > 0) {
      photo_url = await uploadStudentPhotoToCloudinary(req.file);
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const studentData: any = {
      name,
      class_name,
      email: mobile,
      password: passwordHash
    };
    if (photo_url) {
      studentData.photo_url = photo_url;
    }

    db.createStudent(studentData);
    req.flash('Student added successfully ✅', 'success');
  } catch (err: any) {
    const msg =
      err?.message && (err.message.includes('Cloudinary') || err.message.includes('Image') || err.message.includes('Only JPG'))
        ? err.message
        : 'Mobile number already exists ❌';
    req.flash(msg, 'error');
  }
  res.redirect('/students_section');
});

app.get('/edit_student/:id', loginRequired('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const student = db.findStudentById(id);
  if (!student) {
    return res.redirect('/students_section');
  }
  res.renderTemplate('edit_student.html', { student });
});

app.get('/student_id_card/:id', loginRequired('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.redirect('/students_section');
  }
  const student = db.findStudentById(id);
  if (!student) {
    return res.redirect('/students_section');
  }
  const unique_student_id = `BCA-2026-${String(student.id).padStart(4, '0')}`;
  const academic_session = '2026-27';
  const qr_svg = generateStudentIdQrSvg(unique_student_id);
  res.renderTemplate('student_id_card.html', {
    student,
    unique_student_id,
    academic_session,
    qr_svg
  });
});

app.get('/admin/student_fees/:id', loginRequired('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.redirect('/students_section');
  }
  const student = db.findStudentById(id);
  if (!student) {
    return res.redirect('/students_section');
  }
  const unique_student_id = `BCA-2026-${String(student.id).padStart(4, '0')}`;
  let summary = {
    student_id: student.id,
    total_fee: 0,
    paid_amount: 0,
    pending_balance: 0,
    status: 'Not Set' as 'Paid' | 'Partial' | 'Pending' | 'Not Set',
    payments: [] as any[]
  };
  try {
    summary = db.getStudentFeeSummary(student.id);
  } catch (err: any) {
    req.flash(err?.message || 'Unable to load fee records. Ensure fee tables exist in Supabase ❌', 'error');
  }

  res.renderTemplate('admin_student_fees.html', {
    student,
    unique_student_id,
    summary,
    today: getTodayIST()
  });
});

app.post('/admin/student_fees/:id', loginRequired('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.redirect('/students_section');
  }
  const student = db.findStudentById(id);
  if (!student) {
    return res.redirect('/students_section');
  }

  const { action } = req.body;

  try {
    const currentSummary = db.getStudentFeeSummary(id);

    if (action === 'set_total_fee') {
      const rawTotal = req.body.total_fee;
      const totalFee = Number(rawTotal);
      if (rawTotal === undefined || rawTotal === '' || !Number.isFinite(totalFee) || totalFee < 0) {
        req.flash('Please enter a valid non-negative total fee amount ❌', 'error');
        return res.redirect(`/admin/student_fees/${id}`);
      }
      const roundedTotal = Number(totalFee.toFixed(2));
      if (roundedTotal < currentSummary.paid_amount) {
        req.flash(
          `Total fee (₹${roundedTotal.toFixed(2)}) cannot be less than already paid amount (₹${currentSummary.paid_amount.toFixed(2)}) ❌`,
          'error'
        );
        return res.redirect(`/admin/student_fees/${id}`);
      }
      db.setStudentTotalFee(id, roundedTotal);
      req.flash('Total fee updated successfully ✅', 'success');
      return res.redirect(`/admin/student_fees/${id}`);
    }

    if (action === 'record_payment') {
      const rawAmount = req.body.amount;
      const amount = Number(rawAmount);
      if (rawAmount === undefined || rawAmount === '' || !Number.isFinite(amount) || amount <= 0) {
        req.flash('Payment amount must be greater than zero ❌', 'error');
        return res.redirect(`/admin/student_fees/${id}`);
      }
      const roundedAmount = Number(amount.toFixed(2));

      if (currentSummary.total_fee <= 0) {
        req.flash('Please set the student Total Fee before recording a payment ❌', 'error');
        return res.redirect(`/admin/student_fees/${id}`);
      }

      if (roundedAmount > currentSummary.pending_balance) {
        req.flash(
          `Payment amount (₹${roundedAmount.toFixed(2)}) exceeds pending balance (₹${currentSummary.pending_balance.toFixed(2)}) ❌`,
          'error'
        );
        return res.redirect(`/admin/student_fees/${id}`);
      }

      const allowedModes = ['Cash', 'UPI', 'Bank Transfer'];
      const paymentMode = String(req.body.payment_mode || '').trim();
      if (!allowedModes.includes(paymentMode)) {
        req.flash('Invalid payment mode. Choose Cash, UPI, or Bank Transfer ❌', 'error');
        return res.redirect(`/admin/student_fees/${id}`);
      }

      const paymentDate = String(req.body.payment_date || '').trim() || getTodayIST();
      const remarks = req.body.remarks ? String(req.body.remarks).trim() : null;
      const collectedBy = req.session?.username || 'admin';

      const payment = db.recordFeePayment({
        studentId: id,
        amount: roundedAmount,
        paymentDate,
        paymentMode,
        remarks,
        collectedBy
      });

      req.flash(`Payment of ₹${roundedAmount.toFixed(2)} recorded ✅ (Receipt: ${payment.receipt_no})`, 'success');
      return res.redirect(`/admin/student_fees/${id}`);
    }

    req.flash('Invalid fee action ❌', 'error');
  } catch (err: any) {
    req.flash(err?.message || 'Failed to update fee record ❌', 'error');
  }

  return res.redirect(`/admin/student_fees/${id}`);
});

app.get('/my_fees', (req, res) => {
  if (!req.session?.student_id) {
    return res.redirect('/login');
  }
  const studentId = Number(req.session.student_id);
  const student = db.findStudentById(studentId);
  if (!student) {
    return res.redirect('/login');
  }
  const unique_student_id = `BCA-2026-${String(student.id).padStart(4, '0')}`;
  let summary = {
    student_id: student.id,
    total_fee: 0,
    paid_amount: 0,
    pending_balance: 0,
    status: 'Not Set' as 'Paid' | 'Partial' | 'Pending' | 'Not Set',
    payments: [] as any[]
  };
  try {
    summary = db.getStudentFeeSummary(student.id);
  } catch (err: any) {
    req.flash(err?.message || 'Unable to load fee details ❌', 'error');
  }

  res.renderTemplate('student_fees.html', {
    student,
    unique_student_id,
    summary
  });
});

app.get('/fee_receipt/:payment_id', (req, res) => {
  const isAdmin = req.session?.role === 'admin';
  const sessionStudentId = req.session?.student_id ? Number(req.session.student_id) : null;

  if (!isAdmin && !sessionStudentId) {
    return res.redirect('/login');
  }

  const fallbackRedirect = isAdmin ? '/students_section' : '/my_fees';
  const paymentId = parseInt(req.params.payment_id, 10);
  if (isNaN(paymentId) || paymentId <= 0) {
    return res.redirect(fallbackRedirect);
  }

  try {
    const payment = db.getFeePaymentById(paymentId);
    if (!payment) {
      req.flash('Fee receipt not found ❌', 'error');
      return res.redirect(fallbackRedirect);
    }

    if (!isAdmin && Number(payment.student_id) !== sessionStudentId) {
      req.flash('You are only authorized to view your own fee receipts ❌', 'error');
      return res.redirect('/my_fees');
    }

    const student = db.findStudentById(payment.student_id);
    if (!student) {
      req.flash('Student record not found for this receipt ❌', 'error');
      return res.redirect(fallbackRedirect);
    }

    const summary = db.getStudentFeeSummary(student.id);
    const unique_student_id = `BCA-2026-${String(student.id).padStart(4, '0')}`;
    const academic_session = '2026-27';

    res.renderTemplate('fee_receipt.html', {
      student,
      unique_student_id,
      academic_session,
      payment,
      summary,
      viewer_role: isAdmin ? 'admin' : 'student'
    });
  } catch (err: any) {
    req.flash(err?.message || 'Unable to load fee receipt ❌', 'error');
    return res.redirect(fallbackRedirect);
  }
});

app.post('/edit_student/:id', loginRequired('admin'), parseStudentPhotoUpload, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if ((req as any).photoUploadError) {
    req.flash((req as any).photoUploadError, 'error');
    return res.redirect('/students_section');
  }

  const { name, class_name, mobile, password } = req.body;
  const updateData: any = { name, class_name, email: mobile };
  if (password && password.trim().length > 0) {
    updateData.password = bcrypt.hashSync(password, 10);
  }
  try {
    if (req.file && req.file.size > 0) {
      updateData.photo_url = await uploadStudentPhotoToCloudinary(req.file);
    }
    db.updateStudent(id, updateData);
    req.flash('Student updated ✅', 'success');
  } catch (err: any) {
    const msg =
      err?.message && (err.message.includes('Cloudinary') || err.message.includes('Image') || err.message.includes('Only JPG'))
        ? err.message
        : 'Mobile number already exists ❌';
    req.flash(msg, 'error');
  }
  res.redirect('/students_section');
});

app.post('/delete_student/:id', loginRequired('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!isNaN(id)) {
    db.deleteStudent(id);
    req.flash('Student removed ✅', 'success');
  }
  res.redirect('/students_section');
});

app.post('/admin/migrate-student-3', loginRequired('admin'), (req, res) => {
  if (!req.session?.user_id || req.session?.role !== 'admin') {
    return res.status(403).json({ status: 'FORBIDDEN' });
  }
  try {
    const status = migrateStudent3Password();
    const httpCode =
      status === 'MIGRATION_SUCCESS'
        ? 200
        : status === 'ALREADY_MIGRATED'
        ? 409
        : status === 'MISSING_ENV'
        ? 400
        : status === 'STUDENT_NOT_FOUND'
        ? 404
        : 500;
    return res.status(httpCode).json({ status });
  } catch (_err: any) {
    return res.status(500).json({ status: 'UPDATE_FAILED' });
  }
});

app.get('/manage_teachers', loginRequired('admin'), (_req, res) => {
  const teachers = db.getTeachers();
  res.renderTemplate('manage_teachers.html', { teachers });
});

app.post('/manage_teachers', loginRequired('admin'), (req, res) => {
  const { username, subject, classes } = req.body;
  const defaultPw = bcrypt.hashSync('teacher123', 10);
  db.createTeacher(username, defaultPw, subject, classes);
  req.flash('Teacher Added ✅ (Default password: teacher123)', 'success');
  res.redirect('/manage_teachers');
});

app.get('/edit_teacher/:id', loginRequired('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const teacher = db.findUserById(id);
  if (!teacher) {
    return res.redirect('/manage_teachers');
  }
  res.renderTemplate('edit_teacher.html', { teacher });
});

app.post('/edit_teacher/:id', loginRequired('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { username, subject, classes } = req.body;
  db.updateTeacher(id, username, subject, classes);
  req.flash('Teacher updated! ✅', 'success');
  res.redirect('/manage_teachers');
});

app.post('/delete_teacher/:id', loginRequired('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!isNaN(id)) {
    db.deleteTeacher(id);
    req.flash('Teacher removed ✅', 'success');
  }
  res.redirect('/manage_teachers');
});

// ---------------------------
// Notes & Communications
// ---------------------------
app.get('/upload_notes', loginRequired('teacher'), (_req, res) => {
  res.renderTemplate('upload_notes.html');
});

app.post('/upload_notes', loginRequired('teacher'), parseNoteUpload, async (req, res) => {
  const { class_name, chapter } = req.body;
  const file = req.file;
  if (!file) {
    req.flash('Invalid file type. Allowed: PDF, DOC, DOCX, PPT, PPTX, images ❌', 'error');
    return res.redirect('/upload_notes');
  }

  if (!class_name || !chapter) {
    req.flash('Please provide both Class and Chapter name ❌', 'error');
    return res.redirect('/upload_notes');
  }

  let cloudinaryUrl: string;
  try {
    cloudinaryUrl = await uploadNoteToCloudinary(file);
  } catch (err: any) {
    const msg = err?.message || 'Failed to upload note to Cloudinary ❌';
    req.flash(msg, 'error');
    return res.redirect('/upload_notes');
  }

  // Store the permanent Cloudinary URL in the database
  db.createNote(class_name, chapter, file.originalname, cloudinaryUrl, req.session!.user_id);
  req.flash('Note Uploaded ✅', 'success');
  res.redirect('/teacher_dashboard');
});

app.get('/my_courses', (req, res) => {
  if (!req.session?.student_id) {
    return res.redirect('/login');
  }
  const notes = db.getNotesByClass(req.session.student_class);
  res.renderTemplate('my_courses.html', { notes });
});

app.get('/download/:filename', (req, res) => {
  // 1. Session authentication check (students, teachers, admins)
  if (!req.session?.student_id && req.session?.role !== 'teacher' && req.session?.role !== 'admin') {
    return res.redirect('/login');
  }

  const filename = String(req.params.filename || '').trim();
  if (!filename) {
    req.flash('File not found ❌', 'error');
    return res.redirect('/my_courses');
  }

  // 2. Fetch the verified database record
  const note = db.findNoteByFilename(filename);
  if (!note || !note.file_url) {
    req.flash('File not found ❌', 'error');
    return res.redirect('/my_courses');
  }

  // 3. Class-level access control: students cannot download notes assigned to another class
  if (req.session.student_id && req.session.student_class) {
    if (String(note.class_name) !== String(req.session.student_class)) {
      req.flash('Access denied: This study material is not assigned to your class ❌', 'error');
      return res.redirect('/my_courses');
    }
  }

  const targetUrl = String(note.file_url).trim();

  // 4. Cloudinary HTTPS notes: redirect directly to verified Cloudinary URL
  if (targetUrl.startsWith('https://') || targetUrl.startsWith('http://')) {
    return res.redirect(targetUrl);
  }

  // Reject unexpected or unsafe file paths
  req.flash('Invalid file location ❌', 'error');
  res.redirect('/my_courses');
});

app.get('/add_notice', loginRequired('teacher'), (_req, res) => {
  res.renderTemplate('add_notice.html');
});

app.post('/add_notice', loginRequired('teacher'), (req, res) => {
  const { title, content } = req.body;
  if (title && content) {
    db.createNotice(title, content, req.session!.username || 'teacher');
    req.flash('Notice Updated ✅', 'success');
  }
  res.redirect('/teacher_dashboard');
});

app.post('/delete_enquiry/:id', loginRequired('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!isNaN(id)) {
    db.deleteEnquiry(id);
    req.flash('Enquiry deleted ✅', 'success');
  }
  res.redirect('/admin_dashboard');
});

app.get('/change_password', (req, res) => {
  if (!req.session?.user_id) {
    return res.redirect('/');
  }
  res.renderTemplate('change_password.html');
});

app.post('/change_password', (req, res) => {
  if (!req.session?.user_id) {
    return res.redirect('/');
  }
  const { current_password, new_password, confirm_password } = req.body;
  const user = db.findUserById(req.session.user_id);

  if (!user || !bcrypt.compareSync(current_password, user.password)) {
    req.flash('Current password is incorrect ❌', 'error');
  } else if (new_password !== confirm_password) {
    req.flash('New passwords do not match ❌', 'error');
  } else if (!new_password || new_password.length < 6) {
    req.flash('Password must be at least 6 characters ❌', 'error');
  } else {
    const newHash = bcrypt.hashSync(new_password, 10);
    db.updatePassword(req.session.user_id, newHash);
    req.flash('Password changed successfully ✅', 'success');
  }

  res.renderTemplate('change_password.html');
});

app.get('/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

// Fallback 404
app.use((_req, res) => {
  res.status(404).redirect('/');
});

if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () => {
    console.log(`Brilliance Coaching Academy server running at http://${HOST}:${PORT}`);
  });
}

export default app;
