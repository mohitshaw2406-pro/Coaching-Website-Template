import bcrypt from 'bcryptjs';

export interface InMemoryStore {
  students: any[];
  users: any[];
  enquiries: any[];
  notices: any[];
  notes: any[];
  timetables: any[];
  attendance: any[];
  doubts: any[];
  studentFees: any[];
  feePayments: any[];
  receiptSeq: number;
}

// Initial default seed data
const initialStore: InMemoryStore = {
  students: [
    {
      id: 1,
      name: 'Aarav Sharma',
      email: '9876543210',
      password: bcrypt.hashSync('student123', 10),
      class_name: '10',
      photo_url: null,
      created_at: new Date('2026-09-01T08:00:00Z').toISOString()
    },
    {
      id: 2,
      name: 'Priya Mukherjee',
      email: '9876543211',
      password: bcrypt.hashSync('student123', 10),
      class_name: '12',
      photo_url: null,
      created_at: new Date('2026-09-02T08:00:00Z').toISOString()
    },
    {
      id: 3,
      name: 'Rohan Ghosh',
      email: '9876543212',
      password: bcrypt.hashSync('student123', 10),
      class_name: '9',
      photo_url: null,
      created_at: new Date('2026-09-03T08:00:00Z').toISOString()
    }
  ],
  users: [
    {
      id: 1,
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      subject: null,
      assigned_classes: null,
      created_at: new Date('2026-08-01T08:00:00Z').toISOString()
    },
    {
      id: 2,
      username: 'teacher',
      password: bcrypt.hashSync('teacher123', 10),
      role: 'teacher',
      subject: 'Mathematics',
      assigned_classes: '9,10,11,12',
      created_at: new Date('2026-08-02T08:00:00Z').toISOString()
    },
    {
      id: 3,
      username: 'sharma',
      password: bcrypt.hashSync('teacher123', 10),
      role: 'teacher',
      subject: 'Science',
      assigned_classes: '6,7,8,9,10',
      created_at: new Date('2026-08-03T08:00:00Z').toISOString()
    },
    {
      id: 4,
      username: 'das',
      password: bcrypt.hashSync('teacher123', 10),
      role: 'teacher',
      subject: 'Computer Science',
      assigned_classes: '11,12',
      created_at: new Date('2026-08-04T08:00:00Z').toISOString()
    }
  ],
  enquiries: [
    {
      id: 1,
      name: 'Ananya Sen',
      email: '9830112233',
      message: 'Interested in Class 11 Computer Science and Maths batch timings.',
      created_at: new Date('2026-10-01T10:00:00Z').toISOString()
    },
    {
      id: 2,
      name: 'Debjit Roy',
      email: '9830998877',
      message: 'Looking for admissions in Class 10 Board preparation batch.',
      created_at: new Date('2026-10-03T11:00:00Z').toISOString()
    }
  ],
  notices: [
    {
      id: 1,
      title: 'Welcome to Academic Session 2026-27',
      content: 'All classes for the new academic session have officially commenced. Collect your digital ID cards and check weekly timetables.',
      class_name: null,
      posted_by: 'admin',
      date: '2026-10-01',
      created_at: new Date('2026-10-01T08:00:00Z').toISOString()
    }
  ],
  notes: [
    {
      id: 1,
      class_name: '10',
      chapter: 'Real Numbers & Polynomials',
      filename: 'maths_class10_ch1.pdf',
      file_url: '#',
      teacher_id: 2,
      created_at: new Date('2026-10-02T08:00:00Z').toISOString()
    },
    {
      id: 2,
      class_name: '10',
      chapter: 'Chemical Reactions and Equations',
      filename: 'science_class10_ch1.pdf',
      file_url: '#',
      teacher_id: 3,
      created_at: new Date('2026-10-02T09:00:00Z').toISOString()
    }
  ],
  timetables: [
    {
      id: 1,
      class_name: '10',
      day: 'Monday',
      time: '09:00 AM - 10:30 AM',
      subject: 'Mathematics',
      teacher_name: 'teacher'
    },
    {
      id: 2,
      class_name: '10',
      day: 'Monday',
      time: '11:00 AM - 12:30 PM',
      subject: 'Science',
      teacher_name: 'sharma'
    },
    {
      id: 3,
      class_name: '12',
      day: 'Monday',
      time: '10:00 AM - 11:30 AM',
      subject: 'Computer Science',
      teacher_name: 'das'
    },
    {
      id: 4,
      class_name: '9',
      day: 'Tuesday',
      time: '09:00 AM - 10:30 AM',
      subject: 'Mathematics',
      teacher_name: 'teacher'
    }
  ],
  attendance: [
    {
      id: 1,
      student_id: 1,
      date: '2026-10-06',
      status: 'Present',
      class_name: '10',
      marked_by: 'teacher',
      created_at: new Date('2026-10-06T09:15:00Z').toISOString()
    },
    {
      id: 2,
      student_id: 2,
      date: '2026-10-06',
      status: 'Present',
      class_name: '12',
      marked_by: 'das',
      created_at: new Date('2026-10-06T10:15:00Z').toISOString()
    }
  ],
  doubts: [
    {
      id: 1,
      student_id: 1,
      student_name: 'Aarav Sharma',
      class_name: '10',
      subject: 'Mathematics',
      question: 'How do we solve quadratic equations using the completing square method?',
      answer: 'Add and subtract (b/2a)^2 to achieve the standard squared binomial form.',
      answered_by: 'teacher',
      created_at: '2026-10-05 10:30:00'
    }
  ],
  studentFees: [
    {
      id: 1,
      student_id: 1,
      total_fee: 15000,
      updated_at: new Date('2026-09-01T08:00:00Z').toISOString()
    },
    {
      id: 2,
      student_id: 2,
      total_fee: 20000,
      updated_at: new Date('2026-09-02T08:00:00Z').toISOString()
    },
    {
      id: 3,
      student_id: 3,
      total_fee: 12000,
      updated_at: new Date('2026-09-03T08:00:00Z').toISOString()
    }
  ],
  feePayments: [
    {
      id: 1,
      student_id: 1,
      amount: 5000,
      payment_date: '2026-10-01',
      payment_mode: 'Cash',
      remarks: 'First installment',
      receipt_no: 'BCA-RCPT-2026-0001',
      collected_by: 'admin',
      created_at: new Date('2026-10-01T10:00:00Z').toISOString(),
      razorpay_order_id: null,
      razorpay_payment_id: null
    },
    {
      id: 2,
      student_id: 2,
      amount: 20000,
      payment_date: '2026-10-02',
      payment_mode: 'UPI',
      remarks: 'Full year tuition fee payment',
      receipt_no: 'BCA-RCPT-2026-0002',
      collected_by: 'admin',
      created_at: new Date('2026-10-02T11:00:00Z').toISOString(),
      razorpay_order_id: null,
      razorpay_payment_id: null
    }
  ],
  receiptSeq: 2
};

const store: InMemoryStore = { ...initialStore };

export function handleInMemoryAction(action: string, payload: any = {}): any {
  switch (action) {
    // ---------------- Students ----------------
    case 'student.findById': {
      const id = Number(payload.id);
      return store.students.find(s => s.id === id) || null;
    }

    case 'student.findByEmail': {
      const email = String(payload.email || '').trim();
      return store.students.find(s => String(s.email).trim() === email) || null;
    }

    case 'student.getAll': {
      return [...store.students].sort((a, b) => {
        const classComp = String(a.class_name).localeCompare(String(b.class_name));
        if (classComp !== 0) return classComp;
        return String(a.name).localeCompare(String(b.name));
      });
    }

    case 'student.getByClass': {
      return store.students
        .filter(s => String(s.class_name) === String(payload.className))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }

    case 'student.getByClasses': {
      const classes = Array.isArray(payload.classes) ? payload.classes.map(String) : [];
      if (classes.length === 0) return [];
      return store.students
        .filter(s => classes.includes(String(s.class_name)))
        .sort((a, b) => {
          const classComp = String(a.class_name).localeCompare(String(b.class_name));
          if (classComp !== 0) return classComp;
          return String(a.name).localeCompare(String(b.name));
        });
    }

    case 'student.create': {
      const data = payload.data || {};
      const existing = store.students.find(s => s.email === data.email);
      if (existing) {
        throw new Error('Mobile number already exists ❌');
      }
      const nextId = store.students.reduce((max, s) => Math.max(max, s.id || 0), 0) + 1;
      const newStudent = {
        id: nextId,
        name: data.name,
        email: data.email,
        password: data.password,
        class_name: String(data.class_name),
        photo_url: data.photo_url || null,
        created_at: new Date().toISOString()
      };
      store.students.push(newStudent);
      return newStudent;
    }

    case 'student.update': {
      const id = Number(payload.id);
      const idx = store.students.findIndex(s => s.id === id);
      if (idx === -1) return null;
      store.students[idx] = { ...store.students[idx], ...payload.data };
      return store.students[idx];
    }

    case 'student.delete': {
      const id = Number(payload.id);
      store.attendance = store.attendance.filter(a => a.student_id !== id);
      store.doubts = store.doubts.filter(d => d.student_id !== id);
      store.studentFees = store.studentFees.filter(f => f.student_id !== id);
      store.feePayments = store.feePayments.filter(p => p.student_id !== id);
      store.students = store.students.filter(s => s.id !== id);
      return true;
    }

    case 'student.count': {
      return store.students.length;
    }

    // ---------------- Users ----------------
    case 'user.findById': {
      const id = Number(payload.id);
      return store.users.find(u => u.id === id) || null;
    }

    case 'user.findByUsernameAndRole': {
      const username = String(payload.username || '').trim();
      const role = String(payload.role || '').trim();
      return (
        store.users.find(
          u => u.username.toLowerCase() === username.toLowerCase() && u.role === role
        ) || null
      );
    }

    case 'user.getTeachers': {
      return store.users
        .filter(u => u.role === 'teacher')
        .sort((a, b) => String(a.username).localeCompare(String(b.username)));
    }

    case 'user.createTeacher': {
      const nextId = store.users.reduce((max, u) => Math.max(max, u.id || 0), 0) + 1;
      const pw = payload.passwordHash || payload.password;
      const newTeacher = {
        id: nextId,
        username: payload.username,
        password: pw,
        role: 'teacher',
        subject: payload.subject,
        assigned_classes: payload.assigned_classes,
        created_at: new Date().toISOString()
      };
      store.users.push(newTeacher);
      return newTeacher;
    }

    case 'user.updateTeacher': {
      const id = Number(payload.id);
      const idx = store.users.findIndex(u => u.id === id && u.role === 'teacher');
      if (idx === -1) return null;
      if (payload.username) store.users[idx].username = payload.username;
      store.users[idx].subject = payload.subject;
      store.users[idx].assigned_classes = payload.assigned_classes;
      return store.users[idx];
    }

    case 'user.updatePassword': {
      const id = Number(payload.userId);
      const user = store.users.find(u => u.id === id);
      if (user) {
        user.password = payload.passwordHash;
      }
      return true;
    }

    case 'user.deleteTeacher': {
      const id = Number(payload.id);
      store.users = store.users.filter(u => !(u.id === id && u.role === 'teacher'));
      return true;
    }

    case 'user.countTeachers': {
      return store.users.filter(u => u.role === 'teacher').length;
    }

    // ---------------- Enquiries ----------------
    case 'enquiry.getAll': {
      return [...store.enquiries].sort((a, b) => b.id - a.id);
    }

    case 'enquiry.create': {
      const nextId = store.enquiries.reduce((max, e) => Math.max(max, e.id || 0), 0) + 1;
      const newEnquiry = {
        id: nextId,
        name: payload.name,
        email: payload.email,
        message: payload.message,
        created_at: new Date().toISOString()
      };
      store.enquiries.push(newEnquiry);
      return newEnquiry;
    }

    case 'enquiry.delete': {
      const id = Number(payload.id);
      store.enquiries = store.enquiries.filter(e => e.id !== id);
      return true;
    }

    case 'enquiry.count': {
      return store.enquiries.length;
    }

    // ---------------- Notices ----------------
    case 'notice.getLatest': {
      if (store.notices.length === 0) return null;
      return [...store.notices].sort((a, b) => b.id - a.id)[0];
    }

    case 'notice.create': {
      const nextId = store.notices.reduce((max, n) => Math.max(max, n.id || 0), 0) + 1;
      const newNotice = {
        id: nextId,
        title: payload.title,
        content: payload.content,
        posted_by: payload.posted_by,
        date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      };
      store.notices.push(newNotice);
      return newNotice;
    }

    // ---------------- Notes ----------------
    case 'note.getByClass': {
      const className = String(payload.className);
      return store.notes
        .filter(n => String(n.class_name) === className)
        .sort((a, b) => String(a.chapter).localeCompare(String(b.chapter)));
    }

    case 'note.create': {
      const nextId = store.notes.reduce((max, n) => Math.max(max, n.id || 0), 0) + 1;
      const newNote = {
        id: nextId,
        class_name: payload.class_name,
        chapter: payload.chapter,
        filename: payload.filename,
        file_url: payload.file_url,
        teacher_id: payload.teacher_id,
        created_at: new Date().toISOString()
      };
      store.notes.push(newNote);
      return newNote;
    }

    case 'note.findByFilename': {
      return store.notes.find(n => n.filename === payload.filename) || null;
    }

    // ---------------- Timetable ----------------
    case 'timetable.getAll': {
      let list = [...store.timetables];
      if (payload.filterClass) {
        list = list.filter(t => String(t.class_name) === String(payload.filterClass));
      }
      return list.sort((a, b) => {
        const d = String(a.day).localeCompare(String(b.day));
        if (d !== 0) return d;
        return String(a.time).localeCompare(String(b.time));
      });
    }

    case 'timetable.create': {
      const nextId = store.timetables.reduce((max, t) => Math.max(max, t.id || 0), 0) + 1;
      const entry = {
        id: nextId,
        class_name: payload.class_name,
        day: payload.day,
        time: payload.time,
        subject: payload.subject,
        teacher_name: payload.teacher_name
      };
      store.timetables.push(entry);
      return entry;
    }

    case 'timetable.delete': {
      const id = Number(payload.id);
      store.timetables = store.timetables.filter(t => t.id !== id);
      return true;
    }

    // ---------------- Attendance ----------------
    case 'attendance.hasForClassAndDate': {
      const className = String(payload.className);
      const dateStr = String(payload.dateStr);
      return store.attendance.some(a => String(a.class_name) === className && a.date === dateStr);
    }

    case 'attendance.record': {
      const records = Array.isArray(payload.records) ? payload.records : [];
      for (const r of records) {
        const studentId = Number(r.student_id);
        const date = String(r.date);
        const existingIdx = store.attendance.findIndex(
          a => a.student_id === studentId && a.date === date
        );
        if (existingIdx >= 0) {
          store.attendance[existingIdx].status = r.status;
          store.attendance[existingIdx].marked_by = r.marked_by;
        } else {
          const nextId = store.attendance.reduce((max, a) => Math.max(max, a.id || 0), 0) + 1;
          store.attendance.push({
            id: nextId,
            student_id: studentId,
            date,
            status: r.status,
            class_name: String(r.class_name),
            marked_by: r.marked_by
          });
        }
      }
      return true;
    }

    case 'attendance.markSingleStudent': {
      const studentId = Number(payload.studentId);
      const dateStr = String(payload.dateStr);
      const existing = store.attendance.find(a => a.student_id === studentId && a.date === dateStr);
      if (existing && existing.status === 'Present') {
        return { status: 'ALREADY_MARKED', record: existing };
      }
      const wasAbsent = Boolean(existing && existing.status === 'Absent');
      if (existing) {
        existing.status = 'Present';
        existing.marked_by = payload.markedBy;
        existing.class_name = String(payload.className);
        return {
          status: wasAbsent ? 'UPDATED_TO_PRESENT' : 'MARKED_PRESENT',
          record: existing
        };
      }
      const nextId = store.attendance.reduce((max, a) => Math.max(max, a.id || 0), 0) + 1;
      const newRec = {
        id: nextId,
        student_id: studentId,
        date: dateStr,
        status: 'Present',
        class_name: String(payload.className),
        marked_by: payload.markedBy
      };
      store.attendance.push(newRec);
      return {
        status: 'MARKED_PRESENT',
        record: newRec
      };
    }

    case 'attendance.getByDate': {
      const dateStr = String(payload.dateStr);
      return store.attendance.filter(a => a.date === dateStr).sort((a, b) => b.id - a.id);
    }

    case 'attendance.correctSingleStudent': {
      const studentId = Number(payload.studentId);
      const dateStr = String(payload.dateStr);
      const existing = store.attendance.find(a => a.student_id === studentId && a.date === dateStr);
      if (!existing) {
        return { status: 'NOT_FOUND', record: null };
      }
      existing.status = payload.status;
      existing.marked_by = payload.markedBy;
      existing.class_name = String(payload.className);
      return { status: 'CORRECTED', record: existing };
    }

    case 'attendance.getByStudent': {
      const studentId = Number(payload.studentId);
      let list = store.attendance.filter(a => a.student_id === studentId);
      if (payload.month) {
        list = list.filter(a => a.date.startsWith(payload.month));
      }
      return list.sort((a, b) => b.date.localeCompare(a.date));
    }

    case 'attendance.getMonthsByStudent': {
      const studentId = Number(payload.studentId);
      const months = Array.from(
        new Set(
          store.attendance
            .filter(a => a.student_id === studentId)
            .map(a => a.date.substring(0, 7))
        )
      )
        .sort()
        .reverse();
      return months;
    }

    // ---------------- Doubts ----------------
    case 'doubt.create': {
      const nextId = store.doubts.reduce((max, d) => Math.max(max, d.id || 0), 0) + 1;
      const newDoubt = {
        id: nextId,
        student_id: Number(payload.student_id || payload.studentId),
        student_name: payload.student_name || payload.studentName,
        class_name: payload.class_name || payload.className,
        subject: payload.subject,
        question: payload.question,
        answer: null,
        answered_by: null,
        created_at: new Date().toISOString()
      };
      store.doubts.push(newDoubt);
      return newDoubt;
    }

    case 'doubt.getByTeacher': {
      let list = [...store.doubts];
      if (payload.subject) {
        list = list.filter(d => d.subject.toLowerCase() === payload.subject.toLowerCase());
      }
      if (payload.classes && payload.classes.length > 0) {
        const classes = payload.classes.map(String);
        list = list.filter(d => classes.includes(String(d.class_name)));
      }
      return list.sort((a, b) => b.id - a.id);
    }

    case 'doubt.getByStudent': {
      const studentId = Number(payload.studentId);
      return store.doubts.filter(d => d.student_id === studentId).sort((a, b) => b.id - a.id);
    }

    case 'doubt.answer': {
      const id = Number(payload.id || payload.doubtId);
      const doubt = store.doubts.find(d => d.id === id);
      if (doubt) {
        doubt.answer = payload.answer || payload.answerText;
        doubt.answered_by = payload.answered_by || payload.teacherUsername;
      }
      return doubt || null;
    }

    // ---------------- Fees Management ----------------
    case 'fee.getStudentSummary': {
      const studentId = Number(payload.studentId);
      if (!Number.isSafeInteger(studentId) || studentId <= 0) {
        throw new Error('Invalid student ID.');
      }
      const feeRow = store.studentFees.find(f => f.student_id === studentId);
      const payments = store.feePayments
        .filter(p => p.student_id === studentId)
        .map(p => ({ ...p, amount: Number(p.amount) }))
        .sort((a, b) => {
          if (a.payment_date !== b.payment_date) return b.payment_date.localeCompare(a.payment_date);
          return b.id - a.id;
        });

      const total_fee = feeRow ? Number(Number(feeRow.total_fee || 0).toFixed(2)) : 0;
      const paid_amount = Number(
        payments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2)
      );
      const pending_balance = Math.max(0, Number((total_fee - paid_amount).toFixed(2)));

      let status: 'Paid' | 'Partial' | 'Pending' | 'Not Set' = 'Not Set';
      if (total_fee <= 0 && paid_amount > 0) status = 'Paid';
      else if (total_fee <= 0) status = 'Not Set';
      else if (pending_balance === 0) status = 'Paid';
      else if (paid_amount > 0) status = 'Partial';
      else status = 'Pending';

      return { student_id: studentId, total_fee, paid_amount, pending_balance, status, payments };
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
      let feeRow = store.studentFees.find(f => f.student_id === studentId);
      if (feeRow) {
        feeRow.total_fee = Number(totalFee.toFixed(2));
        feeRow.updated_at = new Date().toISOString();
      } else {
        const nextId = store.studentFees.reduce((max, f) => Math.max(max, f.id || 0), 0) + 1;
        feeRow = {
          id: nextId,
          student_id: studentId,
          total_fee: Number(totalFee.toFixed(2)),
          updated_at: new Date().toISOString()
        };
        store.studentFees.push(feeRow);
      }
      return feeRow;
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

      store.receiptSeq += 1;
      const receiptNo = `BCA-RCPT-2026-${String(store.receiptSeq).padStart(4, '0')}`;
      const nextId = store.feePayments.reduce((max, p) => Math.max(max, p.id || 0), 0) + 1;

      const newPayment = {
        id: nextId,
        student_id: studentId,
        amount: Number(amount.toFixed(2)),
        payment_date: paymentDate,
        payment_mode: paymentMode,
        remarks,
        receipt_no: receiptNo,
        collected_by: collectedBy,
        created_at: new Date().toISOString(),
        razorpay_order_id: payload.razorpayOrderId ?? null,
        razorpay_payment_id: payload.razorpayPaymentId ?? null
      };

      store.feePayments.push(newPayment);
      return newPayment;
    }

    case 'fee.getPaymentById': {
      const paymentId = Number(payload.paymentId);
      if (!Number.isSafeInteger(paymentId) || paymentId <= 0) return null;
      const p = store.feePayments.find(pay => pay.id === paymentId);
      return p ? { ...p, amount: Number(p.amount) } : null;
    }

    case 'fee.getPaymentByReceiptNo': {
      const receiptNo = String(payload.receiptNo || '').trim();
      if (!receiptNo) return null;
      const p = store.feePayments.find(pay => pay.receipt_no === receiptNo);
      return p ? { ...p, amount: Number(p.amount) } : null;
    }

    case 'fee.getPaymentByRazorpayPaymentId': {
      const razorpayPaymentId = String(payload.razorpayPaymentId || '').trim();
      if (!razorpayPaymentId) return null;
      const p = store.feePayments.find(pay => pay.razorpay_payment_id === razorpayPaymentId);
      return p ? { ...p, amount: Number(p.amount) } : null;
    }

    case 'fee.getAllStudentSummaries': {
      return {
        fees: store.studentFees.map(f => ({ ...f, total_fee: Number(f.total_fee) })),
        payments: store.feePayments.map(p => ({ ...p, amount: Number(p.amount) }))
      };
    }

    default:
      throw new Error(`Unknown action in in-memory database: ${action}`);
  }
}
