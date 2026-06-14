import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { Resend } from 'resend';

const app = express();
app.use(cors());
app.use(express.json());

// ─── DATABASE CONNECTION ───────────────────────────────────────────────────

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB error:', err));

// ─── APPOINTMENT SCHEMA ────────────────────────────────────────────────────

const appointmentSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  email:   { type: String, required: true },
  date:    { type: String },
  time:    { type: String },
  message: { type: String },
}, { timestamps: true });

const Appointment = mongoose.model('Appointment', appointmentSchema);

// ─── EMAIL SETUP (RESEND) ──────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendConfirmationEmail(toEmail, toName, type) {
  const isAppointment = type === 'appointment';

  const subject = isAppointment
    ? 'Your Appointment Request — CalmQuest Counselling Clinic'
    : 'We Received Your Message — CalmQuest Counselling Clinic';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
      <h2 style="color: #2e7d6e;">CalmQuest Counselling Clinic</h2>
      <p>Dear ${toName},</p>
      ${isAppointment ? `
        <p>Thank you for requesting an appointment with us. We have received your
        booking and a member of our team will be in touch shortly to confirm your
        session.</p>
        <p>If you have any urgent concerns, please don't hesitate to reach out
        to us directly.</p>
      ` : `
        <p>Thank you for reaching out to CalmQuest. We have received your message
        and will respond as soon as possible, usually within 24 hours.</p>
      `}
      <p>Warm regards,</p>
      <p>
        <strong>The CalmQuest Team</strong><br/>
        <a href="https://calmquestcounsellingclinic.com">calmquestcounsellingclinic.com</a>
      </p>
    </div>
  `;

  await resend.emails.send({
    from: 'CalmQuest Counselling Clinic <onboarding@resend.dev>',
    to: toEmail,
    subject,
    html,
  });
}

async function sendOwnerNotification(appointment) {
  const { name, email, date, time, message } = appointment;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
      <h2 style="color: #2e7d6e;">New Appointment Booking 📅</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Date:</strong> ${date || 'Not specified'}</p>
      <p><strong>Time:</strong> ${time || 'Not specified'}</p>
      <p><strong>Message:</strong> ${message || 'No additional message'}</p>
    </div>
  `;

  await resend.emails.send({
    from: 'CalmQuest Bookings <onboarding@resend.dev>',
    to: 'calmquestcounselingclinic@gmail.com',
    subject: `New Appointment from ${name}`,
    html,
  });
}

// ─── ROUTES ────────────────────────────────────────────────────────────────

// Appointment booking
app.post('/api/appointments', async (req, res) => {
  try {
    const { name, email, date, time, message } = req.body;

    // Save to MongoDB
    const appointment = new Appointment({ name, email, date, time, message });
    await appointment.save();

    // Send confirmation to client
    await sendConfirmationEmail(email, name, 'appointment');

    // Notify the clinic owner
    await sendOwnerNotification(appointment);

    res.status(201).json({ message: 'Appointment booked successfully' });
  } catch (error) {
    console.error('Appointment error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Contact form
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // Send confirmation email
    await sendConfirmationEmail(email, name, 'contact');

    res.status(200).json({ message: 'Message received' });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Get all appointments
app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ createdAt: -1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch appointments' });
  }
});

// ─── START SERVER ──────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});