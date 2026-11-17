/* Unit tests for the parts of the server functions that don't need the network or the database.
   Run: node --experimental-strip-types --test supabase/functions/tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { checkLead, checkScan, tooMany } from '../website-intake/validate.ts';
import { readBooking, verifyCalSignature } from '../_shared/cal.ts';
import { assignedMail, escapeHtml, visitorMail, whatsappValues, type LeadSummary } from '../_shared/templates.ts';
import { departmentName, languageOfPage } from '../_shared/labels.ts';

const form = {
  form: 'business_office', area: 'tecnologia', interests: [], first_name: 'José', last_name: 'Martínez',
  email: ' Jose@Empresa.ES ', phone: '+34 600 00 00 00', building: '14', unit: '3B', message: null,
  privacy_accepted: true, campaign: 'renta92-14', utm: { utm_source: 'qr', evil: 'x' }, page: '/asesoramiento/tecnologia',
};

test('a valid Business Office form is accepted and cleaned', () => {
  const r = checkLead(form);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.lead.email, 'jose@empresa.es');
  assert.equal(r.lead.phone, '+34600000000');
  assert.deepEqual(r.lead.utm, { utm_source: 'qr' });
  assert.equal(r.lead.campaign, 'renta92-14');
});

test('bad forms are refused with the field names', () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ ...form, form: 'hack' }, 'form'],
    [{ ...form, area: null }, 'area'],
    [{ ...form, area: 'giza' }, 'area'],
    [{ ...form, privacy_accepted: 'yes' }, 'privacy_accepted'],
    [{ ...form, email: 'nope' }, 'email'],
    [{ ...form, phone: '12345' }, 'phone'],
    [{ ...form, first_name: '  ' }, 'first_name'],
    [{ ...form, message: 'x'.repeat(2001) }, 'message'],
  ];
  for (const [body, field] of cases) {
    const r = checkLead(body);
    assert.ok(!r.ok, field);
    if (!r.ok) assert.ok(r.fields.includes(field), `${field} in ${r.fields}`);
  }
  assert.ok(!checkLead(null).ok);
  assert.ok(!checkLead([1]).ok);
});

test('Giza and quick forms never keep a department area', () => {
  const r = checkLead({ ...form, form: 'giza' });
  assert.ok(r.ok && r.lead.area === null);
});

test('campaign codes must look like codes', () => {
  const r = checkLead({ ...form, campaign: 'DROP TABLE;' });
  assert.ok(r.ok && r.lead.campaign === null);
  assert.equal(checkScan({ campaign: 'Renta92-14' }), 'renta92-14');
  assert.equal(checkScan({ campaign: '../x' }), null);
});

test('speed limit per visitor', () => {
  let blocked = 0;
  for (let i = 0; i < 12; i++) if (tooMany('test:1.2.3.4', 10, 10)) blocked++;
  assert.equal(blocked, 2);
  assert.equal(tooMany('test:5.6.7.8', 10, 10), false);
});

test('Cal.com signature: right secret yes, wrong secret or edited body no', async () => {
  const body = JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: {} });
  const signature = createHmac('sha256', 's3cret').update(body).digest('hex');
  assert.equal(await verifyCalSignature(body, signature, 's3cret'), true);
  assert.equal(await verifyCalSignature(body, signature, 'other'), false);
  assert.equal(await verifyCalSignature(body + ' ', signature, 's3cret'), false);
  assert.equal(await verifyCalSignature(body, null, 's3cret'), false);
});

test('Cal.com booking is read: lead id, email, time', () => {
  const b = readBooking({
    triggerEvent: 'BOOKING_RESCHEDULED',
    payload: {
      startTime: '2026-12-01T10:00:00Z',
      title: 'Asesoramiento',
      metadata: { leadId: '10000000-0000-0000-0000-000000000001' },
      attendees: [{ email: ' Ana@Example.com ' }],
    },
  });
  assert.deepEqual(b, {
    event: 'rescheduled', leadId: '10000000-0000-0000-0000-000000000001', email: 'ana@example.com',
    startTime: '2026-12-01T10:00:00Z', title: 'Asesoramiento',
  });
  assert.equal(readBooking({ triggerEvent: 'MEETING_ENDED' }).event, 'other');
  assert.equal(readBooking({ triggerEvent: 'BOOKING_CREATED', payload: { metadata: { leadId: 'x' } } }).leadId, null);
});

const lead: LeadSummary = {
  first_name: 'Ana', last_name: '<b>López</b>', email: 'ana@example.com', phone: '+34600000000',
  message: 'Hola <script>', departmentLabel: 'Tecnología y Automatización', campaignName: 'Renta 92 · 14',
};

test('emails escape what visitors type', () => {
  const mail = assignedMail(lead, 'https://crm/#/lead/1', true);
  assert.ok(!mail.html.includes('<script>'));
  assert.ok(mail.html.includes('&lt;script&gt;'));
  assert.ok(mail.subject.startsWith('Nuevo lead'));
  assert.equal(escapeHtml(`"'&`), '&quot;&#39;&amp;');
});

test('visitor email follows the language of the page', () => {
  assert.equal(languageOfPage('/Peydro-Capital-Alliance/en/giza/'), 'en');
  assert.equal(languageOfPage('/giza/'), 'es');
  assert.ok(visitorMail('Ana', departmentName('giza', 'en'), 'en').subject.startsWith('We have received'));
  assert.ok(visitorMail('Ana', departmentName('giza'), 'es').subject.startsWith('Hemos recibido'));
});

test('WhatsApp template gets 4 values in order', () => {
  assert.deepEqual(whatsappValues(lead, 'L'), ['Tecnología y Automatización', 'Ana <b>López</b>', '+34600000000', 'L']);
});
