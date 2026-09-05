import express from 'express';
import recruitmentController from '../controllers/recruitment.controller.js';
import authMiddleware from '../middlewares/auth-middleware.js';
import adminMiddleware from '../middlewares/admin-middleware.js';
import validate from '../middlewares/validate-middleware.js';
import recruitmentValidator from '../validators/recruitment.validator.js';

const recruitmentRouter = express.Router();

// Public routes (no authentication required)
recruitmentRouter.route('/active').get(recruitmentController.getActiveRecruitment);
recruitmentRouter.route('/apply').post(
  validate(recruitmentValidator.recruitmentApplicationSchema),
  recruitmentController.submitApplication
);

// Admin routes (authentication and admin role required)
recruitmentRouter.route('/admin/all').get(authMiddleware, adminMiddleware, recruitmentController.getAllRecruitments);
recruitmentRouter.route('/admin/create').post(authMiddleware, adminMiddleware, recruitmentController.createRecruitment);
recruitmentRouter.route('/admin/update/:id').put(authMiddleware, adminMiddleware, recruitmentController.updateRecruitment);
recruitmentRouter.route('/admin/delete/:id').delete(authMiddleware, adminMiddleware, recruitmentController.deleteRecruitment);
recruitmentRouter.route('/admin/applications/:recruitmentId').get(authMiddleware, adminMiddleware, recruitmentController.getApplications);
recruitmentRouter.route('/admin/applications/:recruitmentId/export').get(authMiddleware, adminMiddleware, recruitmentController.exportApplicationsCSV);
recruitmentRouter.route('/admin/application/:applicationId/status').put(authMiddleware, adminMiddleware, recruitmentController.updateApplicationStatus);

export default recruitmentRouter;
