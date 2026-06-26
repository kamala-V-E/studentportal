/**
 * api.js - Pure MongoDB API Service for Student Portal
 * 
 * This file provides a pure API data layer that connects to MongoDB via REST API.
 * All data operations go through the backend - no localStorage fallback.
 *
 * Include this file in all portals:
 *   <script src="api.js"></script>
 */
const API_BASE = 'http://localhost:5000/api';
const API_BASE_URL = "https://college-website-06xd.onrender.com/api";

// Use the Render URL if localhost fails (for production deployment)
async function getApiBase() {
  try {
    const res = await fetch('http://localhost:5000/api/health', { signal: AbortSignal.timeout(1000) });
    if (res.ok) return 'http://localhost:5000/api';
  } catch (e) {
    console.log('🌐 [API] Using production API endpoint');
  }
  return API_BASE_URL;
}

// ====================== SERVER HEALTH CHECK ======================
async function checkServerOnline() {
  try {
    const base = await getApiBase();
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    return data.status === 'ok';
  } catch (e) {
    console.error('❌ [API] Backend server unreachable:', e.message);
    return false;
  }
}

// ====================== STUDENTS ======================
async function apiGetStudents() {
  const base = await getApiBase();
  const res = await fetch(`${base}/students`);
  if (!res.ok) throw new Error('Failed to fetch students');
  return await res.json();
}

async function apiRegisterStudent(studentData) {
  const base = await getApiBase();
  const res = await fetch(`${base}/students/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Registration failed');
  }
  return await res.json();
}

async function apiLoginStudent(registerNumber, password) {
  const base = await getApiBase();
  const res = await fetch(`${base}/students/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registerNumber, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Login failed');
  }
  return await res.json();
}

async function apiUpdateStudent(registerNumber, studentData) {
  const base = await getApiBase();
  const res = await fetch(`${base}/students/${registerNumber}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Update failed');
  }
  return await res.json();
}

// ====================== EVENTS ======================
async function apiGetEvents() {
  const base = await getApiBase();
  const res = await fetch(`${base}/events`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return await res.json();
}

async function apiSaveEvent(eventData) {
  const base = await getApiBase();
  // Check if exists first
  const all = await apiGetEvents();
  const exists = all.find(e => e.id === eventData.id);
  if (exists) {
    const res = await fetch(`${base}/events/${eventData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Failed to update event');
    }
    return await res.json();
  } else {
    const res = await fetch(`${base}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Failed to create event');
    }
    return await res.json();
  }
}

async function apiDeleteEvent(eventId) {
  const base = await getApiBase();
  const res = await fetch(`${base}/events/${eventId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete event');
}

// ====================== REGISTRATIONS ======================
async function apiGetRegistrations() {
  const base = await getApiBase();
  const res = await fetch(`${base}/registrations`);
  if (!res.ok) throw new Error('Failed to fetch registrations');
  return await res.json();
}

async function apiGetStudentRegistrations(registerNumber) {
  const base = await getApiBase();
  const res = await fetch(`${base}/registrations/student/${registerNumber}`);
  if (!res.ok) throw new Error('Failed to fetch student registrations');
  return await res.json();
}

async function apiSaveRegistration(regData) {
  const base = await getApiBase();
  const res = await fetch(`${base}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('❌ [API] Failed to save registration:', err);
    throw new Error(err.message || err.error || 'Failed to save registration');
  }
  return await res.json();
}

async function apiUpdateRegistration(id, updateData) {
  const base = await getApiBase();
  const res = await fetch(`${base}/registrations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('❌ [API] Failed to update registration:', err);
    throw new Error(err.message || err.error || 'Failed to update registration');
  }
  return await res.json();
}

// ====================== CERTIFICATES ======================
async function apiGetCertificates() {
  const base = await getApiBase();
  const res = await fetch(`${base}/certificates`);
  if (!res.ok) throw new Error('Failed to fetch certificates');
  return await res.json();
}

async function apiGetStudentCertificates(registerNumber) {
  const base = await getApiBase();
  const res = await fetch(`${base}/certificates/student/${registerNumber}`);
  if (!res.ok) throw new Error('Failed to fetch student certificates');
  return await res.json();
}

async function apiSaveCertificate(certData) {
  const base = await getApiBase();
  const res = await fetch(`${base}/certificates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(certData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('❌ [API] Failed to save certificate:', err);
    throw new Error(err.message || err.error || 'Failed to save certificate');
  }
  return await res.json();
}

async function apiUpdateCertificate(id, updateData) {
  const base = await getApiBase();
  const res = await fetch(`${base}/certificates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('❌ [API] Failed to update certificate:', err);
    throw new Error(err.message || err.error || 'Failed to update certificate');
  }
  return await res.json();
}

// ====================== OD APPLICATIONS ======================
async function apiGetODApplications() {
  const base = await getApiBase();
  const res = await fetch(`${base}/od`);
  if (!res.ok) throw new Error('Failed to fetch OD applications');
  return await res.json();
}

async function apiGetStudentODApplications(registerNumber) {
  const base = await getApiBase();
  const res = await fetch(`${base}/od/student/${registerNumber}`);
  if (!res.ok) throw new Error('Failed to fetch student OD applications');
  return await res.json();
}

async function apiSubmitODApplication(odData) {
  const base = await getApiBase();
  const res = await fetch(`${base}/od`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(odData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to submit OD application');
  }
  return await res.json();
}

async function apiUpdateODApplication(id, updateData) {
  const base = await getApiBase();
  const res = await fetch(`${base}/od/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to update OD application');
  }
  return await res.json();
}

// ====================== STUDENT NOTIFICATIONS ======================
async function apiGetStudentNotifications(registerNumber) {
  const base = await getApiBase();
  const res = await fetch(`${base}/notifications/student/${registerNumber}`);
  if (!res.ok) throw new Error('Failed to fetch student notifications');
  return await res.json();
}

async function apiAddStudentNotification(notifData) {
  const base = await getApiBase();
  const res = await fetch(`${base}/notifications/student`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notifData)
  });
  if (!res.ok) throw new Error('Failed to add student notification');
  return await res.json();
}

// ====================== HOD NOTIFICATIONS ======================
async function apiGetHODNotifications() {
  const base = await getApiBase();
  const res = await fetch(`${base}/notifications/hod`);
  if (!res.ok) throw new Error('Failed to fetch HOD notifications');
  return await res.json();
}

async function apiAddHODNotification(notifData) {
  const base = await getApiBase();
  const res = await fetch(`${base}/notifications/hod`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notifData)
  });
  if (!res.ok) throw new Error('Failed to add HOD notification');
  return await res.json();
}

async function apiUpdateHODNotification(id, updateData) {
  const base = await getApiBase();
  const res = await fetch(`${base}/notifications/hod/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData)
  });
  if (!res.ok) throw new Error('Failed to update HOD notification');
  return await res.json();
}

// ====================== ACTIVITIES ======================
async function apiGetActivities() {
  const base = await getApiBase();
  const res = await fetch(`${base}/activities`);
  if (!res.ok) throw new Error('Failed to fetch activities');
  return await res.json();
}

async function apiAddActivity(activityData) {
  const base = await getApiBase();
  const res = await fetch(`${base}/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(activityData)
  });
  if (!res.ok) throw new Error('Failed to add activity');
  return await res.json();
}

// ====================== INITIALIZATION ======================
// Call this early in every portal page to check server status
async function initAPI() {
  const online = await checkServerOnline();
  if (online) {
    console.log('✅ [API] Connected to MongoDB backend');
  } else {
    console.error('❌ [API] Backend server unreachable - please start the backend server');
  }
  return online;
}