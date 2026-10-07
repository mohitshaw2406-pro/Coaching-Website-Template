import { workerData } from 'worker_threads';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
);

function checkCredentials() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase error: SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) environment variables are required.'
    );
  }
}

export async function handleAction(action: string, payload: any): Promise<any> {
  checkCredentials();

  switch (action) {
    // ---------------- Students ----------------
    case 'student.findById': {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', payload.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    case 'student.findByEmail': {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('email', payload.email)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    case 'student.getAll': {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('class_name', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    case 'student.getByClass': {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_name', String(payload.className))
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    case 'student.getByClasses': {
      const { classes } = payload;
      if (!classes || classes.length === 0) return [];
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .in('class_name', classes)
        .order('class_name', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    case 'student.create': {
      const { data, error } = await supabase
        .from('students')
        .insert(payload.data)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case 'student.update': {
      const { data, error } = await supabase
        .from('students')
        .update(payload.data)
        .eq('id', payload.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case 'student.delete': {
      const { error: attError } = await supabase
        .from('attendance')
        .delete()
        .eq('student_id', payload.id);
      if (attError) throw attError;

      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', payload.id);
      if (error) throw error;
      return { success: true };
    }

    case 'student.count': {
      const { count, error } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    }

    // ---------------- Users ----------------
    case 'user.findById': {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', payload.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    case 'user.findByUsernameAndRole': {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('username', payload.username)
        .eq('role', payload.role)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    case 'user.getTeachers': {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'teacher')
        .order('id', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    case 'user.createTeacher': {
      const { data, error } = await supabase
        .from('users')
        .insert({
          username: payload.username,
          password: payload.passwordHash,
          role: 'teacher',
          subject: payload.subject,
          assigned_classes: payload.assigned_classes
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case 'user.updateTeacher': {
      const { data, error } = await supabase
        .from('users')
        .update({
          username: payload.username,
          subject: payload.subject,
          assigned_classes: payload.assigned_classes
        })
        .eq('id', payload.id)
        .eq('role', 'teacher')
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case 'user.updatePassword': {
      const { error } = await supabase
        .from('users')
        .update({ password: payload.passwordHash })
        .eq('id', payload.userId);
      if (error) throw error;
      return { success: true };
    }

    case 'user.deleteTeacher': {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', payload.id);
      if (error) throw error;
      return { success: true };
    }

    case 'user.countTeachers': {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher');
      if (error) throw error;
      return count || 0;
    }

    // ---------------- Enquiries ----------------
    case 'enquiry.getAll': {
      const { data, error } = await supabase
        .from('enquiries')
        .select('*')
        .order('id', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    case 'enquiry.create': {
      const { data, error } = await supabase
        .from('enquiries')
        .insert({
          name: payload.name,
          email: payload.email,
          message: payload.message
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case 'enquiry.delete': {
      const { error } = await supabase
        .from('enquiries')
        .delete()
        .eq('id', payload.id);
      if (error) throw error;
      return { success: true };
    }

    case 'enquiry.count': {
      const { count, error } = await supabase
        .from('enquiries')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    }

    // ---------------- Notices ----------------
    case 'notice.getLatest': {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    case 'notice.create': {
      const { data, error } = await supabase
        .from('notices')
        .insert({
          title: payload.title,
          content: payload.content,
          posted_by: payload.posted_by
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    // ---------------- Notes ----------------
    case 'note.getByClass': {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('class_name', String(payload.className))
        .order('id', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    case 'note.create': {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          class_name: payload.class_name,
          chapter: payload.chapter,
          filename: payload.filename,
          file_url: payload.file_url,
          teacher_id: payload.teacher_id
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case 'note.findByFilename': {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('filename', payload.filename)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    // ---------------- Timetable ----------------
    case 'timetable.getAll': {
      let query = supabase.from('timetable').select('*');
      if (payload.filterClass) {
        query = query.eq('class_name', String(payload.filterClass)).order('day');
      } else {
        query = query.order('class_name').order('day');
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }

    case 'timetable.create': {
      const { data, error } = await supabase
        .from('timetable')
        .insert({
          class_name: payload.class_name,
          day: payload.day,
          time: payload.time,
          subject: payload.subject,
          teacher_name: payload.teacher_name
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case 'timetable.delete': {
      const { error } = await supabase
        .from('timetable')
        .delete()
        .eq('id', payload.id);
      if (error) throw error;
      return { success: true };
    }

    // ---------------- Attendance ----------------
    case 'attendance.hasForClassAndDate': {
      const { count, error } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('class_name', String(payload.className))
        .eq('date', payload.dateStr);
      if (error) throw error;
      return (count || 0) > 0;
    }

    case 'attendance.record': {
      const records = Array.isArray(payload.records) ? payload.records : [];
      if (records.length === 0) return [];

      const absentRecords = records.filter((r: any) => r.status === 'Absent');
      const presentRecords = records.filter((r: any) => r.status === 'Present');

      if (absentRecords.length > 0) {
        const { error: absentError } = await supabase
          .from('attendance')
          .upsert(absentRecords, {
            onConflict: 'student_id,date',
            ignoreDuplicates: true
          });
        if (absentError) throw absentError;
      }

      if (presentRecords.length > 0) {
        const { error: presentError } = await supabase
          .from('attendance')
          .upsert(presentRecords, {
            onConflict: 'student_id,date'
          });
        if (presentError) throw presentError;
      }

      return { success: true };
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
      let query = supabase
        .from('attendance')
        .select('*')
        .eq('student_id', payload.studentId);
      if (payload.month) {
        query = query.like('date', `${payload.month}%`);
      }
      query = query.order('date', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }

    case 'attendance.getMonthsByStudent': {
      const { data, error } = await supabase
        .from('attendance')
        .select('date')
        .eq('student_id', payload.studentId)
        .order('date', { ascending: false });
      if (error) throw error;

      const set = new Set<string>();
      for (const row of data || []) {
        if (row.date && typeof row.date === 'string' && row.date.length >= 7) {
          set.add(row.date.slice(0, 7));
        }
      }
      return Array.from(set).sort().reverse();
    }

    // ---------------- Doubts ----------------
    case 'doubt.create': {
      const { data, error } = await supabase
        .from('doubts')
        .insert({
          student_id: payload.studentId,
          student_name: payload.studentName,
          class_name: String(payload.className),
          subject: payload.subject,
          question: payload.question
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    case 'doubt.getByTeacher': {
      let query = supabase.from('doubts').select('*');
      if (payload.classes && Array.isArray(payload.classes) && payload.classes.length > 0) {
        query = query.in('class_name', payload.classes);
      }
      if (payload.subject && typeof payload.subject === 'string' && payload.subject.trim()) {
        query = query.ilike('subject', payload.subject.trim());
      }
      query = query.order('id', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }

    case 'doubt.getByStudent': {
      const { data, error } = await supabase
        .from('doubts')
        .select('*')
        .eq('student_id', payload.studentId)
        .order('id', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    case 'doubt.answer': {
      const { data, error } = await supabase
        .from('doubts')
        .update({
          answer: payload.answerText,
          answered_by: payload.teacherUsername
        })
        .eq('id', payload.doubtId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    // ---------------- Fees Management ----------------
    case 'fee.getStudentSummary': {
      const studentId = Number(payload.studentId);
      if (!Number.isSafeInteger(studentId) || studentId <= 0) {
        throw new Error('Invalid student ID.');
      }

      const { data: feeRow, error: feeErr } = await supabase
        .from('student_fees')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();
      if (feeErr) throw feeErr;

      const { data: paymentRows, error: payErr } = await supabase
        .from('fee_payments')
        .select('*')
        .eq('student_id', studentId)
        .order('payment_date', { ascending: false })
        .order('id', { ascending: false });
      if (payErr) throw payErr;

      const payments = (paymentRows || []).map((p: any) => ({
        ...p,
        amount: Number(p.amount)
      }));

      const total_fee = feeRow ? Number(Number(feeRow.total_fee || 0).toFixed(2)) : 0;
      const paid_amount = Number(
        payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0).toFixed(2)
      );
      const pending_balance = Math.max(0, Number((total_fee - paid_amount).toFixed(2)));

      let status: 'Paid' | 'Partial' | 'Pending' | 'Not Set' = 'Not Set';
      if (total_fee <= 0 && paid_amount > 0) {
        status = 'Paid';
      } else if (total_fee <= 0) {
        status = 'Not Set';
      } else if (pending_balance === 0) {
        status = 'Paid';
      } else if (paid_amount > 0) {
        status = 'Partial';
      } else {
        status = 'Pending';
      }

      return {
        student_id: studentId,
        total_fee,
        paid_amount,
        pending_balance,
        status,
        payments
      };
    }

    case 'fee.setTotalFee': {
      const studentId = Number(payload.studentId);
      if (!Number.isSafeInteger(studentId) || studentId <= 0) {
        throw new Error('Invalid student ID.');
      }
      const totalFee = Number(payload.totalFee);
      if (!Number.isFinite(totalFee) || totalFee < 0) {
        throw new Error('Total fee must be a valid non-negative amount.');
      }

      const { data, error } = await supabase
        .from('student_fees')
        .upsert(
          {
            student_id: studentId,
            total_fee: Number(totalFee.toFixed(2)),
            updated_at: new Date().toISOString()
          },
          { onConflict: 'student_id' }
        )
        .select()
        .single();
      if (error) throw error;
      return {
        ...data,
        total_fee: Number(data.total_fee)
      };
    }

    case 'fee.recordPayment': {
      const studentId = Number(payload.studentId);
      if (!Number.isSafeInteger(studentId) || studentId <= 0) {
        throw new Error('Invalid student ID.');
      }
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Payment amount must be greater than zero.');
      }
      const paymentDate = String(payload.paymentDate || '').trim();
      if (!paymentDate) {
        throw new Error('Payment date is required.');
      }
      const paymentMode = String(payload.paymentMode || 'Cash').trim() || 'Cash';
      const collectedBy = String(payload.collectedBy || 'admin').trim() || 'admin';
      const remarks =
        payload.remarks !== undefined && payload.remarks !== null && String(payload.remarks).trim() !== ''
          ? String(payload.remarks).trim()
          : null;
      const razorpayOrderId =
        payload.razorpayOrderId !== undefined &&
        payload.razorpayOrderId !== null &&
        String(payload.razorpayOrderId).trim() !== ''
          ? String(payload.razorpayOrderId).trim()
          : null;
      const razorpayPaymentId =
        payload.razorpayPaymentId !== undefined &&
        payload.razorpayPaymentId !== null &&
        String(payload.razorpayPaymentId).trim() !== ''
          ? String(payload.razorpayPaymentId).trim()
          : null;

      const insertPayload: Record<string, any> = {
        student_id: studentId,
        amount: Number(amount.toFixed(2)),
        payment_date: paymentDate,
        payment_mode: paymentMode,
        remarks,
        collected_by: collectedBy
      };
      if (razorpayOrderId !== null) {
        insertPayload.razorpay_order_id = razorpayOrderId;
      }
      if (razorpayPaymentId !== null) {
        insertPayload.razorpay_payment_id = razorpayPaymentId;
      }

      // Omit receipt_no so PostgreSQL generates a guaranteed-unique receipt ID via sequence default
      const { data, error } = await supabase
        .from('fee_payments')
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;
      return {
        ...data,
        amount: Number(data.amount)
      };
    }

    case 'fee.getPaymentById': {
      const paymentId = Number(payload.paymentId);
      if (!Number.isSafeInteger(paymentId) || paymentId <= 0) {
        return null;
      }
      const { data, error } = await supabase
        .from('fee_payments')
        .select('*')
        .eq('id', paymentId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        amount: Number(data.amount)
      };
    }

    case 'fee.getPaymentByReceiptNo': {
      const receiptNo = String(payload.receiptNo || '').trim();
      if (!receiptNo) return null;
      const { data, error } = await supabase
        .from('fee_payments')
        .select('*')
        .eq('receipt_no', receiptNo)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        amount: Number(data.amount)
      };
    }

    case 'fee.getPaymentByRazorpayPaymentId': {
      const razorpayPaymentId = String(payload.razorpayPaymentId || '').trim();
      if (!razorpayPaymentId) return null;
      const { data, error } = await supabase
        .from('fee_payments')
        .select('*')
        .eq('razorpay_payment_id', razorpayPaymentId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        amount: Number(data.amount)
      };
    }

    case 'fee.getAllStudentSummaries': {
      const { data: feeRows, error: feeErr } = await supabase
        .from('student_fees')
        .select('*');
      if (feeErr) throw feeErr;

      const { data: paymentRows, error: payErr } = await supabase
        .from('fee_payments')
        .select('*')
        .order('payment_date', { ascending: false })
        .order('id', { ascending: false });
      if (payErr) throw payErr;

      return {
        fees: (feeRows || []).map((f: any) => ({
          ...f,
          total_fee: Number(f.total_fee)
        })),
        payments: (paymentRows || []).map((p: any) => ({
          ...p,
          amount: Number(p.amount)
        }))
      };
    }

    default:
      throw new Error(`Unknown Supabase action: ${action}`);
  }
}

if (workerData && workerData.port && workerData.sharedBuffer) {
  const { sharedBuffer, port } = workerData;
  const sharedInt32 = new Int32Array(sharedBuffer);

  port.on('message', async ({ action, payload }: { action: string; payload: any }) => {
    try {
      const result = await handleAction(action, payload);
      port.postMessage({ result });
    } catch (err: any) {
      port.postMessage({
        error: {
          message: err.message || String(err),
          code: err.code || null,
          details: err.details || null
        }
      });
    } finally {
      Atomics.store(sharedInt32, 0, 1);
      Atomics.notify(sharedInt32, 0, 1);
    }
  });
}
