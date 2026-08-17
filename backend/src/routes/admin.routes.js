import { Router } from "express";
import { requireAdmin, requireRole } from "../middleware/adminAuth.js";
import {
  logoutAdmin,
  listRegistrations,
  getStats,
  confirmPaymentOverride,
  rejectPaymentOverride,
  addTeamMember,
  verifyCheckInCode,
  checkInParticipant,
} from "../controllers/admin.controller.js";

const router = Router();

router.post("/logout", logoutAdmin);

router.get("/registrations", requireAdmin, requireRole("admin"), listRegistrations);
router.get("/stats", requireAdmin, requireRole("admin"), getStats);
router.patch("/registrations/:id/confirm-payment", requireAdmin, requireRole("admin"), confirmPaymentOverride);
router.patch("/registrations/:id/reject-payment", requireAdmin, requireRole("admin"), rejectPaymentOverride);
router.post("/registrations/:id/participants", requireAdmin, requireRole("admin"), addTeamMember);

router.get("/verify/:code", requireAdmin, verifyCheckInCode);
router.patch("/participants/:id/check-in", requireAdmin, checkInParticipant);

export default router;
