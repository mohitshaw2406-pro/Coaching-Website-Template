import { Worker, MessageChannel, receiveMessageOnPort } from 'worker_threads';
import { execFileSync } from 'child_process';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { handleAction } from './supabaseWorker.js';
import { handleInMemoryAction } from './inMemoryDb.js';

export interface Student {
  id: number;
  name: string;
  class_name: string;
  email: string; // mobile number
  password?: string;
  photo_url?: string | null;
}

export interface User {
  id: number;
  username: string;
  password: string;
  role: 'admin' | 'teacher';
  subject?: string;
  assigned_classes?: string;
}

export interface Enquiry {
  id: number;
  name: string;
  email: string;
  message: string;
}

export interface Notice {
  id: number;
  title: string;
  content: string;
  posted_by: string;
  date: string;
}

export interface Note {
  id: number;
  class_name: string;
  chapter: string;
  filename: string;
  file_url: string;
  teacher_id: number;
}

export interface TimetableEntry {
  id: number;
  class_name: string;
  day: string;
  time: string;
  subject: string;
  teacher_name: string;
}

export interface AttendanceRecord {
  id: number;
  student_id: number;
  date: string; // YYYY-MM-DD
  status: 'Present' | 'Absent';
  class_name: string;
  marked_by: string;
}

export interface Doubt {
  id: number;
  student_id: number;
  student_name: string;
  class_name: string;
  subject: string;
  question: string;
  answer?: string | null;
  answered_by?: string | null;
  created_at?: string;
}

export interface StudentFee {
  id: number;
  student_id: number;
  total_fee: number;
  updated_at?: string;
}

export interface FeePayment {
  id: number;
  student_id: number;
  amount: number;
  payment_date: string; // YYYY-MM-DD (Asia/Kolkata)
  payment_mode: string;
  remarks?: string | null;
  receipt_no: string; // DB-generated unique receipt ID
  collected_by: string;
  created_at?: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
}

export interface StudentFeeSummary {
  student_id: number;
  total_fee: number;
  paid_amount: number;
  pending_balance: number;
  status: 'Paid' | 'Partial' | 'Pending' | 'Not Set';
  payments: FeePayment[];
}

export function getTodayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export function toTupleObject<T extends Record<string, any>>(obj: T, fieldOrder: (keyof T)[]): any {
  if (!obj) return obj;
  const arr = fieldOrder.map(f => obj[f]) as any;
  for (const [k, v] of Object.entries(obj)) {
    arr[k] = v;
  }
  return arr;
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

export const hasSupabaseConfig = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
);

// Expose direct async execution for serverless or async callers
export async function executeAsync(action: string, payload: any = {}): Promise<any> {
  if (!hasSupabaseConfig) {
    return handleInMemoryAction(action, payload);
  }
  try {
    return await handleAction(action, payload);
  } catch (err) {
    console.warn(`[AI Studio] Supabase async action failed for "${action}", falling back to in-memory store:`, err);
    return handleInMemoryAction(action, payload);
  }
}

// Inline runner script for synchronous execution in serverless environments (e.g. Vercel)
// without requiring long-lived background threads or .ts loaders
const serverlessRunnerScript = `
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.log(JSON.stringify({ error: { message: 'Supabase credentials missing: SUPABASE_URL and SUPABASE_KEY are required.' } }));
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const { action, payload } = input;
  switch (action) {
    case 'student.findById': {
      const { data, error } = await supabase.from('students').select('*').eq('id', payload.id).maybeSingle();
      if (error) throw error;
      return data;
    }
    case 'student.findByEmail': {
      const { data, error } = await supabase.from('students').select('*').eq('email', payload.email).maybeSingle();
      if (error) throw error;
      return data;
    }
    case 'student.getAll': {
      const { data, error } = await supabase.from('students').select('*').order('class_name', { ascending: true }).order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    case 'student.getByClass': {
      const { data, error } = await supabase.from('students').select('*').eq('class_name', payload.className).order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    case 'student.getByClasses': {
      if (!payload.classes || payload.classes.length === 0) return [];
      const { data, error } = await supabase.from('students').select('*').in('class_name', payload.classes).order('class_name', { ascending: true }).order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    case 'student.create': {
      const { data, error } = await supabase.from('students').insert(payload.data).select().single();
      if (error) throw error;
      return data;
    }
    case 'student.update': {
      const { data, error } = await supabase.from('students').update(payload.data).eq('id', payload.id).select().single();
      if (error) throw error;
      return data;
    }
    case 'student.delete': {
      await supabase.from('attendance').delete().eq('student_id', payload.id);
      await supabase.from('doubts').delete().eq('student_id', payload.id);
      const { error } = await supabase.from('students').delete().eq('id', payload.id);
      if (error) throw error;
      return true;
    }
    case 'student.count': {
      const { count, error } = await supabase.from('students').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    }
    case 'user.findById': {
      const { data, error } = await supabase.from('users').select('*').eq('id', payload.id).maybeSingle();
      if (error) throw error;
      return data;
    }
    case 'user.findByUsernameAndRole': {
      const { data, error } = await supabase.from('users').select('*').eq('username', payload.username).eq('role', payload.role).maybeSingle();
      if (error) throw error;
      return data;
    }
    case 'user.getTeachers': {
      const { data, error } = await supabase.from('users').select('*').eq('role', 'teacher').order('username', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    case 'user.createTeacher': {
      const { data, error } = await supabase.from('users').insert({ username: payload.username, password: payload.password, role: 'teacher', subject: payload.subject, assigned_classes: payload.assigned_classes }).select().single();
      if (error) throw error;
      return data;
    }
    case 'user.updateTeacher': {
      const { data, error } = await supabase.from('users').update({ subject: payload.subject, assigned_classes: payload.assigned_classes }).eq('id', payload.id).select().single();
      if (error) throw error;
      return data;
    }
    case 'user.updatePassword': {
      const { error } = await supabase.from('users').update({ password: payload.passwordHash }).eq('id', payload.userId);
      if (error) throw error;
      return true;
    }
    case 'user.deleteTeacher': {
      const { error } = await supabase.from('users').delete().eq('id', payload.id);
      if (error) throw error;
      return true;
    }
    case 'user.countTeachers': {
      const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
      if (error) throw error;
      return count || 0;
    }
    case 'enquiry.getAll': {
      const { data, error } = await supabase.from('enquiries').select('*').order('id', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    case 'enquiry.create': {
      const { data, error } = await supabase.from('enquiries').insert({ name: payload.name, email: payload.email, message: payload.message }).select().single();
      if (error) throw error;
      return data;
    }
    case 'enquiry.delete': {
      const { error } = await supabase.from('enquiries').delete().eq('id', payload.id);
      if (error) throw error;
      return true;
    }
    case 'enquiry.count': {
      const { count, error } = await supabase.from('enquiries').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    }
    case 'notice.getLatest': {
      const { data, error } = await supabase.from('notices').select('*').order('id', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    }
    case 'notice.create': {
      const { data, error } = await supabase.from('notices').insert({ title: payload.title, content: payload.content, posted_by: payload.posted_by, date: new Date().toISOString().split('T')[0] }).select().single();
      if (error) throw error;
      return data;
    }
    case 'note.getByClass': {
      const { data, error } = await supabase.from('notes').select('*').eq('class_name', payload.className).order('chapter', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    case 'note.create': {
      const { data, error } = await supabase.from('notes').insert({ class_name: payload.class_name, chapter: payload.chapter, filename: payload.filename, file_url: payload.file_url, teacher_id: payload.teacher_id }).select().single();
      if (error) throw error;
      return data;
    }
    case 'note.findByFilename': {
      const { data, error } = await supabase.from('notes').select('*').eq('filename', payload.filename).maybeSingle();
      if (error) throw error;
      return data;
    }
    case 'timetable.getAll': {
      let q = supabase.from('timetable').select('*');
      if (payload.filterClass) q = q.eq('class_name', payload.filterClass);
      const { data, error } = await q.order('day', { ascending: true }).order('time', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    case 'timetable.create': {
      const { data, error } = await supabase.from('timetable').insert({ class_name: payload.class_name, day: payload.day, time: payload.time, subject: payload.subject, teacher_name: payload.teacher_name }).select().single();
      if (error) throw error;
      return data;
    }
    case 'timetable.delete': {
      const { error } = await supabase.from('timetable').delete().eq('id', payload.id);
      if (error) throw error;
      return true;
    }
    case 'attendance.hasForClassAndDate': {
      const { count, error } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('class_name', payload.className).eq('date', payload.dateStr);
      if (error) throw error;
      return (count || 0) > 0;
    }
    case 'attendance.record': {
      const records = Array.isArray(payload.records) ? payload.records : [];
      if (records.length === 0) return true;
      const absentRecords = records.filter((r) => r.status === 'Absent');
      const presentRecords = records.filter((r) => r.status === 'Present');
      if (absentRecords.length > 0) {
        const { error: absentError } = await supabase
          .from('attendance')
          .upsert(absentRecords, { onConflict: 'student_id,date', ignoreDuplicates: true });
        if (absentError) throw absentError;
      }
      if (presentRecords.length > 0) {
        const { error: presentError } = await supabase
          .from('attendance')
          .upsert(presentRecords, { onConflict: 'student_id,date' });
        if (presentError) throw presentError;
      }
      return true;
    }
    case 'attendance.markSingleStudent': {
      const { data: existingRows, error: fetchError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', payload.studentId)
        .eq('date', payload.dateStr)
        .order('id', { ascending: false })
        .limit(1);
      if (fetchError) throw fetchError;
      const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;
      if (existing && existing.status === 'Present') {
        return { status: 'ALREADY_MARKED', record: existing };
      }
      const wasAbsent = Boolean(existing && existing.status === 'Absent');
      const { data: upserted, error: upsertError } = await supabase
        .from('attendance')
        .upsert(
          {
            student_id: payload.studentId,
            date: payload.dateStr,
            status: 'Present',
            class_name: String(payload.className),
            marked_by: payload.markedBy
          },
          { onConflict: 'student_id,date' }
        )
        .select()
        .single();
      if (upsertError) throw upsertError;
      return {
        status: wasAbsent ? 'UPDATED_TO_PRESENT' : 'MARKED_PRESENT',
        record: upserted
      };
    }
    case 'attendance.getByDate': {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', payload.dateStr)
        .order('id', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    case 'attendance.correctSingleStudent': {
      const { data: existingRows, error: fetchError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', payload.studentId)
        .eq('date', payload.dateStr)
        .limit(1);
      if (fetchError) throw fetchError;
      const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;
      if (!existing) {
        return { status: 'NOT_FOUND', record: null };
      }
      const { data: upserted, error: upsertError } = await supabase
        .from('attendance')
        .upsert(
          {
            student_id: payload.studentId,
            date: payload.dateStr,
            status: payload.status,
            class_name: String(payload.className),
            marked_by: payload.markedBy
          },
          { onConflict: 'student_id,date' }
        )
        .select()
        .single();
      if (upsertError) throw upsertError;
      return { status: 'CORRECTED', record: upserted };
    }
    case 'attendance.getByStudent': {
      let q = supabase.from('attendance').select('*').eq('student_id', payload.studentId);
      if (payload.month) q = q.like('date', \`\${payload.month}%\`);
      const { data, error } = await q.order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    case 'attendance.getMonthsByStudent': {
      const { data, error } = await supabase.from('attendance').select('date').eq('student_id', payload.studentId);
      if (error) throw error;
      const months = Array.from(new Set((data || []).map((r) => r.date.substring(0, 7)))).sort().reverse();
      return months;
    }
    case 'doubt.create': {
      const { data, error } = await supabase.from('doubts').insert({ student_id: payload.student_id, student_name: payload.student_name, class_name: payload.class_name, subject: payload.subject, question: payload.question }).select().single();
      if (error) throw error;
      return data;
    }
    case 'doubt.getByTeacher': {
      let q = supabase.from('doubts').select('*');
      if (payload.subject) q = q.eq('subject', payload.subject);
      if (payload.classes && payload.classes.length > 0) q = q.in('class_name', payload.classes);
      const { data, error } = await q.order('id', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    case 'doubt.getByStudent': {
      const { data, error } = await supabase.from('doubts').select('*').eq('student_id', payload.studentId).order('id', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    case 'doubt.answer': {
      const { data, error } = await supabase.from('doubts').update({ answer: payload.answer, answered_by: payload.answered_by }).eq('id', payload.id).select().single();
      if (error) throw error;
      return data;
    }
    case 'fee.getStudentSummary': {
      const studentId = Number(payload.studentId);
      if (!Number.isSafeInteger(studentId) || studentId <= 0) throw new Error('Invalid student ID.');
      const { data: feeRow, error: feeErr } = await supabase.from('student_fees').select('*').eq('student_id', studentId).maybeSingle();
      if (feeErr) throw feeErr;
      const { data: paymentRows, error: payErr } = await supabase.from('fee_payments').select('*').eq('student_id', studentId).order('payment_date', { ascending: false }).order('id', { ascending: false });
      if (payErr) throw payErr;
      const payments = (paymentRows || []).map((p) => ({ ...p, amount: Number(p.amount) }));
      const total_fee = feeRow ? Number(Number(feeRow.total_fee || 0).toFixed(2)) : 0;
      const paid_amount = Number(payments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2));
      const pending_balance = Math.max(0, Number((total_fee - paid_amount).toFixed(2)));
      let status = 'Not Set';
      if (total_fee <= 0 && paid_amount > 0) status = 'Paid';
      else if (total_fee <= 0) status = 'Not Set';
      else if (pending_balance === 0) status = 'Paid';
      else if (paid_amount > 0) status = 'Partial';
      else status = 'Pending';
      return { student_id: studentId, total_fee, paid_amount, pending_balance, status, payments };
    }
    case 'fee.setTotalFee': {
      const studentId = Number(payload.studentId);
      if (!Number.isSafeInteger(studentId) || studentId <= 0) throw new Error('Invalid student ID.');
      const totalFee = Number(payload.totalFee);
      if (!Number.isFinite(totalFee) || totalFee < 0) throw new Error('Total fee must be a valid non-negative amount.');
      const { data, error } = await supabase.from('student_fees').upsert({ student_id: studentId, total_fee: Number(totalFee.toFixed(2)), updated_at: new Date().toISOString() }, { onConflict: 'student_id' }).select().single();
      if (error) throw error;
      return { ...data, total_fee: Number(data.total_fee) };
    }
    case 'fee.recordPayment': {
      const studentId = Number(payload.studentId);
      if (!Number.isSafeInteger(studentId) || studentId <= 0) throw new Error('Invalid student ID.');
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero.');
      const paymentDate = String(payload.paymentDate || '').trim();
      if (!paymentDate) throw new Error('Payment date is required.');
      const paymentMode = String(payload.paymentMode || 'Cash').trim() || 'Cash';
      const collectedBy = String(payload.collectedBy || 'admin').trim() || 'admin';
      const remarks = payload.remarks !== undefined && payload.remarks !== null && String(payload.remarks).trim() !== '' ? String(payload.remarks).trim() : null;
      const { data, error } = await supabase.from('fee_payments').insert({ student_id: studentId, amount: Number(amount.toFixed(2)), payment_date: paymentDate, payment_mode: paymentMode, remarks, collected_by: collectedBy }).select().single();
      if (error) throw error;
      return { ...data, amount: Number(data.amount) };
    }
    case 'fee.getPaymentById': {
      const paymentId = Number(payload.paymentId);
      if (!Number.isSafeInteger(paymentId) || paymentId <= 0) return null;
      const { data, error } = await supabase.from('fee_payments').select('*').eq('id', paymentId).maybeSingle();
      if (error) throw error;
      return data ? { ...data, amount: Number(data.amount) } : null;
    }
    case 'fee.getPaymentByReceiptNo': {
      const receiptNo = String(payload.receiptNo || '').trim();
      if (!receiptNo) return null;
      const { data, error } = await supabase.from('fee_payments').select('*').eq('receipt_no', receiptNo).maybeSingle();
      if (error) throw error;
      return data ? { ...data, amount: Number(data.amount) } : null;
    }
    case 'fee.getAllStudentSummaries': {
      const { data: feeRows, error: feeErr } = await supabase.from('student_fees').select('*');
      if (feeErr) throw feeErr;
      const { data: paymentRows, error: payErr } = await supabase.from('fee_payments').select('*').order('payment_date', { ascending: false }).order('id', { ascending: false });
      if (payErr) throw payErr;
      return {
        fees: (feeRows || []).map((f) => ({ ...f, total_fee: Number(f.total_fee) })),
        payments: (paymentRows || []).map((p) => ({ ...p, amount: Number(p.amount) }))
      };
    }
    default:
      throw new Error(\`Unknown action: \${action}\`);
  }
}

run()
  .then(result => console.log(JSON.stringify({ result })))
  .catch(err => console.log(JSON.stringify({ error: { message: err.message, code: err.code } })));
`;

function executeServerlessSync(action: string, payload: any = {}): any {
  try {
    const rawOut = execFileSync(process.execPath, ['-e', serverlessRunnerScript], {
      input: JSON.stringify({ action, payload }),
      encoding: 'utf8',
      timeout: 8000,
      env: process.env
    });

    const parsed = JSON.parse(rawOut.trim());
    if (parsed.error) {
      const err: any = new Error(parsed.error.message || `Database query failed for ${action}`);
      if (parsed.error.code) err.code = parsed.error.code;
      throw err;
    }
    return parsed.result;
  } catch (err: any) {
    if (err.killed || err.signal === 'SIGTERM' || err.code === 'ETIMEDOUT') {
      throw new Error(`Database error: Operation timed out for action "${action}"`);
    }
    throw err;
  }
}

// Worker communication bridge for local development (only spawned when NOT in Vercel and Supabase is configured)
let sharedBuffer: SharedArrayBuffer | null = null;
let sharedInt32: Int32Array | null = null;
let port1: any = null;
let port2: any = null;
let worker: Worker | null = null;

if (!process.env.VERCEL && hasSupabaseConfig) {
  try {
    sharedBuffer = new SharedArrayBuffer(4);
    sharedInt32 = new Int32Array(sharedBuffer);
    const channel = new MessageChannel();
    port1 = channel.port1;
    port2 = channel.port2;

    const workerUrl = new URL('./supabaseWorker.ts', import.meta.url);
    worker = new Worker(workerUrl, {
      workerData: { sharedBuffer, port: port2 },
      transferList: [port2]
    });

    worker.on('error', err => {
      console.error('Supabase Worker Thread Error:', err);
    });
  } catch (err) {
    console.warn('Failed to start local worker thread, falling back to serverless bridge:', err);
  }
}

function executeSync(action: string, payload: any = {}): any {
  if (!hasSupabaseConfig) {
    return handleInMemoryAction(action, payload);
  }

  try {
    // In Vercel or when worker thread is inactive, use the serverless execution bridge
    if (process.env.VERCEL || !worker || !port1 || !sharedInt32) {
      return executeServerlessSync(action, payload);
    }

    // Local worker thread execution with finite safety timeout
    Atomics.store(sharedInt32, 0, 0);
    port1.postMessage({ action, payload });
    const waitResult = Atomics.wait(sharedInt32, 0, 0, 8000); // 8-second safety timeout

    if (waitResult === 'timed-out') {
      throw new Error(`Database error: Timeout waiting for Supabase worker for action "${action}"`);
    }

    const msg = receiveMessageOnPort(port1);
    if (!msg || !msg.message) {
      throw new Error(`Database error: No response from Supabase worker for action "${action}"`);
    }

    if (msg.message.error) {
      const errObj = msg.message.error;
      const err: any = new Error(errObj.message || `Database query failed for ${action}`);
      if (errObj.code) err.code = errObj.code;
      if (errObj.details) err.details = errObj.details;
      throw err;
    }

    return msg.message.result;
  } catch (err: any) {
    console.warn(`[AI Studio] Supabase query failed for "${action}", falling back to in-memory store:`, err?.message || err);
    return handleInMemoryAction(action, payload);
  }
}

class SupabaseDatabase {
  // --- Students ---
  findStudentById(id: number) {
    const data = executeSync('student.findById', { id });
    if (!data) return null;
    return toTupleObject(data, ['id', 'name', 'class_name', 'email', 'password']);
  }

  findStudentByEmail(email: string) {
    const data = executeSync('student.findByEmail', { email });
    if (!data) return null;
    return toTupleObject(data, ['id', 'name', 'class_name', 'email', 'password']);
  }

  getAllStudents() {
    const list = executeSync('student.getAll') || [];
    return list.map((s: any) =>
      toTupleObject(s, ['id', 'name', 'class_name', 'email', 'password'])
    );
  }

  getStudentsByClass(className: string) {
    const list = executeSync('student.getByClass', { className }) || [];
    return list.map((s: any) =>
      toTupleObject(s, ['id', 'name', 'class_name', 'email', 'password'])
    );
  }

  getStudentsByClasses(classes: string[]) {
    const list = executeSync('student.getByClasses', { classes }) || [];
    return list.map((s: any) =>
      toTupleObject(s, ['id', 'name', 'class_name', 'email', 'password'])
    );
  }

  createStudent(data: Omit<Student, 'id'>) {
    const created = executeSync('student.create', { data });
    return toTupleObject(created, ['id', 'name', 'class_name', 'email', 'password']);
  }

  updateStudent(id: number, data: Partial<Student>) {
    const updated = executeSync('student.update', { id, data });
    if (!updated) return null;
    return toTupleObject(updated, ['id', 'name', 'class_name', 'email', 'password']);
  }

  deleteStudent(id: number) {
    executeSync('student.delete', { id });
  }

  countStudents(): number {
    return executeSync('student.count') || 0;
  }

  // --- Users ---
  findUserById(id: number) {
    const data = executeSync('user.findById', { id });
    if (!data) return null;
    return toTupleObject(data, ['id', 'username', 'subject', 'assigned_classes', 'password', 'role']);
  }

  findUserByUsernameAndRole(username: string, role: 'admin' | 'teacher') {
    const data = executeSync('user.findByUsernameAndRole', { username, role });
    if (!data) return null;
    return toTupleObject(data, ['id', 'username', 'subject', 'assigned_classes', 'password', 'role']);
  }

  getTeachers() {
    const list = executeSync('user.getTeachers') || [];
    return list.map((u: any) =>
      toTupleObject(u, ['id', 'username', 'subject', 'assigned_classes', 'password', 'role'])
    );
  }

  createTeacher(username: string, passwordHash: string, subject: string, assigned_classes: string) {
    const data = executeSync('user.createTeacher', {
      username,
      passwordHash,
      subject,
      assigned_classes
    });
    return toTupleObject(data, ['id', 'username', 'subject', 'assigned_classes', 'password', 'role']);
  }

  updateTeacher(id: number, username: string, subject: string, assigned_classes: string) {
    const data = executeSync('user.updateTeacher', {
      id,
      username,
      subject,
      assigned_classes
    });
    if (!data) return null;
    return toTupleObject(data, ['id', 'username', 'subject', 'assigned_classes', 'password', 'role']);
  }

  updatePassword(userId: number, passwordHash: string) {
    executeSync('user.updatePassword', { userId, passwordHash });
  }

  deleteTeacher(id: number) {
    executeSync('user.deleteTeacher', { id });
  }

  countTeachers(): number {
    return executeSync('user.countTeachers') || 0;
  }

  // --- Enquiries ---
  getEnquiries() {
    const list = executeSync('enquiry.getAll') || [];
    return list.map((e: any) => toTupleObject(e, ['id', 'name', 'email', 'message']));
  }

  createEnquiry(name: string, email: string, message: string) {
    const data = executeSync('enquiry.create', { name, email, message });
    return toTupleObject(data, ['id', 'name', 'email', 'message']);
  }

  deleteEnquiry(id: number) {
    executeSync('enquiry.delete', { id });
  }

  countEnquiries(): number {
    return executeSync('enquiry.count') || 0;
  }

  // --- Notices ---
  getLatestNotice() {
    const data = executeSync('notice.getLatest');
    if (!data) return null;
    return toTupleObject(data, ['id', 'title', 'content', 'posted_by', 'date']);
  }

  createNotice(title: string, content: string, posted_by: string) {
    const data = executeSync('notice.create', { title, content, posted_by });
    return toTupleObject(data, ['id', 'title', 'content', 'posted_by', 'date']);
  }

  // --- Notes ---
  getNotesByClass(className: string) {
    const list = executeSync('note.getByClass', { className }) || [];
    return list.map((n: any) =>
      toTupleObject(n, ['id', 'class_name', 'chapter', 'filename', 'file_url', 'teacher_id'])
    );
  }

  createNote(
    class_name: string,
    chapter: string,
    filename: string,
    file_url: string,
    teacher_id: number
  ) {
    const data = executeSync('note.create', {
      class_name,
      chapter,
      filename,
      file_url,
      teacher_id
    });
    return toTupleObject(data, [
      'id',
      'class_name',
      'chapter',
      'filename',
      'file_url',
      'teacher_id'
    ]);
  }

  findNoteByFilename(filename: string) {
    const data = executeSync('note.findByFilename', { filename });
    if (!data) return null;
    return toTupleObject(data, [
      'id',
      'class_name',
      'chapter',
      'filename',
      'file_url',
      'teacher_id'
    ]);
  }

  // --- Timetable ---
  getTimetable(filterClass?: string) {
    const list = executeSync('timetable.getAll', { filterClass }) || [];
    return list.map((t: any) =>
      toTupleObject(t, ['id', 'class_name', 'day', 'time', 'subject', 'teacher_name'])
    );
  }

  createTimetable(
    class_name: string,
    day: string,
    time: string,
    subject: string,
    teacher_name: string
  ) {
    const data = executeSync('timetable.create', {
      class_name,
      day,
      time,
      subject,
      teacher_name
    });
    return toTupleObject(data, [
      'id',
      'class_name',
      'day',
      'time',
      'subject',
      'teacher_name'
    ]);
  }

  deleteTimetable(id: number) {
    executeSync('timetable.delete', { id });
  }

  // --- Attendance ---
  hasAttendanceForClassAndDate(className: string, dateStr: string): boolean {
    return executeSync('attendance.hasForClassAndDate', { className, dateStr }) === true;
  }

  recordAttendance(records: Omit<AttendanceRecord, 'id'>[]) {
    executeSync('attendance.record', { records });
  }

  markSingleStudentAttendance(
    studentId: number,
    className: string,
    markedBy: string,
    dateStr?: string
  ): {
    status: 'ALREADY_MARKED' | 'UPDATED_TO_PRESENT' | 'MARKED_PRESENT';
    record: any;
  } {
    const targetDate = dateStr || getTodayIST();
    return executeSync('attendance.markSingleStudent', {
      studentId,
      className: String(className),
      markedBy,
      dateStr: targetDate
    });
  }

  getAttendanceByDate(dateStr?: string): AttendanceRecord[] {
    const targetDate = dateStr || getTodayIST();
    const list = executeSync('attendance.getByDate', { dateStr: targetDate }) || [];
    return list.map((a: any) =>
      toTupleObject(a, ['id', 'student_id', 'date', 'status', 'class_name', 'marked_by'])
    );
  }

  correctStudentAttendance(
    studentId: number,
    className: string,
    status: 'Present' | 'Absent',
    markedBy: string,
    dateStr?: string
  ): {
    status: 'CORRECTED' | 'NOT_FOUND';
    record: any;
  } {
    const targetDate = dateStr || getTodayIST();
    return executeSync('attendance.correctSingleStudent', {
      studentId,
      className: String(className),
      status,
      markedBy,
      dateStr: targetDate
    });
  }

  getStudentAttendance(studentId: number, month?: string) {
    const list = executeSync('attendance.getByStudent', { studentId, month }) || [];
    return list.map((a: any) =>
      toTupleObject(a, ['id', 'student_id', 'date', 'status', 'class_name', 'marked_by'])
    );
  }

  getStudentAttendanceMonths(studentId: number): string[] {
    return executeSync('attendance.getMonthsByStudent', { studentId }) || [];
  }

  // --- Doubts ---
  createDoubt(
    studentId: number,
    studentName: string,
    className: string,
    subject: string,
    question: string
  ) {
    const data = executeSync('doubt.create', {
      studentId,
      studentName,
      className,
      subject,
      question
    });
    return toTupleObject(data, [
      'id',
      'student_id',
      'student_name',
      'class_name',
      'subject',
      'question',
      'answer',
      'answered_by',
      'created_at'
    ]);
  }

  getDoubtsByTeacher(subject?: string, classesArray?: string[]) {
    const list = executeSync('doubt.getByTeacher', { subject, classes: classesArray }) || [];
    return list.map((d: any) =>
      toTupleObject(d, [
        'id',
        'student_id',
        'student_name',
        'class_name',
        'subject',
        'question',
        'answer',
        'answered_by',
        'created_at'
      ])
    );
  }

  getDoubtsByStudent(studentId: number) {
    const list = executeSync('doubt.getByStudent', { studentId }) || [];
    return list.map((d: any) =>
      toTupleObject(d, [
        'id',
        'student_id',
        'student_name',
        'class_name',
        'subject',
        'question',
        'answer',
        'answered_by',
        'created_at'
      ])
    );
  }

  answerDoubt(doubtId: number, answerText: string, teacherUsername: string) {
    const data = executeSync('doubt.answer', {
      doubtId,
      answerText,
      teacherUsername
    });
    return toTupleObject(data, [
      'id',
      'student_id',
      'student_name',
      'class_name',
      'subject',
      'question',
      'answer',
      'answered_by',
      'created_at'
    ]);
  }

  // --- Fees Management ---
  getStudentFeeSummary(studentId: number): StudentFeeSummary {
    const summary = executeSync('fee.getStudentSummary', { studentId });
    const payments = (summary?.payments || []).map((p: any) =>
      toTupleObject(p, [
        'id',
        'student_id',
        'amount',
        'payment_date',
        'payment_mode',
        'remarks',
        'receipt_no',
        'collected_by',
        'created_at',
        'razorpay_order_id',
        'razorpay_payment_id'
      ])
    );
    return {
      student_id: Number(summary?.student_id || studentId),
      total_fee: Number(summary?.total_fee || 0),
      paid_amount: Number(summary?.paid_amount || 0),
      pending_balance: Number(summary?.pending_balance || 0),
      status: summary?.status || 'Not Set',
      payments
    };
  }

  setStudentTotalFee(studentId: number, totalFee: number): StudentFee {
    const numericFee = Number(totalFee);
    if (!Number.isFinite(numericFee) || numericFee < 0) {
      throw new Error('Total fee must be a valid non-negative amount.');
    }
    const data = executeSync('fee.setTotalFee', {
      studentId,
      totalFee: Number(numericFee.toFixed(2))
    });
    return toTupleObject(data, ['id', 'student_id', 'total_fee', 'updated_at']);
  }

  recordFeePayment(params: {
    studentId: number;
    amount: number;
    paymentDate?: string;
    paymentMode: string;
    remarks?: string | null;
    collectedBy: string;
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
  }): FeePayment {
    const numericAmount = Number(params.amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }
    const paymentDate = (params.paymentDate || '').trim() || getTodayIST();
    const data = executeSync('fee.recordPayment', {
      studentId: params.studentId,
      amount: Number(numericAmount.toFixed(2)),
      paymentDate,
      paymentMode: params.paymentMode,
      remarks: params.remarks ?? null,
      collectedBy: params.collectedBy,
      razorpayOrderId: params.razorpayOrderId ?? null,
      razorpayPaymentId: params.razorpayPaymentId ?? null
    });
    return toTupleObject(data, [
      'id',
      'student_id',
      'amount',
      'payment_date',
      'payment_mode',
      'remarks',
      'receipt_no',
      'collected_by',
      'created_at',
      'razorpay_order_id',
      'razorpay_payment_id'
    ]);
  }

  getFeePaymentById(paymentId: number): FeePayment | undefined {
    const data = executeSync('fee.getPaymentById', { paymentId });
    return data
      ? toTupleObject(data, [
          'id',
          'student_id',
          'amount',
          'payment_date',
          'payment_mode',
          'remarks',
          'receipt_no',
          'collected_by',
          'created_at',
          'razorpay_order_id',
          'razorpay_payment_id'
        ])
      : undefined;
  }

  getFeePaymentByReceiptNo(receiptNo: string): FeePayment | undefined {
    const data = executeSync('fee.getPaymentByReceiptNo', { receiptNo });
    return data
      ? toTupleObject(data, [
          'id',
          'student_id',
          'amount',
          'payment_date',
          'payment_mode',
          'remarks',
          'receipt_no',
          'collected_by',
          'created_at',
          'razorpay_order_id',
          'razorpay_payment_id'
        ])
      : undefined;
  }

  getFeePaymentByRazorpayPaymentId(razorpayPaymentId: string): FeePayment | undefined {
    const data = executeSync('fee.getPaymentByRazorpayPaymentId', { razorpayPaymentId });
    return data
      ? toTupleObject(data, [
          'id',
          'student_id',
          'amount',
          'payment_date',
          'payment_mode',
          'remarks',
          'receipt_no',
          'collected_by',
          'created_at',
          'razorpay_order_id',
          'razorpay_payment_id'
        ])
      : undefined;
  }

  getAllStudentFeeSummaries(): { fees: StudentFee[]; payments: FeePayment[] } {
    const data = executeSync('fee.getAllStudentSummaries');
    const fees = (data?.fees || []).map((f: any) =>
      toTupleObject(f, ['id', 'student_id', 'total_fee', 'updated_at'])
    );
    const payments = (data?.payments || []).map((p: any) =>
      toTupleObject(p, [
        'id',
        'student_id',
        'amount',
        'payment_date',
        'payment_mode',
        'remarks',
        'receipt_no',
        'collected_by',
        'created_at',
        'razorpay_order_id',
        'razorpay_payment_id'
      ])
    );
    return { fees, payments };
  }
}

export const db = new SupabaseDatabase();
