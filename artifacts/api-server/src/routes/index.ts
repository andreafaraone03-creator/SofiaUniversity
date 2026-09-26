import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sofiaPublicRouter from "./sofia-public";
import sofiaAdminRouter from "./sofia-admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sofiaPublicRouter);
router.use(sofiaAdminRouter);

export default router;
