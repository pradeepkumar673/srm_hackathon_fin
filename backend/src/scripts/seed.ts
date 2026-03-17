/**
 * =============================================================
 * src/scripts/seed.ts – Database Seed Script
 * =============================================================
 * Populates MongoDB with demo data for hackathon presentation.
 * Run with: npm run seed
 *
 * Creates:
 *  - 1 admin user
 *  - 3 citizen users
 *  - 4 workers (plumber, electrician, road-workers, sanitation)
 *  - 15 sample complaints across all categories and statuses
 *  - Notifications for each user
 *
 * All passwords are: "Password123!"
 * Locations spread across Chennai for realistic heatmap demo.
 * =============================================================
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Worker from '../models/Worker';
import Complaint from '../models/Complaint';
import { Notification } from '../models/Worker';

// Load environment variables
dotenv.config();

// ---- Chennai demo coordinates ----
const CHENNAI_LOCATIONS = [
  { lat: 13.0827, lng: 80.2707, address: 'Chennai Central, Chennai' },
  { lat: 13.0569, lng: 80.2619, address: 'Anna Salai, Chennai' },
  { lat: 13.0418, lng: 80.2341, address: 'T. Nagar, Chennai' },
  { lat: 13.0838, lng: 80.2089, address: 'Anna Nagar, Chennai' },
  { lat: 13.1067, lng: 80.2915, address: 'Perambur, Chennai' },
  { lat: 13.0731, lng: 80.2736, address: 'Egmore, Chennai' },
  { lat: 13.0604, lng: 80.2496, address: 'Kodambakkam, Chennai' },
  { lat: 13.0477, lng: 80.2553, address: 'Vadapalani, Chennai' },
];

const COMPLAINT_DATA = [
  {
    title: 'Large pothole on Anna Salai near signal',
    description: 'A very large pothole has developed near the traffic signal at Anna Salai. Multiple vehicles have been damaged.',
    category: 'Pothole',
    status: 'Pending',
    severityScore: 78,
    locationIdx: 1,
  },
  {
    title: 'Overflowing garbage bin at T. Nagar market',
    description: 'The garbage bin near T. Nagar market has been overflowing for 3 days. Stray animals are spreading waste.',
    category: 'Garbage',
    status: 'Assigned',
    severityScore: 65,
    locationIdx: 2,
  },
  {
    title: 'Street light not working for 2 weeks',
    description: 'Two street lights on Anna Nagar 1st street have been dark for 2 weeks. The area is completely unsafe at night.',
    category: 'Broken Street Light',
    status: 'InProgress',
    severityScore: 55,
    locationIdx: 3,
  },
  {
    title: 'Water pipe burst near school',
    description: 'A main water pipe has burst near Government School causing waterlogging and disrupting traffic.',
    category: 'Water Leakage',
    status: 'Pending',
    severityScore: 88,
    locationIdx: 0,
  },
  {
    title: 'Road completely damaged after rains',
    description: 'Heavy rains have washed away a large section of the road. Currently undriveable.',
    category: 'Road Damage',
    status: 'Resolved',
    severityScore: 91,
    locationIdx: 4,
  },
  {
    title: 'Pothole cluster near hospital entrance',
    description: 'Multiple potholes near the hospital entrance causing difficulty for ambulances.',
    category: 'Pothole',
    status: 'Assigned',
    severityScore: 85,
    locationIdx: 5,
  },
  {
    title: 'Illegal garbage dumping on roadside',
    description: 'Construction waste is being illegally dumped on the roadside near the park.',
    category: 'Garbage',
    status: 'Pending',
    severityScore: 45,
    locationIdx: 6,
  },
  {
    title: 'Water leakage from underground pipeline',
    description: 'Water is seeping through the road surface indicating an underground pipe leak.',
    category: 'Water Leakage',
    status: 'InProgress',
    severityScore: 72,
    locationIdx: 7,
  },
  {
    title: 'Broken road divider causing accidents',
    description: 'The road divider on the main road has been broken for a week. Two accidents have already occurred.',
    category: 'Road Damage',
    status: 'Pending',
    severityScore: 82,
    locationIdx: 1,
  },
  {
    title: 'Street lights flickering along the boulevard',
    description: 'Multiple street lights are flickering intermittently along the main boulevard.',
    category: 'Broken Street Light',
    status: 'Pending',
    severityScore: 40,
    locationIdx: 2,
  },
  {
    title: 'Deep pothole causing tyre punctures',
    description: 'A very deep pothole has appeared overnight. Already caused 4 tyre punctures today.',
    category: 'Pothole',
    status: 'Pending',
    severityScore: 76,
    locationIdx: 3,
  },
  {
    title: 'Sewage overflow on main road',
    description: 'Sewage is overflowing onto the main road due to a blocked drain. Causing health hazard.',
    category: 'Water Leakage',
    status: 'Assigned',
    severityScore: 93,
    locationIdx: 4,
  },
  {
    title: 'Entire road section collapsed',
    description: 'A 10-meter section of road has completely collapsed due to underground erosion.',
    category: 'Road Damage',
    status: 'Pending',
    severityScore: 96,
    locationIdx: 5,
  },
  {
    title: 'Garbage pile blocking fire station exit',
    description: 'Large pile of construction waste is partially blocking the fire station exit. Emergency hazard.',
    category: 'Garbage',
    status: 'InProgress',
    severityScore: 88,
    locationIdx: 6,
  },
  {
    title: 'Street light pole leaning dangerously',
    description: 'A street light pole is leaning at a dangerous angle after being hit by a vehicle.',
    category: 'Broken Street Light',
    status: 'Pending',
    severityScore: 70,
    locationIdx: 7,
  },
];

async function seedDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartcivic';

  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    // ---- Clean existing data ----
    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Worker.deleteMany({}),
      Complaint.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    const passwordHash = await bcrypt.hash('Password123!', 12);

    // ---- Create Admin User ----
    console.log('👮 Creating admin user...');
    const admin = await User.create({
      name: 'Chennai Admin',
      email: 'admin@smartcivic.in',
      passwordHash,
      role: 'admin',
      language: 'en',
      civicPoints: 0,
      currentLocation: { lat: 13.0827, lng: 80.2707 },
    });

    // ---- Create Citizen Users ----
    console.log('👥 Creating citizen users...');
    const citizens = await User.insertMany([
      {
        name: 'Priya Ramesh',
        email: 'priya@example.com',
        passwordHash,
        role: 'citizen',
        language: 'en',
        civicPoints: 150,
        currentLocation: { lat: 13.0569, lng: 80.2619 },
      },
      {
        name: 'Arjun Kumar',
        email: 'arjun@example.com',
        passwordHash,
        role: 'citizen',
        language: 'ta',
        civicPoints: 280,
        currentLocation: { lat: 13.0418, lng: 80.2341 },
      },
      {
        name: 'Deepa Subramaniam',
        email: 'deepa@example.com',
        passwordHash,
        role: 'citizen',
        language: 'en',
        civicPoints: 95,
        currentLocation: { lat: 13.0838, lng: 80.2089 },
      },
    ]);

    // ---- Create Worker Users + Worker Profiles ----
    console.log('👷 Creating worker users...');
    const workerUsersData = [
      { name: 'Ravi Kumar', email: 'ravi.worker@smartcivic.in', skills: ['road-worker', 'sanitation'], lat: 13.0731, lng: 80.2736 },
      { name: 'Murugan Selvam', email: 'murugan.worker@smartcivic.in', skills: ['plumber'], lat: 13.0604, lng: 80.2496 },
      { name: 'Senthil Nathan', email: 'senthil.worker@smartcivic.in', skills: ['electrician'], lat: 13.0477, lng: 80.2553 },
      { name: 'Balachandran T', email: 'bala.worker@smartcivic.in', skills: ['road-worker'], lat: 13.1067, lng: 80.2915 },
    ];

    const workerUsers = await User.insertMany(
      workerUsersData.map((w) => ({
        name: w.name,
        email: w.email,
        passwordHash,
        role: 'worker' as const,
        language: 'en' as const,
        civicPoints: 0,
        currentLocation: { lat: w.lat, lng: w.lng },
      }))
    );

    const workers = await Worker.insertMany(
      workerUsersData.map((w, i) => ({
        userId: workerUsers[i]._id,
        name: w.name,
        skills: w.skills,
        currentLocation: { lat: w.lat, lng: w.lng },
        isAvailable: true,
        phone: `+91 98765 ${43210 + i}`,
        assignedComplaints: [],
        lastLocationUpdate: new Date(),
      }))
    );

    // ---- Create Sample Complaints ----
    console.log('📋 Creating sample complaints...');
    const allCitizens = [...citizens];

    const complaintsToInsert = COMPLAINT_DATA.map((c, i) => {
      const location = CHENNAI_LOCATIONS[c.locationIdx];
      const reporter = allCitizens[i % allCitizens.length];
      const workerIdx = ['Assigned', 'InProgress'].includes(c.status)
        ? i % workers.length
        : -1;

      return {
        reportedBy: reporter._id,
        title: c.title,
        description: c.description,
        category: c.category,
        photoUrl: `https://picsum.photos/seed/${i + 100}/800/600`, // Placeholder images
        location: {
          lat: location.lat + (Math.random() - 0.5) * 0.01,
          lng: location.lng + (Math.random() - 0.5) * 0.01,
          address: location.address,
        },
        status: c.status,
        severityScore: c.severityScore,
        aiAnalysis: {
          detections: [
            { class: c.category.toLowerCase().replace(' ', '_'), confidence: 0.85 + Math.random() * 0.1, x: 320, y: 240, width: 200, height: 150 },
          ],
          description: `AI detected ${c.category} issue. ${c.description.substring(0, 80)}`,
          confidence: Math.round(75 + Math.random() * 20),
          fakeScore: Math.round(Math.random() * 15),
          severityFactors: [
            `Base AI severity: ${c.severityScore - 10}/100`,
            'Proximity to critical location: +10',
            'Area complaint density: +5',
          ],
          weatherImpact: c.severityScore > 80,
        },
        workerId: workerIdx >= 0 ? workers[workerIdx]._id : null,
        confirmations: Math.floor(Math.random() * 15),
        beforePhotoUrl: `https://picsum.photos/seed/${i + 100}/800/600`,
        afterPhotoUrl: c.status === 'Resolved' ? `https://picsum.photos/seed/${i + 200}/800/600` : '',
        tags: [c.category.toLowerCase(), 'chennai', 'urgent'],
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      };
    });

    const complaints = await Complaint.insertMany(complaintsToInsert);

    // ---- Assign complaints to workers ----
    for (let i = 0; i < complaints.length; i++) {
      const c = complaints[i];
      if (['Assigned', 'InProgress'].includes(c.status) && c.workerId) {
        await Worker.findByIdAndUpdate(c.workerId, {
          $addToSet: { assignedComplaints: c._id },
        });
      }
    }

    // ---- Create sample notifications ----
    console.log('🔔 Creating sample notifications...');
    await Notification.insertMany([
      {
        userId: admin._id,
        message: '🚨 ANOMALY DETECTED: 6 Pothole reports near Anna Salai in 30 minutes. Immediate action required.',
        type: 'anomaly',
        read: false,
        complaintId: complaints[0]._id,
      },
      {
        userId: citizens[0]._id,
        message: 'Your complaint "Large pothole on Anna Salai" has been received. Severity score: 78/100. A worker will be assigned soon.',
        type: 'status-update',
        read: false,
        complaintId: complaints[0]._id,
      },
      {
        userId: citizens[1]._id,
        message: 'Great news! 5 community members confirmed your garbage report. You earned 10 bonus civic points!',
        type: 'confirmation',
        read: true,
        complaintId: complaints[1]._id,
      },
      {
        userId: workerUsers[0]._id,
        message: 'New assignment: "Large pothole on Anna Salai" (Pothole) at Anna Salai, Chennai. Severity: 78/100',
        type: 'assignment',
        read: false,
        complaintId: complaints[0]._id,
      },
    ]);

    // ---- Final Summary ----
    console.log('\n✅ DATABASE SEEDED SUCCESSFULLY!\n');
    console.log('═══════════════════════════════════════');
    console.log('📊 Seed Summary:');
    console.log(`   👮 Admin:    admin@smartcivic.in`);
    console.log(`   👥 Citizens: priya@example.com, arjun@example.com, deepa@example.com`);
    console.log(`   👷 Workers:  ravi.worker@smartcivic.in, murugan.worker@smartcivic.in`);
    console.log(`                senthil.worker@smartcivic.in, bala.worker@smartcivic.in`);
    console.log(`   🔑 Password: Password123! (all accounts)`);
    console.log(`   📋 Complaints: ${complaints.length} created`);
    console.log(`   🗺️  Locations: Spread across Chennai`);
    console.log('═══════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ Seed failed:', err);
  } finally {
    await mongoose.connection.close();
    console.log('🛑 MongoDB connection closed');
    process.exit(0);
  }
}

seedDatabase();
