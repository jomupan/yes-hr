import { Router } from "express";
import { requireAdmin } from "../../middleware/auth";
import { orgRouter } from "./org";
import { employeesRouter } from "./employees";
import { attendanceRouter } from "./attendance";
import { payslipsRouter } from "./payslips";
import { adminsRouter } from "./admins";
import { systemRouter } from "./system";
import { adminCalendarRouter } from "../calendar";

/* Everything under /api/admin requires an authenticated admin. */
export const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.use(systemRouter);
adminRouter.use(orgRouter);
adminRouter.use(employeesRouter);
adminRouter.use(attendanceRouter);
adminRouter.use(payslipsRouter);
adminRouter.use(adminsRouter);
adminRouter.use(adminCalendarRouter);
