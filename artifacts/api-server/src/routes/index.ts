import { Router, type IRouter } from "express";
import healthRouter from "./health";
import googleCalendarRouter from "./google-calendar";
import sofiaPublicRouter from "./sofia-public";
import sofiaAdminRouter from "./sofia-admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(googleCalendarRouter);
router.use(sofiaPublicRouter);
router.use(sofiaAdminRouter);

export default router;
