import request from "supertest";
import { app } from "../server.js";
import mongoose from "mongoose";
import MeetingRisk from "../models/meetingRiskModel.js";
import RiskEscalation from "../models/riskEscalationModel.js";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";
import { evaluateRiskEscalations } from "../services/riskEscalationService.js";

let adminToken;
let testAdmin;
let testMeeting;
const orgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  // Cleanup collections
  await User.deleteMany({ email: /risk-admin-.*@example\.com/ });
  await Meeting.deleteMany({ title: "Risk Escalation Test Meeting" });
  await MeetingRisk.deleteMany({});
  await RiskEscalation.deleteMany({});
  await Notification.deleteMany({});

  // Create admin user
  testAdmin = await User.create({
    name: "Risk Admin",
    email: `risk-admin-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: orgId,
    clerkUserId: `clerk_risk_${Date.now()}`,
  });

  adminToken = createClerkTestToken({
    clerkUserId: testAdmin.clerkUserId,
    email: testAdmin.email,
  });

  // Create meeting
  testMeeting = await Meeting.create({
    title: "Risk Escalation Test Meeting",
    uploadedBy: testAdmin._id,
    organization: orgId,
    date: new Date(),
  });
});

describe("Meeting Risk Mitigation & SLA Escalation System (#2555)", () => {
  it("should log flagged risks with severity scores", async () => {
    const res = await request(app)
      .post("/api/meeting-risks")
      .set(authHeader(adminToken))
      .send({
        meetingId: testMeeting._id,
        title: "Technical Dependency Block",
        description: "API updates delayed",
        category: "Technical",
        probability: 4,
        impact: 4,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.riskScore).toBe(16); // 4 * 4
    expect(res.body.data.status).toBe("Open");
  });

  it("should allow administrators to attach mitigation plan and owner", async () => {
    // 1. Create a risk
    const risk = await MeetingRisk.create({
      meetingId: testMeeting._id,
      organizationId: orgId,
      title: "Budget Deficit Risk",
      category: "Financial",
      probability: 3,
      impact: 4,
      riskScore: 12,
      createdBy: testAdmin._id,
    });

    // 2. Attach mitigation
    const res = await request(app)
      .put(`/api/meeting-risks/${risk._id}/mitigate`)
      .set(authHeader(adminToken))
      .send({
        mitigationPlan: "Request additional funds from stakeholder board",
        ownerId: testAdmin._id,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("Mitigated");
    expect(res.body.data.mitigationPlan).toBe(
      "Request additional funds from stakeholder board",
    );
    expect(res.body.data.ownerId).toBe(testAdmin._id.toString());
  });

  it("should escalate open high/critical risks breaching 48h SLA and alert admins", async () => {
    // 1. Create critical risk (score >= 10)
    const risk = await MeetingRisk.create({
      meetingId: testMeeting._id,
      organizationId: orgId,
      title: "Database SLA Threat",
      category: "Technical",
      probability: 5,
      impact: 4,
      riskScore: 20,
      status: "Open",
      createdBy: testAdmin._id,
    });

    // 2. Backdate the risk to 50 hours ago using collection.updateOne to bypass mongoose default timestamps
    const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);
    await MeetingRisk.collection.updateOne(
      { _id: risk._id },
      { $set: { createdAt: fiftyHoursAgo } },
    );

    // 3. Trigger risk escalation job
    await evaluateRiskEscalations();

    // 4. Verify escalation audit log created
    const escalations = await RiskEscalation.find({ organizationId: orgId });
    expect(escalations.length).toBe(1);
    expect(escalations[0].riskId.toString()).toBe(risk._id.toString());
    expect(escalations[0].reason).toContain("SLA breach");

    // 5. Verify admin notification was triggered
    const notifications = await Notification.find({ user: testAdmin._id });
    expect(notifications.length).toBe(1);
    expect(notifications[0].title).toContain("Risk Escalation Alert");
  });

  it("should load the organization risks and escalations list for the dashboard", async () => {
    // 1. Create a risk and an escalation
    const risk = await MeetingRisk.create({
      meetingId: testMeeting._id,
      organizationId: orgId,
      title: "Schedule Slip",
      category: "Schedule",
      probability: 2,
      impact: 3,
      riskScore: 6,
      createdBy: testAdmin._id,
    });

    await RiskEscalation.create({
      riskId: risk._id,
      organizationId: orgId,
      reason: "Mock escalation reason",
      escalatedAt: new Date(),
    });

    // 2. Fetch dashboard
    const res = await request(app)
      .get("/api/meeting-risks/dashboard")
      .set(authHeader(adminToken));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.risks.length).toBe(1);
    expect(res.body.data.risks[0].title).toBe("Schedule Slip");
    expect(res.body.data.escalations.length).toBe(1);
    expect(res.body.data.escalations[0].reason).toBe("Mock escalation reason");
  });
});
